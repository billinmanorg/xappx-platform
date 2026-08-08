import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import express from "express";

// Records every call the console makes, and serves canned platform data, so the
// tests assert the console drives the right APIs without a real clients-service.
interface Call { method: string; path: string; body: any; query: any }
const calls: Call[] = [];
let apps: any[];

let source: Server;
let console_: Server;
let base: string;

before(async () => {
  apps = [
    { app_id: "a1", client_id: "c1", name: "Demo One", slug: "demo-one", status: "draft",
      application_type: "small_business", audience_model: "b2c",
      intake: { roles: ["Members", "Staff"], problem: "Help local shops sell online" } },
    { app_id: "a2", client_id: "c1", name: "Beta Two", slug: "beta-two", status: "published",
      application_type: "creator", audience_model: "b2b" },
  ];
  const products = [
    { code: "twins", name: "Twins", requires: [], billable: false, enabled: true, display_name: null, status: "available" },
    { code: "vault", name: "Vault", requires: [], billable: false, enabled: true, display_name: null, status: "available" },
    { code: "vault_premium", name: "Vault Premium", requires: ["vault"], billable: true, enabled: false, display_name: null, status: "available" },
    { code: "agents", name: "Agents", requires: [], billable: false, enabled: false, display_name: null, status: "beta" },
  ];
  const catalog = [
    { code: "twins", name: "Twins", description: "AI twin creation", requires: [], billable: true, admin_only: false, status: "available", sort_order: 10, app_count: 2 },
    { code: "agents", name: "Agents", description: "Chat and task agents", requires: ["twins"], billable: true, admin_only: false, status: "beta", sort_order: 20, app_count: 0 },
    { code: "vault", name: "Vault", description: "Member storage", requires: [], billable: false, admin_only: false, status: "available", sort_order: 30, app_count: 1 },
    { code: "community", name: "Community", description: "Groups and messaging", requires: [], billable: false, admin_only: false, status: "coming_soon", sort_order: 60, app_count: 3 },
  ];

  const s = express();
  s.use(express.json());
  s.use((req, _res, next) => { calls.push({ method: req.method, path: req.path, body: req.body, query: req.query }); next(); });
  s.get("/api/v1/clients", (_q, r) => r.json({ data: [{ client_id: "c1", name: "Acme", slug: "acme" }] }));
  s.get("/api/v1/products", (_q, r) => r.json({ data: catalog }));
  s.put("/api/v1/products/:code", (req, r) => {
    const m = catalog.find((x) => x.code === req.params.code);
    if (!m) return r.status(404).json({ status: 404 });
    Object.assign(m, req.body);
    r.json(m);
  });
  s.get("/api/v1/applications", (req, r) => {
    let data = apps;
    const f = req.query as Record<string, string>;
    for (const k of ["client_id", "status", "application_type", "audience_model"]) {
      if (f[k]) data = data.filter((a) => a[k] === f[k]);
    }
    r.json({ data });
  });
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
  s.put("/api/v1/applications/:slug", (req, r) => {
    const a = apps.find((x) => x.slug === req.params.slug);
    if (!a) return r.status(404).json({ status: 404 });
    Object.assign(a, req.body);
    r.json(a);
  });
  s.post("/api/v1/applications/:slug/status", (req, r) => {
    const a = apps.find((x) => x.slug === req.params.slug);
    if (!a) return r.status(404).json({ status: 404 });
    a.status = req.body.status;
    r.json({ slug: req.params.slug, status: req.body.status });
  });
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

  test("every console page links back to the public website", async () => {
    const html = await (await get("/")).text();
    assert.match(html, /Website/);
    assert.match(html, /href="https:\/\/xappx-site\.onrender\.com"/); // default SITE_URL
  });

  test("the Apps list shows existing apps, the owner, and a filter bar", async () => {
    const html = await (await get("/apps")).text();
    assert.match(html, />Apps</);
    assert.match(html, /Demo One/);
    assert.match(html, /demo-one/);
    assert.match(html, /Acme/); // owner (client) shown on the card
    assert.match(html, /All clients/); // filter bar
    assert.match(html, /Any status/);
    assert.match(html, /Any type/);
    assert.match(html, /id="appsearch"/); // client-side search box
  });

  test("filtering by status forwards the filter to the API and narrows the list", async () => {
    const html = await (await get("/apps?status=published")).text();
    const listCall = [...calls].reverse().find((c) => c.method === "GET" && c.path === "/api/v1/applications");
    assert.equal(listCall!.query.status, "published"); // filter reached the API
    assert.match(html, /Beta Two/); // the published app
    assert.doesNotMatch(html, /Demo One/); // the draft app is filtered out
    assert.match(html, /Clear filters/); // an active filter offers a reset
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

  test("the Modules registry lists the catalogue with state and usage", async () => {
    const html = await (await get("/modules")).text();
    assert.match(html, />Modules</);
    assert.match(html, /Community/); // a module name
    assert.match(html, /Coming soon/); // its lifecycle state chip
    assert.match(html, /Beta/); // agents' state
    assert.match(html, /admin only|billable|needs twins/); // capability tags
    assert.match(html, /apps/); // usage count label
  });

  test("a module's edit page shows its state, name and metadata", async () => {
    const html = await (await get("/modules/agents")).text();
    assert.match(html, /Lifecycle state/);
    assert.match(html, /<option value="retired"/); // full state list
    assert.match(html, /name="name"/);
    assert.match(html, /Save module/);
    assert.match(html, /needs twins/); // read-only capability shown
  });

  test("the configure page shows modules, the lifecycle control, and an editable details form", async () => {
    const html = await (await get("/apps/demo-one")).text();
    assert.match(html, /Agents/); // module toggle
    assert.match(html, /Beta/); // module state chip on the toggle
    assert.match(html, /Lifecycle status/); // status control
    assert.match(html, /<option value="published"/); // publishing is now a lifecycle transition
    assert.match(html, /Save details/); // details form
    assert.match(html, /value="small_business" selected/); // type read back into the select
    assert.match(html, /Help local shops sell online/); // intake problem read back into a textarea
    assert.match(html, /Members/); // a role read back into the roles textarea
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

  test("saving details PUTs the edited fields to /applications/:slug", async () => {
    const r = await form("POST", "/apps/demo-one/edit", {
      name: "Demo One Renamed", primary_domain: "demo.example.com",
      application_type: "marketplace", audience_model: "b2b",
      roles: "Buyers\nSellers", problem: "Match supply and demand",
    });
    assert.equal(r.status, 302);
    const put = calls.find((c) => c.method === "PUT" && c.path === "/api/v1/applications/demo-one");
    assert.ok(put);
    assert.equal(put!.body.name, "Demo One Renamed");
    assert.equal(put!.body.application_type, "marketplace");
    assert.equal(put!.body.audience_model, "b2b");
    assert.deepEqual(put!.body.intake.roles, ["Buyers", "Sellers"]);
    assert.equal(put!.body.intake.problem, "Match supply and demand");
  });

  test("an unrecognised application type is refused before the API is called", async () => {
    const before = calls.filter((c) => c.method === "PUT" && c.path === "/api/v1/applications/demo-one").length;
    const r = await form("POST", "/apps/demo-one/edit", { name: "X", application_type: "not-a-type" });
    assert.equal(r.status, 302); // redirects back with an error flash
    const after = calls.filter((c) => c.method === "PUT" && c.path === "/api/v1/applications/demo-one").length;
    assert.equal(after, before); // never reached the API
  });

  test("editing a module PUTs the new state to /products/:code", async () => {
    const r = await form("POST", "/modules/agents", { status: "available", name: "Agents", description: "Chat", sort_order: "20" });
    assert.equal(r.status, 302);
    const put = calls.find((c) => c.method === "PUT" && c.path === "/api/v1/products/agents");
    assert.ok(put);
    assert.equal(put!.body.status, "available");
    assert.equal(put!.body.name, "Agents");
  });

  test("an invalid module state is refused before the API is called", async () => {
    const before = calls.filter((c) => c.method === "PUT" && c.path === "/api/v1/products/agents").length;
    const r = await form("POST", "/modules/agents", { status: "not-a-state" });
    assert.equal(r.status, 302);
    const after = calls.filter((c) => c.method === "PUT" && c.path === "/api/v1/products/agents").length;
    assert.equal(after, before);
  });

  test("a lifecycle transition POSTs to /applications/:slug/status", async () => {
    const r = await form("POST", "/apps/demo-one/status", { status: "configuring" });
    assert.equal(r.status, 302);
    const post = calls.find((c) => c.method === "POST" && c.path === "/api/v1/applications/demo-one/status");
    assert.ok(post);
    assert.equal(post!.body.status, "configuring");
  });

  test("an invalid status is refused before the API is called", async () => {
    const before = calls.filter((c) => c.method === "POST" && c.path === "/api/v1/applications/demo-one/status").length;
    const r = await form("POST", "/apps/demo-one/status", { status: "not-a-status" });
    assert.equal(r.status, 302);
    const after = calls.filter((c) => c.method === "POST" && c.path === "/api/v1/applications/demo-one/status").length;
    assert.equal(after, before);
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
