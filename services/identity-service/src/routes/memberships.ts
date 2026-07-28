import { Router } from "express";
import { withTenant } from "../db.js";
import { badRequest, conflict, notFound } from "../errors.js";
import { replay, remember } from "../idempotency.js";
import { emit } from "../outbox.js";

export const memberships = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Create a per-brand membership. A membership for a brand this service has never
 * seen is rejected using the local known_applications projection — no
 * synchronous call to clients-service. The write runs in the brand's tenant
 * context so RLS applies to the insert.
 */
memberships.post("/memberships", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (!UUID.test(String(b.user_id ?? ""))) throw badRequest("user_id (uuid) is required");
    if (!UUID.test(String(b.app_id ?? ""))) throw badRequest("app_id (uuid) is required");
    const appId = String(b.app_id);

    const out = await withTenant(appId, async (c) => {
      const prior = await replay(c, req.header("Idempotency-Key"), appId, "POST /memberships", b);
      if (prior) return prior;

      const { rows: apps } = await c.query(
        `select app_id, client_id from known_applications where app_id = $1`,
        [appId],
      );
      if (!apps[0]) throw notFound(`Application '${appId}'`);
      const clientId = b.client_id ?? apps[0].client_id;

      // The user is global; validate its existence at the edge (no cross-service FK).
      const { rows: us } = await c.query(`select user_id from users where user_id = $1`, [b.user_id]);
      if (!us[0]) throw notFound(`User '${b.user_id}'`);

      let membership;
      try {
        const { rows } = await c.query(
          `insert into memberships (user_id, client_id, app_id, role_id, status)
           values ($1,$2,$3,$4,coalesce($5,'active'))
           returning membership_id, user_id, client_id, app_id, role_id, status, joined_at`,
          [b.user_id, clientId, appId, b.role_id ?? null, b.status ?? null],
        );
        membership = rows[0];
      } catch (e: any) {
        // unique (user_id, app_id) — one membership per user per brand.
        if (e?.code === "23505")
          throw conflict("This user already has a membership for this brand.",
            "https://api.xappx.com/problems/membership-exists", { user_id: b.user_id, app_id: appId });
        throw e;
      }

      await emit(c, {
        aggregate: "membership",
        type: "com.xappx.membership.created",
        subject: `membership:${membership.membership_id}`,
        appId,
        correlationId: req.correlationId,
        data: {
          membership_id: membership.membership_id,
          user_id: membership.user_id,
          app_id: membership.app_id,
          client_id: membership.client_id,
        },
      });

      await remember(c, req.header("Idempotency-Key"), appId, "POST /memberships", b, 201, membership);
      return { status: 201, body: membership };
    });

    res.status(out.status).json(out.body);
  } catch (e) {
    next(e);
  }
});

/**
 * List memberships for one brand. Scoped by the tenant context via
 * current_app_id() — which is also what the RLS policy enforces, so it holds
 * whether or not the connecting role bypasses RLS. Forgetting withTenant leaves
 * current_app_id() null and yields an empty result, never another brand's rows.
 */
memberships.get("/memberships", async (req, res, next) => {
  try {
    const appId = req.query.app_id ? String(req.query.app_id) : "";
    if (!UUID.test(appId)) throw badRequest("app_id query parameter (uuid) is required");

    const rows = await withTenant(appId, async (c) => {
      const { rows } = await c.query(
        `select membership_id, user_id, client_id, app_id, role_id, status, joined_at
           from memberships
          where app_id = current_app_id()
          order by joined_at desc`,
      );
      return rows;
    });
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});
