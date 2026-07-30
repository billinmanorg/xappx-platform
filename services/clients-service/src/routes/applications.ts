import { Router } from "express";
import { withTenant } from "../db.js";
import { badRequest, notFound } from "../errors.js";
import { replay, remember } from "../idempotency.js";
import { emit } from "../outbox.js";
import { resolveManifest } from "../manifest.js";

export const applications = Router();

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TYPE = /^[a-z0-9]+(_[a-z0-9]+)*$/; // canonical type slug, e.g. small_business
const AUDIENCES = new Set(["b2c", "b2b", "b2b2c"]);

/**
 * Normalise the optional taxonomy inputs. audience_model is a closed set (the DB
 * also enforces it); application_type is open-ended per the brief ("at least
 * these" types, ending in "Custom"), so we only sanity-check its shape here.
 */
function taxonomy(b: Record<string, unknown>): { application_type: string | null; audience_model: string | null } {
  let application_type: string | null = null;
  if (b.application_type != null && String(b.application_type).trim() !== "") {
    application_type = String(b.application_type).trim();
    if (application_type.length > 64 || !TYPE.test(application_type))
      throw badRequest("application_type must be a slug like 'small_business'");
  }
  let audience_model: string | null = null;
  if (b.audience_model != null && String(b.audience_model).trim() !== "") {
    audience_model = String(b.audience_model).trim().toLowerCase();
    if (!AUDIENCES.has(audience_model))
      throw badRequest("audience_model must be one of b2c, b2b, b2b2c");
  }
  return { application_type, audience_model };
}

/**
 * Normalise the wizard's intake payload to a known, bounded shape so we never
 * store arbitrary client JSON. Unknown keys are dropped; strings are trimmed and
 * capped; roles become a short list of non-empty strings. Returns null when
 * empty so the column keeps its '{}' default.
 */
function intakeJson(raw: unknown): string | null {
  if (raw == null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const text = (v: unknown) => (v == null ? "" : String(v).trim().slice(0, 2000));
  const out: Record<string, unknown> = {};
  for (const k of ["problem", "user_goal", "admin_goal", "onboarding", "workflows"]) {
    const v = text(r[k]);
    if (v) out[k] = v;
  }
  if (Array.isArray(r.roles)) {
    const roles = r.roles.map((x) => String(x).trim()).filter(Boolean).slice(0, 40);
    if (roles.length) out.roles = roles;
  }
  return Object.keys(out).length ? JSON.stringify(out) : null;
}

/** Launch an application. Configuration only - no code is written to add one. */
applications.post("/applications", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (!b.client_id) throw badRequest("client_id is required");
    if (!b.name) throw badRequest("name is required");
    if (!SLUG.test(String(b.slug ?? "")))
      throw badRequest("slug must be lowercase words separated by hyphens");
    const tax = taxonomy(b);

    const out = await withTenant(null, async (c) => {
      const prior = await replay(c, req.header("Idempotency-Key"), b.client_id, "POST /applications", b);
      if (prior) return prior;

      const { rows } = await c.query(
        `insert into applications
           (client_id, name, slug, primary_domain, application_type, audience_model, theme, copy, taxonomy, intake)
         values ($1,$2,$3,$4,$5,$6,coalesce($7,'{}'::jsonb),coalesce($8,'{}'::jsonb),coalesce($9,'{}'::jsonb),coalesce($10,'{}'::jsonb))
         returning app_id, client_id, name, slug, primary_domain, application_type, audience_model, status, intake, manifest_version`,
        [b.client_id, b.name, b.slug, b.primary_domain ?? null, tax.application_type, tax.audience_model,
         b.theme ?? null, b.copy ?? null, b.taxonomy ?? null, intakeJson(b.intake)],
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
        `select app_id, client_id, name, slug, primary_domain, application_type, audience_model, status
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

applications.get("/applications/:slug", async (req, res, next) => {
  try {
    const app = await withTenant(null, async (c) => {
      const { rows } = await c.query(
        `select app_id, client_id, name, slug, primary_domain,
                application_type, audience_model, status, intake, manifest_version, published_at
           from applications where slug = $1`,
        [req.params.slug],
      );
      return rows[0];
    });
    if (!app) throw notFound(`Application '${req.params.slug}'`);
    res.json(app);
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
