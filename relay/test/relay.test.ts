import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import express from "express";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { drainOnce, type Deliver } from "../src/relay.js";

// Per-run table so the suite is re-runnable against a populated database.
const RUN = randomUUID().slice(0, 8);
const TABLE = `outbox_relay_${RUN}`;

let pool: pg.Pool;
let logSrv: Server, idSrv: Server, gwSrv: Server;
let logUrl: string, idUrl: string, gwUrl: string;
const got = { log: [] as any[], id: [] as any[], gw: [] as any[] };

const routes = (type: string): string[] => {
  const t = [logUrl];
  if (type === "com.xappx.application.created") t.push(idUrl);
  if (type.startsWith("com.xappx.application.product.")) t.push(gwUrl);
  return t;
};

async function insertEvent(type: string, id = randomUUID()) {
  const payload = { specversion: "1.0", id, type, source: "test", time: new Date().toISOString(), data: {} };
  await pool.query(`insert into ${TABLE} (aggregate, event_type, payload) values ($1,$2,$3)`, ["agg", type, payload]);
}

before(async () => {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(`create table if not exists ${TABLE} (
    outbox_id bigserial primary key, aggregate text not null, event_type text not null,
    subject text, payload jsonb not null,
    occurred_at timestamptz not null default now(), published_at timestamptz)`);

  const mk = (bucket: any[]) => {
    const a = express();
    a.use(express.json());
    a.post("*", (req, res) => {
      bucket.push(req.body);
      res.json({ ok: true });
    });
    return a;
  };
  logSrv = mk(got.log).listen(0);
  idSrv = mk(got.id).listen(0);
  gwSrv = mk(got.gw).listen(0);
  const port = (s: Server) => (s.address() as { port: number }).port;
  logUrl = `http://127.0.0.1:${port(logSrv)}/log`;
  idUrl = `http://127.0.0.1:${port(idSrv)}/id`;
  gwUrl = `http://127.0.0.1:${port(gwSrv)}/gw`;
});

after(async () => {
  logSrv.close();
  idSrv.close();
  gwSrv.close();
  await pool.query(`drop table if exists ${TABLE}`);
  await pool.end();
});

describe("the relay drains the outbox and routes by event type", () => {
  test("every event reaches the log; type-specific events reach their consumer", async () => {
    await insertEvent("com.xappx.application.created");
    await insertEvent("com.xappx.application.product.enabled");
    await insertEvent("com.xappx.user.created");

    const r = await drainOnce(pool, { routes, table: TABLE });
    assert.equal(r.delivered, 3);
    assert.equal(got.log.length, 3); // events-service subscribes to everything
    assert.equal(got.id.length, 1); // only application.created -> identity
    assert.equal(got.gw.length, 1); // only product.* -> gateway invalidate

    const { rows } = await pool.query(`select count(*)::int as n from ${TABLE} where published_at is null`);
    assert.equal(rows[0].n, 0); // all marked published
  });

  test("a second drain delivers nothing — published rows are not re-sent", async () => {
    const before = got.log.length;
    const r = await drainOnce(pool, { routes, table: TABLE });
    assert.equal(r.delivered, 0);
    assert.equal(got.log.length, before);
  });
});

describe("delivery is at-least-once with retry", () => {
  test("a failed delivery defers the row, and the next pass delivers it", async () => {
    await insertEvent("com.xappx.user.created");

    let failing = true;
    const flaky: Deliver = async () => !failing; // every target fails while `failing`

    const first = await drainOnce(pool, { routes, table: TABLE, deliver: flaky });
    assert.equal(first.deferred, 1);
    assert.equal(first.delivered, 0);

    const { rows: still } = await pool.query(`select count(*)::int as n from ${TABLE} where published_at is null`);
    assert.equal(still[0].n, 1); // left unpublished for retry

    failing = false;
    const second = await drainOnce(pool, { routes, table: TABLE, deliver: flaky });
    assert.equal(second.delivered, 1);
  });
});
