import { Router } from "express";
import { withTenant } from "../db.js";
import { badRequest, conflict, unauthorized, forbidden, Problem } from "../errors.js";
import { emit } from "../outbox.js";
import { hashPassword, verifyPassword } from "../password.js";
import { signJwt, verifyJwt } from "../jwt.js";

/**
 * Real authentication. Sign up creates a user + password credential and returns
 * a bearer token; sign in verifies the password and returns one; /auth/me reads
 * the token back into a user. The token is what the gateway verifies at the edge.
 *
 * AUTH CODE — must not be reviewed only by Claude Code. Notes for the reviewer:
 *  - Passwords are scrypt-hashed (password.ts); the plaintext is never stored or logged.
 *  - Sign-in returns one generic 401 for a bad email OR a bad password, and runs a
 *    hash even when the user is unknown, so it does not leak which accounts exist.
 *  - Tokens are stateless (short-lived). Server-side revocation (refresh tokens /
 *    a denylist) is a deliberate follow-up, called out below.
 */
export const auth = Router();

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD = 8;
const ISSUER = process.env.AUTH_JWT_ISSUER ?? "https://auth.xappx.com";
const AUDIENCE = process.env.AUTH_JWT_AUDIENCE ?? "xappx-api";
const TTL = Number(process.env.AUTH_JWT_TTL_SECONDS ?? 3600);

function secret(): string {
  const s = process.env.AUTH_JWT_SECRET ?? process.env.GATEWAY_JWT_TEST_SECRET;
  if (!s) throw new Problem(500, "Auth is not configured", "AUTH_JWT_SECRET is not set on this service.");
  return s;
}

function tokenFor(userId: string, email: string) {
  const token = signJwt({ sub: userId, email, iss: ISSUER, aud: AUDIENCE }, secret(), TTL);
  return { token, token_type: "Bearer", expires_in: TTL };
}

const bearer = (h: string | undefined): string | null => {
  const m = /^Bearer (.+)$/i.exec(h ?? "");
  return m ? (m[1] as string).trim() : null;
};

// Equalises sign-in timing for unknown accounts: verify against this instead of
// returning early, so "no such user" and "wrong password" take the same time.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword("not-a-real-password"));

auth.post("/auth/signup", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const email = String(b.email ?? "").trim();
    const password = String(b.password ?? "");
    if (!EMAIL.test(email)) throw badRequest("A valid email is required.");
    if (password.length < MIN_PASSWORD) throw badRequest(`Password must be at least ${MIN_PASSWORD} characters.`);

    const hash = await hashPassword(password);

    const user = await withTenant(null, async (c) => {
      let created;
      try {
        const { rows } = await c.query(
          `insert into users (email, name, auth_provider) values ($1,$2,'password')
           returning user_id, email, name, status, created_at`,
          [email, b.name ?? null],
        );
        created = rows[0];
      } catch (e: any) {
        if (e?.code === "23505")
          throw conflict("An account with this email already exists.",
            "https://api.xappx.com/problems/user-exists", { email });
        throw e;
      }
      await c.query(`insert into credentials (user_id, password_hash) values ($1,$2)`, [created.user_id, hash]);
      await emit(c, {
        aggregate: "user",
        type: "com.xappx.user.created",
        subject: `user:${created.user_id}`,
        correlationId: req.correlationId,
        data: { user_id: created.user_id, email: created.email },
      });
      return created;
    });

    res.status(201).json({ user, ...tokenFor(user.user_id, user.email) });
  } catch (e) {
    next(e);
  }
});

auth.post("/auth/login", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const email = String(b.email ?? "").trim();
    const password = String(b.password ?? "");
    if (!email || !password) throw badRequest("Email and password are required.");

    const found = await withTenant(null, async (c) => {
      const { rows } = await c.query(
        `select u.user_id, u.email, u.name, u.status, cr.password_hash
           from users u left join credentials cr on cr.user_id = u.user_id
          where u.email = $1`,
        [email],
      );
      return rows[0] as
        | { user_id: string; email: string; name: string | null; status: string; password_hash: string | null }
        | undefined;
    });

    // Always run a verification so the response time does not reveal whether the
    // account exists or has a password set.
    const ok = await verifyPassword(password, found?.password_hash ?? (await getDummyHash()));
    if (!found || !found.password_hash || !ok) {
      throw unauthorized("Invalid email or password.");
    }
    if (found.status !== "active") throw forbidden("This account is not active.");

    res.json({
      user: { user_id: found.user_id, email: found.email, name: found.name, status: found.status },
      ...tokenFor(found.user_id, found.email),
    });
  } catch (e) {
    next(e);
  }
});

auth.get("/auth/me", async (req, res, next) => {
  try {
    const token = bearer(req.header("authorization"));
    if (!token) throw unauthorized("A bearer token is required.");
    const claims = verifyJwt(token, secret(), { iss: ISSUER, aud: AUDIENCE });
    if (!claims) throw unauthorized("The token is invalid or expired.");

    const user = await withTenant(null, async (c) => {
      const { rows } = await c.query(
        `select user_id, email, name, status, created_at from users where user_id = $1`,
        [claims.sub],
      );
      return rows[0];
    });
    if (!user) throw unauthorized("The token does not match a user.");
    res.json({ user });
  } catch (e) {
    next(e);
  }
});

// Tokens are stateless, so logout is a client-side discard. The endpoint exists
// so the front end has one URL to call; real server-side revocation (refresh
// tokens + a denylist) is the documented follow-up.
auth.post("/auth/logout", (_req, res) => {
  res.json({ ok: true, detail: "Discard the token on the client. Server-side revocation is not yet implemented." });
});
