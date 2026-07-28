import { Router } from "express";
import { withTenant } from "../db.js";
import { badRequest } from "../errors.js";
import { replay, remember } from "../idempotency.js";
import { requireAppId } from "../tenant.js";

export const webhooks = Router();

/** Register an outbound webhook for the current brand. */
webhooks.post("/webhooks", async (req, res, next) => {
  try {
    const appId = requireAppId((n) => req.header(n), req.body?.app_id);
    const b = req.body ?? {};
    if (typeof b.url !== "string" || !/^https?:\/\//.test(b.url))
      throw badRequest("url must be an http(s) URL");
    const eventTypes: string[] = Array.isArray(b.event_types) ? b.event_types.map(String) : [];

    const out = await withTenant(appId, async (c) => {
      const prior = await replay(c, req.header("Idempotency-Key"), appId, "POST /webhooks", b);
      if (prior) return prior;

      const { rows } = await c.query(
        `insert into webhooks (app_id, url, secret_ref, event_types)
         values ($1,$2,$3,$4)
         returning webhook_id, app_id, url, event_types, active, created_at`,
        [appId, b.url, b.secret_ref ?? "", eventTypes],
      );
      const hook = rows[0];
      await remember(c, req.header("Idempotency-Key"), appId, "POST /webhooks", b, 201, hook);
      return { status: 201, body: hook };
    });

    res.status(out.status).json(out.body);
  } catch (e) {
    next(e);
  }
});

/** List the current brand's webhooks. */
webhooks.get("/webhooks", async (req, res, next) => {
  try {
    const appId = requireAppId((n) => req.header(n), req.query.app_id);
    const rows = await withTenant(appId, async (c) => {
      const { rows } = await c.query(
        `select webhook_id, app_id, url, event_types, active, created_at
           from webhooks where app_id = $1 order by created_at desc`,
        [appId],
      );
      return rows;
    });
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});
