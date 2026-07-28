import { Router } from "express";
import { withTenant } from "../db.js";
import { badRequest } from "../errors.js";
import { replay, remember } from "../idempotency.js";
import { requireAppId } from "../tenant.js";

export const engagements = Router();

/**
 * Per-user action history, one table, reported per brand. Scoped by the tenant
 * context via current_app_id() so it holds whether or not the connecting role
 * bypasses RLS; forgetting withTenant yields an empty result, never another
 * brand's rows.
 */
engagements.post("/engagements", async (req, res, next) => {
  try {
    const appId = requireAppId((n) => req.header(n), req.body?.app_id);
    const b = req.body ?? {};
    if (typeof b.action !== "string" || !b.action.trim()) throw badRequest("action is required");

    const out = await withTenant(appId, async (c) => {
      const prior = await replay(c, req.header("Idempotency-Key"), appId, "POST /engagements", b);
      if (prior) return prior;

      const { rows } = await c.query(
        `insert into engagements (app_id, user_id, subject_type, subject_id, action, duration_ms, metadata)
         values ($1,$2,$3,$4,$5,$6,coalesce($7,'{}'::jsonb))
         returning engagement_id, app_id, user_id, subject_type, subject_id, action, duration_ms, occurred_at`,
        [appId, b.user_id ?? null, b.subject_type ?? null, b.subject_id ?? null,
         b.action, b.duration_ms ?? null, JSON.stringify(b.metadata ?? {})],
      );
      const row = rows[0];
      await remember(c, req.header("Idempotency-Key"), appId, "POST /engagements", b, 201, row);
      return { status: 201, body: row };
    });

    res.status(out.status).json(out.body);
  } catch (e) {
    next(e);
  }
});

engagements.get("/engagements", async (req, res, next) => {
  try {
    const appId = requireAppId((n) => req.header(n), req.query.app_id);
    const userId = req.query.user_id ? String(req.query.user_id) : null;
    const rows = await withTenant(appId, async (c) => {
      const { rows } = await c.query(
        `select engagement_id, app_id, user_id, subject_type, subject_id, action, duration_ms, occurred_at
           from engagements
          where app_id = current_app_id()
            and ($1::uuid is null or user_id = $1)
          order by occurred_at desc`,
        [userId],
      );
      return rows;
    });
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});
