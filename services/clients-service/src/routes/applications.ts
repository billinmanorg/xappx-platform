import { Router } from "express";
import { withTenant } from "../db.js";
import { badRequest, notFound } from "../errors.js";
import { replay, remember } from "../idempotency.js";
import { emit } from "../outbox.js";
import { resolveManifest } from "../manifest.js";

export const applications = Router();

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Launch a brand. Configuration only - no code is written to add one. */
applications.post("/applications", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (!b.client_id) throw badRequest("client_id is required");
    if (!b.name) throw badRequest("name is required");
    if (!SLUG.test(String(b.slug ?? "")))
      throw badRequest("slug must be lowercase words separated by hyphens");

    const out = await withTenant(null, async (c) => {
      const prior = await replay(c, req.header("Idempotency-Key"), b.client_id, "POST /applications", b);
      if (prior) return prior;

      const { rows } = await c.query(
        `insert into applications (client_id, name, slug, primary_domain, theme, copy, taxonomy)
         values ($1,$2,$3,$4,coalesce($5,'{}'::jsonb),coalesce($6,'{}'::jsonb),coalesce($7,'{}'::jsonb))
         returning app_id, client_id, name, slug, primary_domain, status, manifest_version`,
        [b.client_id, b.name, b.slug, b.primary_domain ?? null, b.theme ?? null, b.copy ?? null, b.taxonomy ?? null],
      );
      const app = rows[0];

      // Products requested at creation, enabled in dependency order so that
      // asking for vault_premium without vault fails loudly rather than half-applying.
      for (const code of (b.products ?? []) as string[]) {
        await c.query(
          `insert into app_products (app_id, product_code, enabled) values ($1,$2,true)
           on conflict (app_id, product_code) do update set enabled = true`,
          [app.app_id, code],
        );
      }

      await emit(c, {
        aggregate: "application",
        type: "com.xappx.application.created",
        subject: `application:${app.app_id}`,
        appId: app.app_id,
        correlationId: req.correlationId,
        data: { app_id: app.app_id, slug: app.slug, client_id: app.client_id },
      });

      const result = { status: 201, body: app };
      await remember(c, req.header("Idempotency-Key"), b.client_id, "POST /applications", b, 201, app);
      return result;
    });

    res.status(out.status).json(out.body);
  } catch (e) {
    next(e);
  }
});

applications.get("/applications", async (req, res, next) => {
  try {
    const rows = await withTenant(null, async (c) => {
      const { rows } = await c.query(
        `select app_id, client_id, name, slug, primary_domain, status
           from applications
          where ($1::uuid is null or client_id = $1)
          order by name`,
        [req.query.client_id ?? null],
      );
      return rows;
    });
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

applications.get("/applications/:slug/manifest", async (req, res, next) => {
  try {
    const m = await withTenant(null, (c) => resolveManifest(c, req.params.slug));
    // The version changes on every toggle change, so the ETag invalidates itself.
    res.set("ETag", `W/"${m.app_id}-${m.version}"`);
    res.set("Cache-Control", "public, max-age=60");
    if (req.header("If-None-Match") === `W/"${m.app_id}-${m.version}"`) return res.status(304).end();
    res.json(m);
  } catch (e) {
    next(e);
  }
});

applications.post("/applications/:slug/publish", async (req, res, next) => {
  try {
    const app = await withTenant(null, async (c) => {
      const { rows } = await c.query(
        `update applications set status='published', published_at=now()
          where slug=$1 returning app_id, slug, status, primary_domain`,
        [req.params.slug],
      );
      if (!rows[0]) throw notFound(`Application '${req.params.slug}'`);
      await emit(c, {
        aggregate: "application",
        type: "com.xappx.application.published",
        subject: `application:${rows[0].app_id}`,
        appId: rows[0].app_id,
        correlationId: req.correlationId,
        data: { app_id: rows[0].app_id, slug: rows[0].slug },
      });
      return rows[0];
    });
    res.json(app);
  } catch (e) {
    next(e);
  }
});
