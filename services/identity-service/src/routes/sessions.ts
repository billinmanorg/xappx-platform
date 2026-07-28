import { Router } from "express";
import { withTenant } from "../db.js";
import { Problem, badRequest, notFound } from "../errors.js";
import { replay, remember } from "../idempotency.js";

export const sessions = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TTL_HOURS = Number(process.env.SESSION_TTL_HOURS ?? 24);

/**
 * Issue a session for an ALREADY-authenticated principal.
 *
 * Authentication happens upstream — the gateway or an external identity
 * provider. This service holds no credentials; what it owns is the tenant
 * boundary. The rule this endpoint exists to get right:
 *
 *   A user who authenticated successfully but has no membership for the
 *   requested brand is NOT a failed login. Return 403 with a join path, not
 *   401, and never present it as a sign-in failure. Returning 401 here is a
 *   bug we have already shipped once.
 */
sessions.post("/sessions", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (!UUID.test(String(b.app_id ?? ""))) throw badRequest("app_id (uuid) is required");
    if (!UUID.test(String(b.user_id ?? ""))) throw badRequest("user_id (uuid) is required");
    const appId = String(b.app_id);

    const out = await withTenant(appId, async (c) => {
      const prior = await replay(c, req.header("Idempotency-Key"), appId, "POST /sessions", b);
      if (prior) return prior;

      // The brand must exist — checked against the local projection, no sync call.
      const { rows: apps } = await c.query(
        `select app_id, slug from known_applications where app_id = $1`,
        [appId],
      );
      const app = apps[0];
      if (!app) throw notFound(`Application '${appId}'`);

      // The principal is authenticated, which means the user exists. Confirm that
      // first so "no membership" is never conflated with "no such user".
      const { rows: us } = await c.query(`select user_id, status from users where user_id = $1`, [b.user_id]);
      const user = us[0];
      if (!user) throw notFound(`User '${b.user_id}'`);
      if (user.status !== "active")
        throw new Problem(403, "Account is not active",
          "This account is disabled.", "https://api.xappx.com/problems/account-disabled",
          { user_id: b.user_id });

      // Tenant resolution. Authenticated — but does this user belong to this brand?
      const { rows: ms } = await c.query(
        `select membership_id, status from memberships where user_id = $1 and app_id = $2`,
        [b.user_id, appId],
      );
      const membership = ms[0];
      if (!membership || membership.status !== "active") {
        // Authentication worked; there is simply no tenant for this user here.
        // 403 with a join path — deliberately not 401, not framed as a login failure.
        throw new Problem(
          403,
          "No membership for this brand",
          "You are signed in, but this account has no active membership for this brand. Join the brand to continue.",
          "https://api.xappx.com/problems/no-membership",
          {
            app_id: appId,
            user_id: b.user_id,
            slug: app.slug,
            join_path: "/api/v1/memberships",
            join: { method: "POST", path: "/api/v1/memberships", body: { user_id: b.user_id, app_id: appId } },
          },
        );
      }

      const { rows } = await c.query(
        `insert into sessions (user_id, app_id, expires_at)
         values ($1,$2, now() + make_interval(hours => $3))
         returning session_id, user_id, app_id, issued_at, expires_at`,
        [b.user_id, appId, TTL_HOURS],
      );
      const session = rows[0];

      await remember(c, req.header("Idempotency-Key"), appId, "POST /sessions", b, 201, session);
      return { status: 201, body: session };
    });

    res.status(out.status).json(out.body);
  } catch (e) {
    next(e);
  }
});

/** Revoke a session. Idempotent-ish: revoking an already-revoked session is a 404. */
sessions.delete("/sessions/:id", async (req, res, next) => {
  try {
    if (!UUID.test(req.params.id)) throw notFound(`Session '${req.params.id}'`);
    const revoked = await withTenant(null, async (c) => {
      const { rows } = await c.query(
        `update sessions set revoked_at = now()
          where session_id = $1 and revoked_at is null
          returning session_id`,
        [req.params.id],
      );
      return rows[0];
    });
    if (!revoked) throw notFound(`Active session '${req.params.id}'`);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
