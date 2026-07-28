import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fetchManifest, ManifestError } from "./manifest.js";
import { renderPage, renderError, routeExists } from "./render.js";

// tokens.css is the shared design system. Served from here so a brand page can
// link it; overridable for tests/packaging via WEB_TOKENS_CSS.
const TOKENS =
  process.env.WEB_TOKENS_CSS ??
  fileURLToPath(new URL("../../../../packages/design-system/tokens.css", import.meta.url));

/**
 * The web runtime. One page per brand, assembled entirely from the manifest:
 * navigation, onboarding and the reachable routes all come from it. A route the
 * manifest does not declare is a 404 — there is nothing brand-specific to hide
 * client-side because it was never sent.
 */
export function createApp() {
  const app = express();

  app.get("/healthz", (_req, res) => res.json({ status: "ok" }));

  app.get("/tokens.css", (_req, res) => {
    try {
      res.type("text/css").send(readFileSync(TOKENS, "utf8"));
    } catch {
      res.status(500).type("text/css").send("/* design tokens unavailable */");
    }
  });

  async function serve(slug: string, route: string, res: express.Response) {
    let manifest;
    try {
      manifest = await fetchManifest(slug);
    } catch (e) {
      const status = e instanceof ManifestError ? e.status : 502;
      const msg = status === 404 ? "This brand does not exist." : "The brand could not be loaded.";
      res.status(status).type("html").send(renderError(status, msg));
      return;
    }
    if (!routeExists(manifest, route)) {
      res.status(404).type("html").send(renderError(404, "This section is not part of this brand."));
      return;
    }
    res.type("html").send(renderPage(manifest, route));
  }

  // Everything else is /<slug> or /<slug>/<route...>. Parsed from req.path so the
  // route segment (which the manifest must declare) is derived, never guessed.
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
    void serve(slug, route, res);
  });

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 8090);
  createApp().listen(port, () => console.log(`web-runtime listening on ${port}`));
}
