import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import express from "express";
import { createApp } from "../src/main.js";
import { pool } from "../src/db.js";
import { randomUUID } from "node:crypto";

const RUN = randomUUID().slice(0, 8);

let server: Server;
let receiver: Server;
let base: string;
let hookUrl: string;
const received: any[] = [];

before(async () => {
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  const r = express();
  r.use(express.json());
  r.post("*", (req, res) => {
    received.push(req.body);
    res.status(200).json({ ok: true });
  });
  receiver = r.listen(0);
  hookUrl = `http://127.0.0.1:${(receiver.address() as { port: number }).port}/hook`;
});

after(async () => {
  server.close();
  receiver.close();
  await pool.end();
});

const send = (m: string, p: string, body: unknown, h: Record<string, string> = {}) =>
  fetch(base + p, { method: m, headers: { "content-type": "application/json", ...h }, body: JSON.stringify(body) });
const get = (p: string, h: Record<string, string> = {}) => fetch(base + p, { headers: h });

function cloudEvent(type: string, appId: string, id = randomUUID()) {
  return { id, type, source: "test", appid: appId, time: new Date().toISOString(), data: { app_id: appId } };
}

describe("ingest is the log of record and is idempotent", () => {
  test("a new event is stored once; a redelivery stores nothing more", async () => {
    const appId = randomUUID();
    const ev = cloudEvent(`demo.stored.${RUN}`, appId);

    const first = await (await send("POST", "/internal/events", ev)).json();
    const second = await (await send("POST", "/internal/events", ev)).json();
    assert.equal(first.stored, true);
    assert.equal(second.stored, false); // same CloudEvent id — a duplicate

    const { rows } = await pool.query(`select count(*)::int as n from events_log where event_id = $1`, [ev.id]);
    assert.equal(rows[0].n, 1);
  });
});

describe("webhooks fan out on matching events", () => {
  test("a registered webhook receives a matching event and a delivery is recorded", async () => {
    const appId = randomUUID();
    const type = `demo.hooked.${RUN}`;
    const reg = await send("POST", "/api/v1/webhooks", { url: hookUrl, event_types: [type] }, { "X-App-Id": appId });
    assert.equal(reg.status, 201);
    const webhookId = (await reg.json()).webhook_id;

    const before = received.length;
    const ev = cloudEvent(type, appId);
    await send("POST", "/internal/events", ev);

    assert.equal(received.length, before + 1);
    assert.equal(received[received.length - 1].id, ev.id);

    const { rows } = await pool.query(
      `select status_code, delivered_at from webhook_deliveries where webhook_id = $1 and event_id = $2`,
      [webhookId, ev.id],
    );
    assert.equal(rows[0].status_code, 200);
    assert.ok(rows[0].delivered_at);
  });

  test("registering a webhook honours Idempotency-Key", async () => {
    const appId = randomUUID();
    const body = { url: hookUrl, event_types: [] };
    const key = { "X-App-Id": appId, "Idempotency-Key": `wh-${RUN}` };
    const a = await (await send("POST", "/api/v1/webhooks", body, key)).json();
    const b = await (await send("POST", "/api/v1/webhooks", body, key)).json();
    assert.equal(a.webhook_id, b.webhook_id);
  });
});

describe("engagements are per-brand history", () => {
  test("brand A cannot read brand B's engagements", async () => {
    const appA = randomUUID();
    const appB = randomUUID();
    const userId = randomUUID();

    const r = await send("POST", "/api/v1/engagements", { user_id: userId, action: "page_view" }, { "X-App-Id": appA });
    assert.equal(r.status, 201);

    const listA = await (await get("/api/v1/engagements", { "X-App-Id": appA })).json();
    const listB = await (await get("/api/v1/engagements", { "X-App-Id": appB })).json();
    assert.ok(listA.data.some((e: any) => e.user_id === userId));
    assert.ok(!listB.data.some((e: any) => e.user_id === userId));
  });

  test("an engagement without an action is a 400 problem document", async () => {
    const r = await send("POST", "/api/v1/engagements", { user_id: randomUUID() }, { "X-App-Id": randomUUID() });
    assert.equal(r.status, 400);
    assert.equal(r.headers.get("content-type")?.split(";")[0], "application/problem+json");
  });

  test("a missing X-App-Id is a 400", async () => {
    const r = await send("POST", "/api/v1/engagements", { action: "x" });
    assert.equal(r.status, 400);
  });
});
