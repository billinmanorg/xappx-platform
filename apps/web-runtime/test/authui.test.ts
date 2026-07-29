import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import express from "express";

const MANIFEST = {
  app_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  slug: "brand-one",
  version: "1",
  theme: { primary_color: "#FF8800" },
  copy: { title: "Brand One" },
  products: [{ code: "vault", enabled: true }],
  nav: [
    { label: "Home", route: "/" },
    { label: "Vault", route: "/vault", product: "vault" },
  ],
};

let manifestSrv: Server;
let identitySrv: Server;
let web: Server;
let base: string;

before(async () => {
  // Fake clients-service (manifest source).
  const m = express();
  m.get("/api/v1/applications/:slug/manifest", (req, res) =>
    req.params.slug === "brand-one" ? res.json(MANIFEST) : res.status(404).json({ status: 404 }));
  manifestSrv = await listen(m);

  // Fake identity-service: login/signup/me.
  const id = express();
  id.use(express.json());
  id.post("/api/v1/auth/login", (req, res) =>
    req.body.password === "rightpass"
      ? res.json({ token: "tok-valid", user: { user_id: "u1", email: req.body.email } })
      : res.status(401).json({ detail: "Invalid email or password." }));
  id.post("/api/v1/auth/signup", (req, res) =>
    res.status(201).json({ token: "tok-valid", user: { user_id: "u1", email: req.body.email } }));
  id.get("/api/v1/auth/me", (req, res) =>
    req.header("authorization") === "Bearer tok-valid"
      ? res.json({ user: { email: "member@example.com" } })
      : res.status(401).json({ detail: "Unauthorized" }));
  identitySrv = await listen(id);

  process.env.WEB_API_BASE = url(manifestSrv);
  process.env.IDENTITY_API_BASE = url(identitySrv);

  const { createApp } = await import("../src/main.js");
  web = await listen(createApp());
  base = url(web);
});

after(() => {
  web.close();
  manifestSrv.close();
  identitySrv.close();
});

function listen(app: express.Express): Promise<Server> {
  return new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
}
const url = (s: Server) => `http://127.0.0.1:${(s.address() as { port: number }).port}`;
const get = (p: string, h: Record<string, string> = {}) => fetch(base + p, { headers: h });
const form = (p: string, body: Record<string, string>) =>
  fetch(base + p, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
    redirect: "manual",
  });

describe("the sign-in and sign-up pages render, branded", () => {
  test("login page shows the form", async () => {
    const html = await (await get("/brand-one/login")).text();
    assert.match(html, /Sign in/);
    assert.match(html, /name="email"/);
    assert.match(html, /name="password"/);
    assert.match(html, /action="\/brand-one\/login"/);
    assert.match(html, /--brand-primary:\s*#FF8800/); // the brand's colour, not XAPPX
  });

  test("signup page shows the form", async () => {
    const html = await (await get("/brand-one/signup")).text();
    assert.match(html, /Create your account/);
    assert.match(html, /name="name"/);
  });

  test("login for an unknown brand is a 404", async () => {
    assert.equal((await get("/no-such-brand/login")).status, 404);
  });
});

describe("logging in sets a session and redirects", () => {
  test("correct credentials set the cookie and redirect to the brand", async () => {
    const r = await form("/brand-one/login", { email: "a@b.co", password: "rightpass" });
    assert.equal(r.status, 302);
    assert.equal(r.headers.get("location"), "/brand-one");
    assert.match(r.headers.get("set-cookie") ?? "", /xappx_session=tok-valid/);
  });

  test("wrong credentials re-render the form with an error, no cookie", async () => {
    const r = await form("/brand-one/login", { email: "a@b.co", password: "wrong" });
    assert.equal(r.status, 401);
    assert.doesNotMatch(r.headers.get("set-cookie") ?? "", /xappx_session/);
    assert.match(await r.text(), /Invalid email or password/);
  });

  test("signup sets a session and redirects", async () => {
    const r = await form("/brand-one/signup", { email: "new@b.co", password: "password123" });
    assert.equal(r.status, 302);
    assert.match(r.headers.get("set-cookie") ?? "", /xappx_session=tok-valid/);
  });
});

describe("the brand page reflects the session", () => {
  test("a valid session cookie shows the member and a log-out", async () => {
    const html = await (await get("/brand-one", { cookie: "xappx_session=tok-valid" })).text();
    assert.match(html, /member@example.com/);
    assert.match(html, /Log out/);
  });

  test("no cookie shows log in and sign up", async () => {
    const html = await (await get("/brand-one")).text();
    assert.match(html, />Log in</);
    assert.match(html, />Sign up</);
    assert.doesNotMatch(html, /Log out/);
  });

  test("logout clears the cookie and redirects", async () => {
    const r = await form("/brand-one/logout", {});
    assert.equal(r.status, 302);
    assert.equal(r.headers.get("location"), "/brand-one");
    assert.match(r.headers.get("set-cookie") ?? "", /xappx_session=;|Expires=Thu, 01 Jan 1970/);
  });
});
