import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { createApp } from "../src/main.js";
import { pool } from "../src/db.js";
import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "../src/password.js";
import { signJwt, verifyJwt } from "../src/jwt.js";

const RUN = randomUUID().slice(0, 8);
const SECRET = "test-auth-secret-0123456789-abcdef";
const ISS = "https://auth.xappx.com";
const AUD = "xappx-api";

let server: Server;
let base: string;

before(async () => {
  process.env.AUTH_JWT_SECRET = SECRET;
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
});
after(async () => {
  server.close();
  await pool.end();
});

const send = (m: string, p: string, body: unknown, h: Record<string, string> = {}) =>
  fetch(base + p, { method: m, headers: { "content-type": "application/json", ...h }, body: JSON.stringify(body) });
const get = (p: string, h: Record<string, string> = {}) => fetch(base + p, { headers: h });

describe("password hashing", () => {
  test("round-trips, rejects the wrong password, and is salted", async () => {
    const h = await hashPassword("correct horse battery");
    assert.equal(await verifyPassword("correct horse battery", h), true);
    assert.equal(await verifyPassword("wrong", h), false);
    assert.notEqual(h, await hashPassword("correct horse battery")); // fresh salt each time
    assert.match(h, /^scrypt\$/);
  });
});

describe("jwt", () => {
  test("signs and verifies, and rejects tampering, wrong secret, wrong issuer, and expiry", () => {
    const t = signJwt({ sub: "u1", email: "a@b.co", iss: ISS, aud: AUD }, SECRET, 3600);
    assert.equal(verifyJwt(t, SECRET, { iss: ISS, aud: AUD })?.sub, "u1");
    assert.equal(verifyJwt(t, "wrong-secret", { iss: ISS, aud: AUD }), null);
    assert.equal(verifyJwt(t + "x", SECRET, { iss: ISS, aud: AUD }), null);
    assert.equal(verifyJwt(t, SECRET, { iss: "someone-else", aud: AUD }), null);
    const expired = signJwt({ sub: "u1", iss: ISS, aud: AUD }, SECRET, -10);
    assert.equal(verifyJwt(expired, SECRET, { iss: ISS, aud: AUD }), null);
  });
});

describe("signup creates an account and a working token", () => {
  test("a new account gets a token whose subject is the new user, and only a hash is stored", async () => {
    const email = `signup-${RUN}@example.com`;
    const r = await send("POST", "/auth/signup", { email, password: "s3cret-password", name: "Ada" });
    assert.equal(r.status, 201);
    const body = await r.json();
    assert.ok(body.user.user_id);
    assert.equal(body.token_type, "Bearer");

    const claims = verifyJwt(body.token, SECRET, { iss: ISS, aud: AUD });
    assert.equal(claims?.sub, body.user.user_id);
    assert.equal(claims?.email, email);

    const { rows } = await pool.query(`select password_hash from credentials where user_id = $1`, [body.user.user_id]);
    assert.match(rows[0].password_hash, /^scrypt\$/);
    assert.doesNotMatch(rows[0].password_hash, /s3cret-password/); // never the plaintext
  });

  test("a duplicate email is a 409", async () => {
    const email = `dup-${RUN}@example.com`;
    assert.equal((await send("POST", "/auth/signup", { email, password: "password123" })).status, 201);
    assert.equal((await send("POST", "/auth/signup", { email, password: "password123" })).status, 409);
  });

  test("a short password is refused", async () => {
    const r = await send("POST", "/auth/signup", { email: `short-${RUN}@example.com`, password: "short" });
    assert.equal(r.status, 400);
  });
});

describe("login verifies the password", () => {
  test("correct login returns a token; wrong password and unknown email are both a generic 401", async () => {
    const email = `login-${RUN}@example.com`;
    await send("POST", "/auth/signup", { email, password: "right-password" });

    assert.equal((await send("POST", "/auth/login", { email, password: "right-password" })).status, 200);
    assert.equal((await send("POST", "/auth/login", { email, password: "wrong-password" })).status, 401);
    assert.equal((await send("POST", "/auth/login", { email: `nobody-${RUN}@example.com`, password: "x" })).status, 401);
  });

  test("a disabled account cannot log in", async () => {
    const email = `disabled-${RUN}@example.com`;
    const s = await (await send("POST", "/auth/signup", { email, password: "password123" })).json();
    await send("PUT", `/users/${s.user.user_id}`, { status: "disabled" });
    assert.equal((await send("POST", "/auth/login", { email, password: "password123" })).status, 403);
  });
});

describe("/auth/me reads the token back into a user", () => {
  test("valid token returns the user; missing or bad token is 401", async () => {
    const email = `me-${RUN}@example.com`;
    const s = await (await send("POST", "/auth/signup", { email, password: "password123" })).json();

    const me = await get("/auth/me", { authorization: `Bearer ${s.token}` });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.email, email);

    assert.equal((await get("/auth/me")).status, 401);
    assert.equal((await get("/auth/me", { authorization: "Bearer garbage.token.here" })).status, 401);
  });
});
