import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { createApp } from "../src/main.js";
import { pool } from "../src/db.js";
import { randomUUID } from "node:crypto";

/** Every run gets its own slugs and keys so the suite is re-runnable against a
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

describe("brand launch by configuration", () => {
  test("a brand can be created and published with no new code", async () => {
    const clients = await (await get("/clients")).json();
    const clientId = clients.data[0].client_id;

    const r = await send("POST", "/applications", {
      client_id: clientId,
      name: "Mindset Summit",
      slug: `mindset-summit-${RUN}`,
      theme: { primary_color: "#00C2FF" },
      copy: { hero: "Ideas In x Intelligence Out" },
      products: ["community"],
    });
    assert.equal(r.status, 201);
    const app = await r.json();
    assert.equal(app.slug, `mindset-summit-${RUN}`);

    const pub = await send("POST", `/applications/mindset-summit-${RUN}/publish`, {});
    assert.equal((await pub.json()).status, "published");
  });

  test("an identical retry with the same Idempotency-Key does not create a second brand", async () => {
    const clients = await (await get("/clients")).json();
    const clientId = clients.data[0].client_id;
    const body = { client_id: clientId, name: "Retry Brand", slug: `retry-brand-${RUN}` };
    const key = { "Idempotency-Key": `key-retry-1-${RUN}` };

    const a = await send("POST", "/applications", body, key);
    const b = await send("POST", "/applications", body, key);
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.equal((await a.json()).app_id, (await b.json()).app_id);
  });

  test("reusing a key with a different body is rejected", async () => {
    const clients = await (await get("/clients")).json();
    const clientId = clients.data[0].client_id;
    const key = { "Idempotency-Key": `key-retry-2-${RUN}` };
    await send("POST", "/applications", { client_id: clientId, name: "A", slug: `brand-a-${RUN}` }, key);
    const r = await send("POST", "/applications", { client_id: clientId, name: "B", slug: `brand-b-${RUN}` }, key);
    assert.equal(r.status, 409);
    assert.equal(r.headers.get("content-type")?.split(";")[0], "application/problem+json");
  });
});

describe("the manifest is what the front end renders", () => {
  test("Angel Twin ships without agents, Twin Protocol ships with them", async () => {
    const angel = await (await get("/applications/angel-twin/manifest")).json();
    const twin = await (await get("/applications/twin-protocol/manifest")).json();

    const agentsOn = (m: any) => m.products.find((p: any) => p.code === "agents").enabled;
    assert.equal(agentsOn(angel), false);
    assert.equal(agentsOn(twin), true);

    // A disabled product is absent from navigation, not hidden client-side.
    assert.ok(!angel.nav.some((n: any) => n.product === "agents"));
    assert.ok(twin.nav.some((n: any) => n.product === "agents"));
  });

  test("per-brand display names override the product name", async () => {
    const angel = await (await get("/applications/angel-twin/manifest")).json();
    const vp = angel.products.find((p: any) => p.code === "vault_premium");
    assert.equal(vp.display_name, "Twin Vault Premium");
  });

  test("onboarding steps renumber when a product is off", async () => {
    const token = await (await get("/applications/angel-token/manifest")).json();
    const keys = token.onboarding.map((s: any) => s.key);
    assert.ok(!keys.includes("create_twin"));
    assert.deepEqual(
      token.onboarding.map((s: any) => s.step),
      token.onboarding.map((_: any, i: number) => i + 1),
    );
  });

  test("toggling a product changes the manifest and invalidates the ETag", async () => {
    const before = await get("/applications/twin-protocol/manifest");
    const etag = before.headers.get("etag")!;
    assert.equal((await get("/applications/twin-protocol/manifest", { "If-None-Match": etag })).status, 304);

    await send("PUT", "/applications/twin-protocol/products/video_plan", { enabled: true });

    const after = await get("/applications/twin-protocol/manifest");
    assert.notEqual(after.headers.get("etag"), etag);
    const m = await after.json();
    assert.equal(m.products.find((p: any) => p.code === "video_plan").enabled, true);
  });
});

describe("dependency rules hold at the API", () => {
  test("enabling vault_premium without vault is refused with a problem document", async () => {
    const r = await send("PUT", "/applications/twin-protocol/products/vault_premium", { enabled: true });
    // twin-protocol has vault on, so this one succeeds; angel-token does not.
    assert.equal(r.status, 200);

    // Put angel-token back to a known state first: this assertion is about the
    // rule, not about whatever a previous run left behind.
    await send("PUT", "/applications/angel-token/products/vault_premium", { enabled: false });
    await send("PUT", "/applications/angel-token/products/vault", { enabled: false });
    const bad = await send("PUT", "/applications/angel-token/products/vault_premium", { enabled: true });
    assert.equal(bad.status, 409);
    const problem = await bad.json();
    assert.match(problem.detail, /requires vault/);
    assert.equal(problem.type, "https://api.xappx.com/problems/product-dependency");
  });

  test("disabling a product something else depends on is refused", async () => {
    const r = await send("PUT", "/applications/angel-twin/products/vault", { enabled: false });
    assert.equal(r.status, 409);
    assert.match((await r.json()).detail, /depends on it/);
  });
});

describe("every change leaves a trace", () => {
  test("a toggle writes exactly one event to the outbox", async () => {
    const { rows: before } = await pool.query(
      `select count(*)::int as n from outbox where event_type like 'com.xappx.application.product.%'`,
    );
    await send("PUT", "/applications/angel-twin/products/community", { enabled: true });
    const { rows: after } = await pool.query(
      `select count(*)::int as n from outbox where event_type like 'com.xappx.application.product.%'`,
    );
    assert.equal(after[0].n, before[0].n + 1);

    const { rows } = await pool.query(
      `select payload from outbox order by outbox_id desc limit 1`,
    );
    const e = rows[0].payload;
    assert.equal(e.specversion, "1.0");
    assert.ok(e.id && e.time && e.source);
    assert.equal(e.published_at, undefined);
  });
});

describe("errors are problem documents", () => {
  test("an unknown brand returns 404 problem+json", async () => {
    const r = await get("/applications/does-not-exist/manifest");
    assert.equal(r.status, 404);
    assert.equal(r.headers.get("content-type")?.split(";")[0], "application/problem+json");
    const p = await r.json();
    assert.equal(p.status, 404);
    assert.ok(p.correlation_id);
  });

  test("a bad slug is rejected before it reaches the database", async () => {
    const r = await send("POST", "/applications", { client_id: "x", name: "X", slug: "Not A Slug" });
    assert.equal(r.status, 400);
  });
});

describe("application taxonomy (brief §7)", () => {
  test("type and audience round-trip on create and in the list", async () => {
    const clients = await (await get("/clients")).json();
    const clientId = clients.data[0].client_id;
    const slug = `taxo-app-${RUN}`;
    const r = await send("POST", "/applications", {
      client_id: clientId, name: "Taxo App", slug,
      application_type: "marketplace", audience_model: "b2b",
    });
    assert.equal(r.status, 201);
    const app = await r.json();
    assert.equal(app.application_type, "marketplace");
    assert.equal(app.audience_model, "b2b");

    const list = await (await get(`/applications?client_id=${clientId}`)).json();
    const found = list.data.find((a: { slug: string }) => a.slug === slug);
    assert.ok(found);
    assert.equal(found.application_type, "marketplace");
    assert.equal(found.audience_model, "b2b");
  });

  test("an unknown audience_model is rejected with 400", async () => {
    const clients = await (await get("/clients")).json();
    const clientId = clients.data[0].client_id;
    const r = await send("POST", "/applications", {
      client_id: clientId, name: "Bad Audience", slug: `bad-aud-${RUN}`, audience_model: "b2x",
    });
    assert.equal(r.status, 400);
  });
});
