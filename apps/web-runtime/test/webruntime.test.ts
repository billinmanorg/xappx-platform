import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import express from "express";
import { renderPage, routeExists } from "../src/render.js";
import type { Manifest } from "../src/manifest.js";

// Generic, brand-neutral fixtures — no real brand names anywhere in this suite.
const BRAND_ONE: Manifest = {
  app_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  slug: "brand-one",
  version: "1",
  theme: { primary_color: "#FF8800" },
  copy: { title: "Brand One", hero: "Everything you need to start." },
  products: [
    { code: "vault", enabled: true },
    { code: "agents", enabled: false }, // OFF -> must not appear anywhere
    { code: "community", enabled: true },
  ],
  nav: [
    { label: "Home", route: "/" },
    { label: "Vault", route: "/vault", product: "vault" },
    { label: "Community", route: "/community", product: "community" },
  ],
  onboarding: [
    { step: 1, key: "account" },
    { step: 2, key: "connect_vault", product: "vault" },
  ],
  legal: { terms_url: "/legal/terms/1", privacy_url: "/legal/privacy/1", version: "1" },
};

const BRAND_TWO: Manifest = {
  app_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  slug: "brand-two",
  version: "1",
  products: [{ code: "agents", enabled: true }],
  nav: [
    { label: "Home", route: "/" },
    { label: "Agents", route: "/agents", product: "agents" },
  ],
};

let source: Server; // fake manifest source (stands in for gateway -> clients-service)
let web: Server;
let base: string;

before(async () => {
  const s = express();
  s.get("/api/v1/applications/:slug/manifest", (req, res) => {
    if (req.params.slug === "brand-one") return res.json(BRAND_ONE);
    if (req.params.slug === "brand-two") return res.json(BRAND_TWO);
    return res.status(404).json({ status: 404 });
  });
  source = await new Promise<Server>((r) => {
    const srv = s.listen(0, () => r(srv));
  });
  process.env.WEB_API_BASE = `http://127.0.0.1:${(source.address() as { port: number }).port}`;

  const { createApp } = await import("../src/main.js");
  web = await new Promise<Server>((r) => {
    const srv = createApp().listen(0, () => r(srv));
  });
  base = `http://127.0.0.1:${(web.address() as { port: number }).port}`;
});

after(() => {
  web.close();
  source.close();
});

const get = (p: string) => fetch(base + p);

describe("the page is assembled from the manifest", () => {
  test("navigation shows only enabled products", async () => {
    const html = await (await get("/brand-one")).text();
    assert.match(html, />Home</);
    assert.match(html, />Vault</);
    assert.match(html, />Community</);
    assert.doesNotMatch(html, />Agents</); // agents is off — never rendered
  });

  test("a different brand renders a different nav from the same code", async () => {
    const html = await (await get("/brand-two")).text();
    assert.match(html, />Agents</); // agents on for this brand
    assert.doesNotMatch(html, />Vault</);
  });

  test("onboarding steps render for the home route", async () => {
    const html = await (await get("/brand-one")).text();
    assert.match(html, /Getting started/);
    assert.match(html, /connect_vault/);
  });

  test("the brand's own colour is applied, not an XAPPX default", async () => {
    const html = await (await get("/brand-one")).text();
    assert.match(html, /--brand-primary:\s*#FF8800/);
  });
});

describe("routes come from the manifest and nowhere else", () => {
  test("a declared route renders", async () => {
    const r = await get("/brand-one/vault");
    assert.equal(r.status, 200);
    assert.match(await r.text(), /<h1>Vault<\/h1>/);
  });

  test("a route the manifest does not declare is a 404", async () => {
    const r = await get("/brand-one/agents"); // agents off, so no such route
    assert.equal(r.status, 404);
  });

  test("an unknown brand is a 404", async () => {
    const r = await get("/no-such-brand");
    assert.equal(r.status, 404);
  });
});

describe("design system", () => {
  test("tokens.css is served and the gradient runs cyan -> violet, left to right", async () => {
    const r = await get("/tokens.css");
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-type")?.split(";")[0], "text/css");
    const css = await r.text();
    assert.match(css, /90deg/); // left to right
    assert.ok(css.indexOf("#00C2FF") < css.indexOf("#7B5EFF")); // cyan before violet, never reversed
  });
});

describe("rendering is safe", () => {
  test("a hostile label from the manifest is escaped", () => {
    const evil: Manifest = {
      ...BRAND_TWO,
      nav: [{ label: "<script>alert(1)</script>", route: "/" }],
    };
    const html = renderPage(evil, "/");
    assert.doesNotMatch(html, /<script>alert/);
    assert.match(html, /&lt;script&gt;/);
  });

  test("routeExists only accepts declared routes", () => {
    assert.equal(routeExists(BRAND_ONE, "/vault"), true);
    assert.equal(routeExists(BRAND_ONE, "/agents"), false);
  });
});
