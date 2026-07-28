import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { createApp } from "../src/main.js";
import { pool } from "../src/db.js";
import { randomUUID } from "node:crypto";

const RUN = randomUUID().slice(0, 8);
let server: Server;
let base: string;

before(async () => {
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
});
after(async () => {
  server.close();
  await pool.end();
});

const send = (m: string, p: string, body: unknown) =>
  fetch(base.replace(/\/$/, "") + p, {
    method: m,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("relay delivery keeps known_applications current", () => {
  test("delivering application.created registers the brand, idempotently, and enables membership", async () => {
    const appId = randomUUID();
    const event = {
      id: randomUUID(),
      type: "com.xappx.application.created",
      data: { app_id: appId, client_id: randomUUID(), slug: `relayed-${RUN}` },
    };

    const first = await (await send("POST", "/internal/events", event)).json();
    const again = await (await send("POST", "/internal/events", event)).json(); // redelivery
    assert.equal(first.applied, true);
    assert.equal(again.applied, false); // deduped on the CloudEvent id

    const { rows } = await pool.query(`select count(*)::int as n from known_applications where app_id = $1`, [appId]);
    assert.equal(rows[0].n, 1);

    // The brand is now known, so a membership can be created without any manual seed.
    const user = await (await send("POST", "/api/v1/users", { email: `relay-${RUN}-${appId.slice(0, 4)}@example.com` })).json();
    const m = await send("POST", "/api/v1/memberships", { user_id: user.user_id, app_id: appId });
    assert.equal(m.status, 201);
  });
});
