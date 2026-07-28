import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";
import * as api from "./api.js";
import { listPage, newPage, editPage, errorPage } from "./render.js";

/**
 * A shared-password gate. The console can create and delete brands, so it must
 * not be openly reachable once it's on a public URL. When FACTORY_USER/PASS are
 * set it requires HTTP Basic Auth; when they are unset (local dev) it stays open.
 *
 * This is a deliberately minimal demo gate — one shared credential — NOT the
 * platform's real per-user auth. It still counts as auth code and should be
 * reviewed before it protects anything that matters.
 */
function timingEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function basicAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = process.env.FACTORY_USER;
  const pass = process.env.FACTORY_PASS;
  if (!user || !pass) return next(); // no credentials configured → open (local only)

  const match = /^Basic (.+)$/.exec(req.header("authorization") ?? "");
  if (match) {
    const decoded = Buffer.from(match[1] ?? "", "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    const u = sep === -1 ? decoded : decoded.slice(0, sep);
    const p = sep === -1 ? "" : decoded.slice(sep + 1);
    if (timingEqual(u, user) && timingEqual(p, pass)) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="XAPPX App Factory", charset="UTF-8"');
  res.status(401).type("text/plain").send("Authentication required.");
}

const TOKENS =
  process.env.WEB_TOKENS_CSS ??
  fileURLToPath(new URL("../../../../packages/design-system/tokens.css", import.meta.url));

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * The App Factory console. Server-rendered screens over clients-service's public
 * API. It writes brands and toggles products; it reads nothing from any database
 * directly. Forms POST and redirect (Post/Redirect/Get), so a refresh never
 * repeats an action.
 */
export function createApp() {
  const app = express();
  app.use(express.urlencoded({ extended: false }));

  // Health check stays public so the host can probe it; everything else is gated.
  app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
  app.use(basicAuth);

  app.get("/tokens.css", (_req, res) => {
    try {
      res.type("text/css").send(readFileSync(TOKENS, "utf8"));
    } catch {
      res.status(500).type("text/css").send("/* tokens unavailable */");
    }
  });

  app.get("/", async (_req, res, next) => {
    try {
      const apps = await api.listApplications();
      res.type("html").send(listPage(apps.data?.data ?? []));
    } catch (e) {
      next(e);
    }
  });

  app.get("/new", async (req, res, next) => {
    try {
      const clients = await api.listClients();
      const catalog = await loadCatalog();
      res.type("html").send(newPage(clients.data?.data ?? [], catalog, {}, flash(req).err));
    } catch (e) {
      next(e);
    }
  });

  app.post("/brands", async (req, res, next) => {
    try {
      const name = String(req.body.name ?? "").trim();
      const slug = String(req.body.slug ?? "").trim();
      const client_id = String(req.body.client_id ?? "");
      const products = toArray(req.body.products);
      if (!name || !SLUG.test(slug) || !client_id) {
        const clients = await api.listClients();
        const catalog = await loadCatalog();
        res.status(400).type("html").send(
          newPage(clients.data?.data ?? [], catalog, { name, slug, client_id },
            "A client, a name, and a valid slug (lowercase words with hyphens) are all required."),
        );
        return;
      }
      const created = await api.createApplication({ client_id, name, slug, products });
      if (created.status >= 400) {
        const clients = await api.listClients();
        const catalog = await loadCatalog();
        const detail = (created.data as any)?.detail ?? "Could not create the brand.";
        res.status(created.status).type("html").send(
          newPage(clients.data?.data ?? [], catalog, { name, slug, client_id }, detail),
        );
        return;
      }
      res.redirect(`/brands/${encodeURIComponent(slug)}`);
    } catch (e) {
      next(e);
    }
  });

  app.get("/brands/:slug", async (req, res, next) => {
    try {
      const slug = req.params.slug;
      const [apps, products] = await Promise.all([api.listApplications(), api.getProducts(slug)]);
      const appRow = (apps.data?.data ?? []).find((a) => a.slug === slug);
      if (!appRow || products.status === 404) {
        res.status(404).type("html").send(errorPage(404, `No brand '${slug}'.`));
        return;
      }
      const f = flash(req);
      res.type("html").send(editPage(appRow, products.data?.data ?? [], { ok: f.ok, err: f.err }));
    } catch (e) {
      next(e);
    }
  });

  app.post("/brands/:slug/toggle", async (req, res, next) => {
    try {
      const slug = req.params.slug;
      const code = String(req.body.code ?? "");
      const enabled = String(req.body.enabled ?? "") === "true";
      const r = await api.toggleProduct(slug, code, enabled);
      if (r.status >= 400) {
        const detail = (r.data as any)?.detail ?? "The product could not be changed.";
        res.redirect(`/brands/${encodeURIComponent(slug)}?err=${encodeURIComponent(detail)}`);
        return;
      }
      res.redirect(`/brands/${encodeURIComponent(slug)}?ok=${encodeURIComponent(`${code} switched ${enabled ? "on" : "off"}.`)}`);
    } catch (e) {
      next(e);
    }
  });

  app.post("/brands/:slug/publish", async (req, res, next) => {
    try {
      const slug = req.params.slug;
      const r = await api.publish(slug);
      const q = new URLSearchParams();
      if (r.status >= 400) q.set("err", (r.data as any)?.detail ?? "Publish failed.");
      else q.set("ok", "Brand published.");
      res.redirect(`/brands/${encodeURIComponent(slug)}?${q.toString()}`);
    } catch (e) {
      next(e);
    }
  });

  app.use((_req, res) => res.status(404).type("html").send(errorPage(404, "Page not found.")));
  app.use((err: unknown, _req: express.Request, res: express.Response, _n: express.NextFunction) => {
    console.error("app-factory", err);
    res.status(502).type("html").send(errorPage(502, "The platform API could not be reached."));
  });

  return app;
}

/** The product catalogue, read from any existing brand (there is no bare catalogue endpoint yet). */
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
  createApp().listen(port, () => console.log(`app-factory console on ${port}`));
}
