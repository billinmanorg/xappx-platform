import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { createApp } from "../src/main.js";
import { pool } from "../src/db.js";
import { consume } from "../src/consumer.js";
import { randomUUID } from "node:crypto";

/** Every run gets its own ids and emails so the suite is re-runnable against a
 *  database that already has data in it. A test that only passes on a fresh
 *  database is a test that stops being run. */
const RUN = randomUUID().slice(0, 8);

let server: Server;
let base: string;

before(async () => {
  server = createApp().listen(0);
  const addr = server.address() as { port: number };
  base = `http://127.0.0.1:${addr.port}/api/v1`;
});

after(async () => {
  server.close();
  await pool.end();
});

const get = (p: string, h: Record<string, string> = {}) => fetch(base + p, { headers: h });
const send = (m: string, p: string, body: unknown, h: Record<string, string> = {}) =>
  fetch(base + p, {
    method: m,
    headers: { "content-type": "application/json", ...h },
    body: JSON.stringify(body),
  });

/** A clients-service application.created CloudEvent, as the relay would deliver it. */
function applicationCreated(appId: string, clientId: string, slug: string, id = randomUUID()) {
  return {
    id,
    type: "com.xappx.application.created",
    data: { app_id: appId, client_id: clientId, slug },
  };
}

async function makeUser(tag: string): Promise<string> {
  const r = await send("POST", "/users", { email: `${tag}-${RUN}@example.com`, name: tag });
  assert.equal(r.status, 201, `create user ${tag}`);
  return (await r.json()).user_id as string;
}

describe("users are global identity", () => {
  test("a user can be created, fetched, listed and renamed", async () => {
    const r = await send("POST", "/users", { email: `ada-${RUN}@example.com`, name: "Ada" });
    assert.equal(r.status, 201);
    const user = await r.json();
    assert.ok(user.user_id);
    assert.equal(user.status, "active");

    const byId = await (await get(`/users/${user.user_id}`)).json();
    assert.equal(byId.email, `ada-${RUN}@example.com`);

    const byEmail = await (await get(`/users?email=ada-${RUN}@example.com`)).json();
    assert.equal(byEmail.data.length, 1);

    const upd = await send("PUT", `/users/${user.user_id}`, { name: "Ada L." });
    assert.equal((await upd.json()).name, "Ada L.");
  });

  test("creating a user writes com.xappx.user.created to the outbox", async () => {
    const user = await (await send("POST", "/users", { email: `grace-${RUN}@example.com` })).json();
    // Scoped to this user's id, not a global count: other test files write to the
    // same outbox in parallel, so a before/after total is not isolated.
    const { rows } = await pool.query(
      `select count(*)::int as n from outbox
        where event_type = 'com.xappx.user.created' and payload->'data'->>'user_id' = $1`,
      [user.user_id],
    );
    assert.equal(rows[0].n, 1);
  });

  test("a duplicate email is refused with a 409 problem document", async () => {
    const email = `dup-${RUN}@example.com`;
    assert.equal((await send("POST", "/users", { email })).status, 201);
    const r = await send("POST", "/users", { email });
    assert.equal(r.status, 409);
    assert.equal(r.headers.get("content-type")?.split(";")[0], "application/problem+json");
  });

  test("an identical retry with the same Idempotency-Key does not create a second user", async () => {
    const body = { email: `idem-${RUN}@example.com`, name: "Idem" };
    const key = { "Idempotency-Key": `user-key-1-${RUN}` };
    const a = await send("POST", "/users", body, key);
    const b = await send("POST", "/users", body, key);
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.equal((await a.json()).user_id, (await b.json()).user_id);
  });

  test("reusing a key with a different body is rejected", async () => {
    const key = { "Idempotency-Key": `user-key-2-${RUN}` };
    await send("POST", "/users", { email: `a-${RUN}@example.com` }, key);
    const r = await send("POST", "/users", { email: `b-${RUN}@example.com` }, key);
    assert.equal(r.status, 409);
  });
});

describe("memberships are per-brand and reject unknown brands", () => {
  test("a membership for a brand this service has never seen is rejected without a sync call", async () => {
    const userId = await makeUser("orphan");
    const unknownApp = randomUUID();
    const r = await send("POST", "/memberships", { user_id: userId, app_id: unknownApp });
    assert.equal(r.status, 404);
    assert.match((await r.json()).detail, /Application/);
  });

  test("once application.created is consumed, a membership can be created and emits an event", async () => {
    const appId = randomUUID();
    const clientId = randomUUID();
    await consume(applicationCreated(appId, clientId, `brand-${RUN}`));

    const userId = await makeUser("member");
    const r = await send("POST", "/memberships", { user_id: userId, app_id: appId });
    assert.equal(r.status, 201);
    const m = await r.json();
    assert.equal(m.app_id, appId);
    assert.equal(m.client_id, clientId);

    // Scoped to this membership's id so a parallel test file cannot skew the count.
    const { rows } = await pool.query(
      `select count(*)::int as n from outbox
        where event_type = 'com.xappx.membership.created' and payload->'data'->>'membership_id' = $1`,
      [m.membership_id],
    );
    assert.equal(rows[0].n, 1);
  });

  test("a second membership for the same user and brand is a 409", async () => {
    const appId = randomUUID();
    await consume(applicationCreated(appId, randomUUID(), `brand2-${RUN}`));
    const userId = await makeUser("twice");
    assert.equal((await send("POST", "/memberships", { user_id: userId, app_id: appId })).status, 201);
    const r = await send("POST", "/memberships", { user_id: userId, app_id: appId });
    assert.equal(r.status, 409);
  });
});

describe("the application.created consumer is idempotent", () => {
  test("replaying the same event changes state exactly once", async () => {
    const appId = randomUUID();
    const event = applicationCreated(appId, randomUUID(), `dedupe-${RUN}`);

    const first = await consume(event);
    const second = await consume(event); // same CloudEvent id — a redelivery
    assert.equal(first, true);
    assert.equal(second, false);

    const { rows } = await pool.query(
      `select count(*)::int as n from known_applications where app_id = $1`,
      [appId],
    );
    assert.equal(rows[0].n, 1);
  });
});

describe("session issuance enforces the tenant boundary", () => {
  test("an authenticated user with a membership gets a session", async () => {
    const appId = randomUUID();
    await consume(applicationCreated(appId, randomUUID(), `sess-${RUN}`));
    const userId = await makeUser("sess-ok");
    await send("POST", "/memberships", { user_id: userId, app_id: appId });

    const r = await send("POST", "/sessions", { user_id: userId, app_id: appId });
    assert.equal(r.status, 201);
    const s = await r.json();
    assert.ok(s.session_id);
    assert.ok(s.expires_at);
  });

  test("an authenticated user with NO membership gets 403 and a join path, never 401", async () => {
    const appId = randomUUID();
    await consume(applicationCreated(appId, randomUUID(), `sess-nomember-${RUN}`));
    const userId = await makeUser("no-member"); // exists (authenticated), but never joined this brand

    const r = await send("POST", "/sessions", { user_id: userId, app_id: appId });
    assert.equal(r.status, 403); // NOT 401 — authentication worked
    assert.notEqual(r.status, 401);
    assert.equal(r.headers.get("content-type")?.split(";")[0], "application/problem+json");
    const p = await r.json();
    assert.equal(p.type, "https://api.xappx.com/problems/no-membership");
    assert.equal(p.join_path, "/api/v1/memberships");
    assert.equal(p.app_id, appId);
    assert.equal(p.user_id, userId);
    assert.ok(p.correlation_id);
  });

  test("a session for a brand this service has never seen is a 404", async () => {
    const userId = await makeUser("sess-unknown-app");
    const r = await send("POST", "/sessions", { user_id: userId, app_id: randomUUID() });
    assert.equal(r.status, 404);
  });

  test("a session can be revoked", async () => {
    const appId = randomUUID();
    await consume(applicationCreated(appId, randomUUID(), `sess-revoke-${RUN}`));
    const userId = await makeUser("sess-revoke");
    await send("POST", "/memberships", { user_id: userId, app_id: appId });
    const s = await (await send("POST", "/sessions", { user_id: userId, app_id: appId })).json();

    assert.equal((await send("DELETE", `/sessions/${s.session_id}`, {})).status, 204);
    // Revoking again is a 404 — there is no active session to revoke.
    assert.equal((await send("DELETE", `/sessions/${s.session_id}`, {})).status, 404);
  });
});

describe("brand A cannot read brand B's memberships", () => {
  test("GET /memberships is scoped by app_id through RLS, not by the query", async () => {
    const appA = randomUUID();
    const appB = randomUUID();
    await consume(applicationCreated(appA, randomUUID(), `iso-a-${RUN}`));
    await consume(applicationCreated(appB, randomUUID(), `iso-b-${RUN}`));

    const userA = await makeUser("iso-user-a");
    await send("POST", "/memberships", { user_id: userA, app_id: appA });

    const listA = await (await get(`/memberships?app_id=${appA}`)).json();
    const listB = await (await get(`/memberships?app_id=${appB}`)).json();

    assert.ok(listA.data.some((m: any) => m.user_id === userA));
    assert.ok(!listB.data.some((m: any) => m.user_id === userA)); // A's membership is invisible under B
  });
});

describe("errors are problem documents", () => {
  test("an unknown user returns 404 problem+json with a correlation id", async () => {
    const r = await get(`/users/${randomUUID()}`);
    assert.equal(r.status, 404);
    assert.equal(r.headers.get("content-type")?.split(";")[0], "application/problem+json");
    const p = await r.json();
    assert.equal(p.status, 404);
    assert.ok(p.correlation_id);
  });

  test("a malformed email is rejected before it reaches the database", async () => {
    const r = await send("POST", "/users", { email: "not-an-email" });
    assert.equal(r.status, 400);
  });
});
