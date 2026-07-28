import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { Server } from "node:http";
import express from "express";
import { SignJWT } from "jose";
import { durationMs, matchRoute, rateRuleFor, loadConfig } from "../src/config.js";
import { RateLimiter } from "../src/rateLimit.js";

// Fixed brand the fake clients-service serves.
const APP = "11111111-1111-1111-1111-111111111111";
const CLIENT = "22222222-2222-2222-2222-222222222222";
const USER = "33333333-3333-3333-3333-333333333333";
const SLUG = "brandx";
const DOMAIN = "brandx.test";
const SECRET = "test-secret-0123456789-abcdefghij";
const ISSUER = "https://auth.xappx.com";
const AUDIENCE = "xappx-api";

let clients: Server; // fake clients-service (directory + manifest)
let echo: Server; // fake downstream — echoes what it received
let gateway: Server;
let gwBase: string;

function listen(app: express.Express): Promise<Server> {
  return new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
}
const portOf = (s: Server) => (s.address() as { port: number }).port;

before(async () => {
  // Fake clients-service.
  const c = express();
  c.get("/api/v1/applications", (_req, res) =>
    res.json({ data: [{ app_id: APP, client_id: CLIENT, slug: SLUG, primary_domain: DOMAIN, status: "published" }] }),
  );
  c.get("/api/v1/applications/:slug/manifest", (req, res) => {
    if (req.params.slug !== SLUG) return res.status(404).type("application/problem+json").json({ status: 404 });
    res.json({
      app_id: APP, slug: SLUG, version: "1",
      products: [
        { code: "vault", enabled: true },
        { code: "agents", enabled: false },
        { code: "community", enabled: true },
      ],
    });
  });
  clients = await listen(c);

  // Fake downstream echo.
  const e = express();
  e.use(express.json());
  e.use((req, res) => res.json({ method: req.method, url: req.originalUrl, headers: req.headers }));
  echo = await listen(e);

  const echoUrl = `http://127.0.0.1:${portOf(echo)}`;
  process.env.CLIENTS_SERVICE_URL = `http://127.0.0.1:${portOf(clients)}`;
  process.env.IDENTITY_SERVICE_URL = echoUrl;
  process.env.VAULT_SERVICE_URL = echoUrl;
  process.env.AGENTS_SERVICE_URL = echoUrl;
  process.env.GATEWAY_JWT_TEST_SECRET = SECRET;

  const { createApp } = await import("../src/main.js");
  gateway = await listen(createApp(loadConfig()));
  gwBase = `http://127.0.0.1:${portOf(gateway)}`;
});

after(() => {
  gateway.close();
  echo.close();
  clients.close();
});

const get = (p: string, h: Record<string, string> = {}) => fetch(gwBase + p, { headers: h });

/** Raw GET so we can set a Host header (fetch forbids it) to exercise host resolution. */
function rawGet(path: string, host: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const r = http.request(
      { host: "127.0.0.1", port: portOf(gateway), path, method: "GET", headers: { Host: host } },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: d ? JSON.parse(d) : null }));
      },
    );
    r.on("error", reject);
    r.end();
  });
}

async function mintToken(secret = SECRET): Promise<string> {
  return new SignJWT({ app_id: APP })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(USER)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(secret));
}

describe("config parsing", () => {
  test("durations parse to milliseconds", () => {
    assert.equal(durationMs("60s"), 60_000);
    assert.equal(durationMs("1m"), 60_000);
    assert.equal(durationMs("500ms"), 500);
  });
  test("routes.yaml loads and the AI route has a tighter rate limit", () => {
    const cfg = loadConfig();
    assert.equal(cfg.listen, 8080);
    assert.equal(matchRoute(cfg, "/api/v1/users")?.service, "identity-service");
    assert.equal(matchRoute(cfg, "/api/v1/vaults/abc")?.requires_product, "vault");
    assert.equal(matchRoute(cfg, "/nope"), null);
    assert.equal(rateRuleFor(cfg, "/api/v1/ai/chat").requests, 60);
    assert.equal(rateRuleFor(cfg, "/api/v1/users").requests, 600);
  });
});

describe("rate limiter", () => {
  test("allows up to the limit, then blocks, then resets", () => {
    const rl = new RateLimiter();
    assert.equal(rl.check("k", 2, 60_000).allowed, true);
    assert.equal(rl.check("k", 2, 60_000).allowed, true);
    assert.equal(rl.check("k", 2, 60_000).allowed, false);
    assert.equal(rl.check("other", 2, 60_000).allowed, true); // separate key, separate budget
  });
});

describe("tenant resolution", () => {
  test("resolves by X-App-Slug and forwards X-App-Id and X-Client-Id", async () => {
    const r = await get("/api/v1/users", { "X-App-Slug": SLUG });
    assert.equal(r.status, 200);
    const echoed = await r.json();
    assert.equal(echoed.headers["x-app-id"], APP);
    assert.equal(echoed.headers["x-client-id"], CLIENT);
    assert.ok(echoed.headers["x-correlation-id"]);
    assert.equal(echoed.headers["x-user-id"], undefined); // anonymous — no user forwarded
  });

  test("resolves by Host header", async () => {
    const r = await rawGet("/api/v1/users", DOMAIN);
    assert.equal(r.status, 200);
    assert.equal(r.body.headers["x-app-id"], APP);
  });

  test("resolves by JWT app_id claim and forwards X-User-Id from sub", async () => {
    const token = await mintToken();
    const r = await get("/api/v1/users", { authorization: `Bearer ${token}` });
    assert.equal(r.status, 200);
    const echoed = await r.json();
    assert.equal(echoed.headers["x-app-id"], APP);
    assert.equal(echoed.headers["x-user-id"], USER);
  });

  test("no resolvable tenant is a 403, per on_missing", async () => {
    const r = await get("/api/v1/users"); // no host match, no slug, no token
    assert.equal(r.status, 403);
    assert.equal(r.headers.get("content-type")?.split(";")[0], "application/problem+json");
    assert.equal((await r.json()).type, "https://api.xappx.com/problems/tenant-unresolved");
  });
});

describe("authentication", () => {
  test("an invalid bearer token is a 401", async () => {
    const bad = await mintToken("a-different-secret-that-will-not-verify");
    const r = await get("/api/v1/users", { authorization: `Bearer ${bad}`, "X-App-Slug": SLUG });
    assert.equal(r.status, 401);
    assert.equal((await r.json()).type, "https://api.xappx.com/problems/unauthorized");
  });
});

describe("product gate", () => {
  test("an enabled product is allowed through", async () => {
    const r = await get("/api/v1/vaults", { "X-App-Slug": SLUG }); // vault is enabled
    assert.equal(r.status, 200);
    assert.equal((await r.json()).headers["x-app-id"], APP);
  });

  test("a disabled product is refused with a 403 problem document", async () => {
    const r = await get("/api/v1/agents", { "X-App-Slug": SLUG }); // agents is disabled
    assert.equal(r.status, 403);
    const p = await r.json();
    assert.equal(p.type, "https://api.xappx.com/problems/product-disabled");
    assert.equal(p.product, "agents");
  });
});

describe("routing and correlation", () => {
  test("an unknown route is a 404 problem document", async () => {
    const r = await get("/not/a/route", { "X-App-Slug": SLUG });
    assert.equal(r.status, 404);
    assert.equal(r.headers.get("content-type")?.split(";")[0], "application/problem+json");
  });

  test("a supplied correlation id is echoed back and forwarded downstream", async () => {
    const cid = "corr-test-123";
    const r = await get("/api/v1/users", { "X-App-Slug": SLUG, "X-Correlation-Id": cid });
    assert.equal(r.headers.get("x-correlation-id"), cid);
    assert.equal((await r.json()).headers["x-correlation-id"], cid);
  });
});
