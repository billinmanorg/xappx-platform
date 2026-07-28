import { Router } from "express";
import { withTenant } from "../db.js";
import { badRequest, conflict, notFound } from "../errors.js";
import { emit } from "../outbox.js";

export const products = Router();

/** How many people are paying for this product right now, per billing-service. */
async function activeSubscribers(appId: string, code: string): Promise<number | null> {
  const base = process.env.BILLING_SERVICE_URL;
  if (!base) return null; // billing not wired yet: caller decides what to do
  try {
    const r = await fetch(`${base}/internal/subscribers?app_id=${appId}&product_code=${code}`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { subscriber_count?: number };
    return j.subscriber_count ?? 0;
  } catch {
    return null; // treat an unreachable dependency as unknown, never as zero
  }
}

products.get("/applications/:slug/products", async (req, res, next) => {
  try {
    const rows = await withTenant(null, async (c) => {
      const { rows: apps } = await c.query(`select app_id from applications where slug=$1`, [
        req.params.slug,
      ]);
      if (!apps[0]) throw notFound(`Application '${req.params.slug}'`);
      const { rows } = await c.query(
        `select p.code, p.name, p.requires, p.billable,
                coalesce(ap.enabled,false) as enabled, ap.display_name, ap.changed_at
           from products p
           left join app_products ap on ap.product_code=p.code and ap.app_id=$1
          order by p.code`,
        [apps[0].app_id],
      );
      return rows;
    });
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

/**
 * The toggle. Turning a product off is not destructive: subscriber files enter
 * a retention window rather than disappearing, and the caller has to
 * acknowledge affected subscribers before the switch flips.
 */
products.put("/applications/:slug/products/:code", async (req, res, next) => {
  try {
    const enabled = req.body?.enabled;
    if (typeof enabled !== "boolean") throw badRequest("enabled must be true or false");

    const appId = await withTenant(null, async (c) => {
      const { rows } = await c.query(`select app_id from applications where slug=$1`, [req.params.slug]);
      if (!rows[0]) throw notFound(`Application '${req.params.slug}'`);
      return rows[0].app_id as string;
    });

    if (!enabled) {
      const count = await activeSubscribers(appId, req.params.code);
      if (count === null && process.env.BILLING_SERVICE_URL) {
        throw conflict(
          "Cannot confirm whether anyone is paying for this product: billing is unreachable. Try again.",
          "https://api.xappx.com/problems/subscriber-check-unavailable",
        );
      }
      if (count && count > 0 && req.body?.override_active_subscribers !== true) {
        throw conflict(
          `${count} active subscriber(s) are paying for this product. Set override_active_subscribers to proceed; their files enter the retention window rather than being deleted.`,
          "https://api.xappx.com/problems/active-subscribers",
          { subscriber_count: count, product_code: req.params.code },
        );
      }
    }

    const row = await withTenant(appId, async (c) => {
      try {
        const { rows } = await c.query(
          `insert into app_products (app_id, product_code, enabled, display_name, changed_by)
           values ($1,$2,$3,$4,$5)
           on conflict (app_id, product_code) do update
             set enabled = excluded.enabled,
                 display_name = coalesce(excluded.display_name, app_products.display_name),
                 changed_by = excluded.changed_by
           returning product_code, enabled, display_name, changed_at`,
          [appId, req.params.code, enabled, req.body?.display_name ?? null, req.body?.changed_by ?? null],
        );

        await emit(c, {
          aggregate: "application",
          type: enabled
            ? "com.xappx.application.product.enabled"
            : "com.xappx.application.product.disabled",
          subject: `application:${appId}`,
          appId,
          correlationId: req.correlationId,
          data: {
            app_id: appId,
            product_code: req.params.code,
            changed_by: req.body?.changed_by ?? null,
            grace_period_days: enabled ? undefined : Number(req.body?.grace_period_days ?? 180),
          },
        });
        return rows[0];
      } catch (e: any) {
        // The dependency rules live in the database, so they hold for every
        // caller. Translate them into something an API client can act on.
        if (typeof e?.message === "string" && /requires|depends on it/.test(e.message)) {
          throw conflict(e.message, "https://api.xappx.com/problems/product-dependency", {
            product_code: req.params.code,
          });
        }
        throw e;
      }
    });

    res.json(row);
  } catch (e) {
    next(e);
  }
});
