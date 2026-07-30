import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";
import * as api from "./api.js";
import { dashboardPage, appsPage, newPage, editPage, errorPage, isKnownType, isAudienceModel, type FactoryStats } from "./render.js";

/**
 * A shared-password gate. The console can create and configure applications, so
 * it must not be openly reachable on a public URL. When FACTORY_USER/PASS are set
 * it requires HTTP Basic Auth; unset (local dev) it stays open.
 *
 * Deliberately minimal — one shared credential, NOT the platform's role-based
 * auth. It is auth code and should be reviewed. Role-based sign-in is planned.
 */
function timingEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function basicAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = process.env.FACTORY_USER;
  const pass = process.env.FACTORY_PASS;
  if (!user || !pass) return next();
  const match = /^Basic (.+)$/.exec(req.header("authorization") ?? "");
  if (match) {
    const decoded = Buffer.from(match[1] ?? "", "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    const u = sep === -1 ? decoded : decoded.slice(0, sep);
    const p = sep === -1 ? "" : decoded.slice(sep + 1);
    if (timingEqual(u, user) && timingEqual(p, pass)) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="XAPPX Factory", charset="UTF-8"');
  res.status(401).type("text/plain").send("Authentication required.");
}

const TOKENS =
  process.env.WEB_TOKENS_CSS ??
  fileURLToPath(new URL("../../../../packages/design-system/tokens.css", import.meta.url));

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * The XAPPX Factory console. Server-rendered screens over the platform's public
 * API; it holds no database. Forms POST and redirect (Post/Redirect/Get).
 */
export function createApp() {
  const app = express();
  app.use(express.urlencoded({ extended: false }));

  app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
  app.use(basicAuth);

  app.get("/tokens.css", (_req, res) => {
    try {
      res.type("text/css").send(readFileSync(TOKENS, "utf8"));
    } catch {
      res.status(500).type("text/css").send("/* tokens unavailable */");
    }
  });

  // ---- dashboard (home) ----
  app.get("/", async (_req, res, next) => {
    try {
      const [appsR, clientsR, catalog] = await Promise.all([
        api.listApplications(),
        api.listClients(),
        loadCatalog(),
      ]);
      const apps = appsR.data?.data ?? [];
      const stats: FactoryStats = {
        totalApps: apps.length,
        published: apps.filter((a) => a.status === "published").length,
        drafts: apps.filter((a) => a.status === "draft").length,
        otherStatus: apps.filter((a) => a.status !== "published" && a.status !== "draft").length,
        clients: (clientsR.data?.data ?? []).length,
        modules: catalog.length,
      };
      res.type("html").send(dashboardPage(stats, apps));
    } catch (e) {
      next(e);
    }
  });

  // ---- apps ----
  app.get("/apps", async (_req, res, next) => {
    try {
      const apps = await api.listApplications();
      res.type("html").send(appsPage(apps.data?.data ?? []));
    } catch (e) {
      next(e);
    }
  });

  app.get("/apps/new", async (req, res, next) => {
    try {
      const clients = await api.listClients();
      const catalog = await loadCatalog();
      res.type("html").send(newPage(clients.data?.data ?? [], catalog, {}, flash(req).err));
    } catch (e) {
      next(e);
    }
  });

  app.post("/apps", async (req, res, next) => {
    try {
      const name = String(req.body.name ?? "").trim();
      const slug = String(req.body.slug ?? "").trim();
      const client_id = String(req.body.client_id ?? "");
      const application_type = String(req.body.application_type ?? "").trim();
      const audience_model = String(req.body.audience_model ?? "").trim();
      const products = toArray(req.body.products);
      const reshow = async (status: number, detail: string) => {
        const clients = await api.listClients();
        const catalog = await loadCatalog();
        res.status(status).type("html").send(
          newPage(clients.data?.data ?? [], catalog, { name, slug, client_id, application_type, audience_model }, detail),
        );
      };
      if (!name || !SLUG.test(slug) || !client_id) {
        return reshow(400, "A client, a name, and a valid slug (lowercase words with hyphens) are all required.");
      }
      if (!application_type || !isKnownType(application_type)) {
        return reshow(400, "Choose what kind of application you are building.");
      }
      if (audience_model && !isAudienceModel(audience_model)) {
        return reshow(400, "Audience model must be B2C, B2B, or B2B2C.");
      }
      const created = await api.createApplication({
        client_id, name, slug, products,
        application_type,
        audience_model: audience_model || null,
      });
      if (created.status >= 400) {
        return reshow(created.status, (created.data as any)?.detail ?? "Could not create the app.");
      }
      res.redirect(`/apps/${encodeURIComponent(slug)}`);
    } catch (e) {
      next(e);
    }
  });

  app.get("/apps/:slug", async (req, res, next) => {
    try {
      const slug = req.params.slug;
      const [apps, products] = await Promise.all([api.listApplications(), api.getProducts(slug)]);
      const appRow = (apps.data?.data ?? []).find((a) => a.slug === slug);
      if (!appRow || products.status === 404) {
        res.status(404).type("html").send(errorPage(404, `No app '${slug}'.`));
        return;
      }
      const f = flash(req);
      res.type("html").send(editPage(appRow, products.data?.data ?? [], { ok: f.ok, err: f.err }));
    } catch (e) {
      next(e);
    }
  });

  app.post("/apps/:slug/toggle", async (req, res, next) => {
    try {
      const slug = req.params.slug;
      const code = String(req.body.code ?? "");
      const enabled = String(req.body.enabled ?? "") === "true";
      const r = await api.toggleProduct(slug, code, enabled);
      const q = new URLSearchParams();
      if (r.status >= 400) q.set("err", (r.data as any)?.detail ?? "The module could not be changed.");
      else q.set("ok", `${code} switched ${enabled ? "on" : "off"}.`);
      res.redirect(`/apps/${encodeURIComponent(slug)}?${q.toString()}`);
    } catch (e) {
      next(e);
    }
  });

  app.post("/apps/:slug/publish", async (req, res, next) => {
    try {
      const slug = req.params.slug;
      const r = await api.publish(slug);
      const q = new URLSearchParams();
      if (r.status >= 400) q.set("err", (r.data as any)?.detail ?? "Publish failed.");
      else q.set("ok", "App published.");
      res.redirect(`/apps/${encodeURIComponent(slug)}?${q.toString()}`);
    } catch (e) {
      next(e);
    }
  });

  // ---- backward-compatible redirects from the old "brand" URLs ----
  app.get("/new", (_req, res) => res.redirect(301, "/apps/new"));
  app.get("/brands", (_req, res) => res.redirect(301, "/apps"));
  app.get("/brands/:slug", (req, res) => res.redirect(301, `/apps/${encodeURIComponent(req.params.slug)}`));
  app.post("/brands", (_req, res) => res.redirect(307, "/apps")); // 307 preserves the POST body

  app.use((_req, res) => res.status(404).type("html").send(errorPage(404, "Page not found.")));
  app.use((err: unknown, _req: express.Request, res: express.Response, _n: express.NextFunction) => {
    console.error("app-factory", err);
    res.status(502).type("html").send(errorPage(502, "The platform API could not be reached."));
  });

  return app;
}

/** The module catalogue, read from any existing app (no bare catalogue endpoint yet). */
async function loadCatalog() {
  const apps = await api.listApplications();
  const first = (apps.data?.data ?? [])[0];
  if (!first) return [];
  const products = await api.getProducts(first.slug);
  return products.data?.data ?? [];
}

const flash = (req: express.Request) => ({
  ok: typeof req.query.ok === "string" ? req.query.ok : undefined,
  err: typeof req.query.err === "string" ? req.query.err : undefined,
});

const toArray = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 8096);
  createApp().listen(port, () => console.log(`xappx-factory console on ${port}`));
}
