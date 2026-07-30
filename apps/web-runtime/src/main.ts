import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fetchManifest, ManifestError, type Manifest } from "./manifest.js";
import { renderPage, renderError, renderAuthForm, routeExists } from "./render.js";
import { login, signup, me } from "./authclient.js";

const TOKENS =
  process.env.WEB_TOKENS_CSS ??
  fileURLToPath(new URL("../../../../packages/design-system/tokens.css", import.meta.url));

const COOKIE = "xappx_session";

const brandPath = (slug: string) => "/" + encodeURIComponent(slug);
const isHttps = (req: express.Request) =>
  req.secure || req.header("x-forwarded-proto") === "https";

function readCookie(req: express.Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

function setSession(req: express.Request, res: express.Response, token: string) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(req),
    path: "/",
    maxAge: 3600 * 1000,
  });
}

/**
 * The web runtime. One page per brand, assembled from the manifest — plus the
 * member-facing sign-in/up, which posts to identity-service and keeps the bearer
 * token in an http-only cookie. A route the manifest does not declare is a 404;
 * /login, /signup and /logout are the only reserved sub-paths.
 */
export function createApp() {
  const app = express();
  app.use(express.urlencoded({ extended: false }));

  app.get("/healthz", (_req, res) => res.json({ status: "ok" }));

  app.get("/tokens.css", (_req, res) => {
    try {
      res.type("text/css").send(readFileSync(TOKENS, "utf8"));
    } catch {
      res.status(500).type("text/css").send("/* design tokens unavailable */");
    }
  });

  async function loadManifest(slug: string, res: express.Response): Promise<Manifest | null> {
    try {
      return await fetchManifest(slug);
    } catch (e) {
      const status = e instanceof ManifestError ? e.status : 502;
      const msg = status === 404 ? "This app does not exist." : "The app could not be loaded.";
      res.status(status).type("html").send(renderError(status, msg));
      return null;
    }
  }

  // ---- authentication (reserved sub-paths, before the manifest catch-all) ----

  app.get("/:slug/login", async (req, res) => {
    const m = await loadManifest(req.params.slug, res);
    if (m) res.type("html").send(renderAuthForm(m, "login"));
  });

  app.get("/:slug/signup", async (req, res) => {
    const m = await loadManifest(req.params.slug, res);
    if (m) res.type("html").send(renderAuthForm(m, "signup"));
  });

  app.post("/:slug/login", async (req, res) => {
    const m = await loadManifest(req.params.slug, res);
    if (!m) return;
    const result = await login(String(req.body.email ?? ""), String(req.body.password ?? ""));
    if (!result.ok || !result.token) {
      return res.status(result.status === 502 ? 502 : 401).type("html")
        .send(renderAuthForm(m, "login", result.error ?? "Invalid email or password."));
    }
    setSession(req, res, result.token);
    res.redirect(brandPath(req.params.slug));
  });

  app.post("/:slug/signup", async (req, res) => {
    const m = await loadManifest(req.params.slug, res);
    if (!m) return;
    const result = await signup(
      String(req.body.email ?? ""), String(req.body.password ?? ""),
      req.body.name ? String(req.body.name) : undefined,
    );
    if (!result.ok || !result.token) {
      return res.status(result.status >= 500 ? 502 : 400).type("html")
        .send(renderAuthForm(m, "signup", result.error ?? "Could not create the account."));
    }
    setSession(req, res, result.token);
    res.redirect(brandPath(req.params.slug));
  });

  app.post("/:slug/logout", (req, res) => {
    res.clearCookie(COOKIE, { path: "/" });
    res.redirect(brandPath(req.params.slug));
  });

  // ---- the manifest-driven brand pages ----

  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    const path = req.path;
    if (path === "/") {
      res.status(404).type("html").send(renderError(404, "Open a brand at /<slug>."));
      return;
    }
    const cut = path.indexOf("/", 1);
    const slug = decodeURIComponent(cut === -1 ? path.slice(1) : path.slice(1, cut));
    const route = cut === -1 ? "/" : path.slice(cut);
    void serveBrand(slug, route, req, res);
  });

  async function serveBrand(slug: string, route: string, req: express.Request, res: express.Response) {
    const manifest = await loadManifest(slug, res);
    if (!manifest) return;
    if (!routeExists(manifest, route)) {
      res.status(404).type("html").send(renderError(404, "This section is not part of this brand."));
      return;
    }
    // Resolve the signed-in user from the cookie, if any. A missing/invalid token
    // just renders the logged-out view — never an error.
    const token = readCookie(req, COOKIE);
    const user = token ? await me(token) : null;
    res.type("html").send(renderPage(manifest, route, user));
  }

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 8090);
  createApp().listen(port, () => console.log(`web-runtime listening on ${port}`));
}
