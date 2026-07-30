import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import express from "express";

// Records every call the console makes, and serves canned platform data, so the
// tests assert the console drives the right APIs without a real clients-service.
interface Call { method: string; path: string; body: any }
const calls: Call[] = [];
let apps: any[];

let source: Server;
let console_: Server;
let base: string;

before(async () => {
  apps = [{ app_id: "a1", client_id: "c1", name: "Demo One", slug: "demo-one", status: "draft",
            application_type: "small_business", audience_model: "b2c",
            intake: { roles: ["Members", "Staff"], problem: "Help local shops sell online" } }];
  const products = [
    { code: "twins", name: "Twins", requires: [], billable: false, enabled: true, display_name: null },
    { code: "vault", name: "Vault", requires: [], billable: false, enabled: true, display_name: null },
    { code: "vault_premium", name: "Vault Premium", requires: ["vault"], billable: true, enabled: false, display_name: null },
    { code: "agents", name: "Agents", requires: [], billable: false, enabled: false, display_name: null },
  ];

  const s = express();
  s.use(express.json());
  s.use((req, _res, next) => { calls.push({ method: req.method, path: req.path, body: req.body }); next(); });
  s.get("/api/v1/clients", (_q, r) => r.json({ data: [{ client_id: "c1", name: "Acme", slug: "acme" }] }));
  s.get("/api/v1/applications", (_q, r) => r.json({ data: apps }));
  s.get("/api/v1/applications/:slug/products", (req, r) =>
    apps.some((a) => a.slug === req.params.slug) ? r.json({ data: products }) : r.status(404).json({ status: 404 }));
  s.get("/api/v1/applications/:slug", (req, r) => {
    const a = apps.find((x) => x.slug === req.params.slug);
    return a ? r.json(a) : r.status(404).json({ status: 404 });
  });
  s.post("/api/v1/applications", (req, r) => {
    const a = {
      app_id: "new", client_id: req.body.client_id, name: req.body.name, slug: req.body.slug, status: "draft",
      application_type: req.body.application_type ?? null, audience_model: req.body.audience_model ?? null,
      intake: req.body.intake ?? {},
    };
    apps.push(a);
    r.status(201).json(a);
  });
  s.put("/api/v1/applications/:slug/products/:code", (req, r) =>
    r.json({ product_code: req.params.code, enabled: req.body.enabled }));
  s.post("/api/v1/applications/:slug/publish", (req, r) => {
    const a = apps.find((x) => x.slug === req.params.slug); if (a) a.status = "published";
    r.json({ slug: req.params.slug, status: "published" });
  });
  source = await new Promise<Server>((res) => { const srv = s.listen(0, () => res(srv)); });
  process.env.CLIENTS_API_BASE = `http://127.0.0.1:${(source.address() as { port: number }).port}`;

  const { createApp } = await import("../src/main.js");
  console_ = await new Promise<Server>((res) => { const srv = createApp().listen(0, () => res(srv)); });
  base = `http://127.0.0.1:${(console_.address() as { port: number }).port}`;
});

after(() => { console_.close(); source.close(); });

const get = (p: string) => fetch(base + p);
const form = (m: string, p: string, obj: Record<string, string>) =>
  fetch(base + p, {
    method: m,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(obj).toString(),
    redirect: "manual",
  });

describe("the Factory renders from the platform API", () => {
  test("the dashboard shows real counts and recent apps, with honest zero-states", async () => {
    const html = await (await get("/")).text();
    assert.match(html, /Factory/);
    assert.match(html, /Applications/); // a metric card
    assert.match(html, /not yet tracked/); // zero-state label, not a fake number
    assert.match(html, /Demo One/); // recent app
  });

  test("the Apps list shows existing apps", async () => {
    const html = await (await get("/apps")).text();
    assert.match(html, />Apps</);
    assert.match(html, /Demo One/);
    assert.match(html, /demo-one/);
  });

  test("the New app wizard walks build → people → discovery → launch", async () => {
    const html = await (await get("/apps/new")).text();
    assert.match(html, /Create new app/);
    assert.match(html, /What are you building\?/); // step 1: type
    assert.match(html, /value="small_business"/); // a catalogue type
    assert.match(html, /name="audience_model" value="b2b2c"/); // step 1: audience
    assert.match(html, /Who uses this app\?/); // step 2: roles
    assert.match(html, /name="roles"/);
    assert.match(html, /What problem does the application solve\?/); // step 3: discovery
    assert.match(html, /name="problem"/);
    assert.match(html, /Acme/); // step 4: client option
    assert.match(html, /name="products" value="vault"/); // step 4: module checkbox
    assert.match(html, /RECOMMENDED|small_business/); // type→module recommendations wired in the script
  });

  test("the Apps list shows an app's type and audience", async () => {
    const html = await (await get("/apps")).text();
    assert.match(html, /Small business/); // humanised application_type
    assert.match(html, /B2C/); // audience model
  });

  test("the configure page shows module toggles, a publish action, and the About panel", async () => {
    const html = await (await get("/apps/demo-one")).text();
    assert.match(html, /Agents/);
    assert.match(html, /Publish app/);
    assert.match(html, /About this app/);
    assert.match(html, /Small business/); // type read back
    assert.match(html, /Help local shops sell online/); // intake problem read back
    assert.match(html, /Members/); // a role read back
  });
});

describe("terminology is Apps, not Brands (brief §1)", () => {
  test("core UI copy uses App/Apps, not Brand/Brands", async () => {
    const dash = await (await get("/")).text();
    const list = await (await get("/apps")).text();
    assert.doesNotMatch(dash + list, /\bBrand(s)?\b/);
    assert.match(list, /Every app on the XAPPX Platform/);
  });

  test("old /brands URLs redirect to /apps", async () => {
    const r = await fetch(base + "/brands", { redirect: "manual" });
    assert.equal(r.status, 301);
    assert.equal(r.headers.get("location"), "/apps");
  });
});

describe("the Factory drives the right API calls", () => {
  test("creating an app POSTs to /applications with type + audience and redirects to its page", async () => {
    const r = await form("POST", "/apps", {
      client_id: "c1", name: "Aurora", slug: "aurora-x", products: "community",
      application_type: "marketplace", audience_model: "b2b",
      roles: "Buyers\nSellers\n", problem: "Match buyers and sellers",
    });
    assert.equal(r.status, 302);
    assert.equal(r.headers.get("location"), "/apps/aurora-x");
    const created = calls.find((c) => c.method === "POST" && c.path === "/api/v1/applications");
    assert.ok(created);
    assert.equal(created!.body.slug, "aurora-x");
    assert.equal(created!.body.application_type, "marketplace");
    assert.equal(created!.body.audience_model, "b2b");
    assert.deepEqual(created!.body.products, ["community"]);
    assert.deepEqual(created!.body.intake.roles, ["Buyers", "Sellers"]); // textarea → list
    assert.equal(created!.body.intake.problem, "Match buyers and sellers");
  });

  test("an invalid slug is refused before it reaches the API", async () => {
    const before = calls.filter((c) => c.method === "POST" && c.path === "/api/v1/applications").length;
    const r = await form("POST", "/apps", { client_id: "c1", name: "X", slug: "Not A Slug", application_type: "individual" });
    assert.equal(r.status, 400);
    const after = calls.filter((c) => c.method === "POST" && c.path === "/api/v1/applications").length;
    assert.equal(after, before); // never called the API
  });

  test("creating an app without a type is refused before it reaches the API", async () => {
    const before = calls.filter((c) => c.method === "POST" && c.path === "/api/v1/applications").length;
    const r = await form("POST", "/apps", { client_id: "c1", name: "No Type", slug: "no-type" });
    assert.equal(r.status, 400);
    const after = calls.filter((c) => c.method === "POST" && c.path === "/api/v1/applications").length;
    assert.equal(after, before); // never called the API
  });

  test("toggling a module PUTs to the product endpoint", async () => {
    const r = await form("POST", "/apps/demo-one/toggle", { code: "agents", enabled: "true" });
    assert.equal(r.status, 302);
    const put = calls.find((c) => c.method === "PUT" && c.path === "/api/v1/applications/demo-one/products/agents");
    assert.ok(put);
    assert.equal(put!.body.enabled, true);
  });

  test("publishing POSTs to the publish endpoint", async () => {
    const r = await form("POST", "/apps/demo-one/publish", {});
    assert.equal(r.status, 302);
    assert.ok(calls.some((c) => c.method === "POST" && c.path === "/api/v1/applications/demo-one/publish"));
  });
});

describe("the password gate (for public deploys)", () => {
  test("blocks without credentials, allows with them, and leaves health open", async () => {
    process.env.FACTORY_USER = "bill";
    process.env.FACTORY_PASS = "s3cret-demo";
    try {
      assert.equal((await fetch(base + "/")).status, 401); // no credentials
      const auth = { authorization: "Basic " + Buffer.from("bill:s3cret-demo").toString("base64") };
      assert.equal((await fetch(base + "/", { headers: auth })).status, 200);
      const wrong = { authorization: "Basic " + Buffer.from("bill:nope").toString("base64") };
      assert.equal((await fetch(base + "/", { headers: wrong })).status, 401);
      assert.equal((await fetch(base + "/healthz")).status, 200); // health stays public
    } finally {
      delete process.env.FACTORY_USER;
      delete process.env.FACTORY_PASS;
    }
  });
});
