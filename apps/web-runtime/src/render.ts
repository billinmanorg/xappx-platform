import type { Manifest } from "./manifest.js";

/**
 * Turn a manifest into HTML. The rule of this file: nothing renders that is not
 * in the manifest. Navigation, onboarding and the set of reachable routes come
 * from the manifest and nowhere else, so switching a product off in
 * clients-service removes it here with no code change and no brand-specific
 * branch. There are, by design, no brand names in this source.
 *
 * Colour comes from the brand's own theme, never from the XAPPX palette — a
 * client instance painted XAPPX cyan would be a theme-resolution bug (BRAND.md
 * §4). tokens.css supplies typography and structure; the XAPPX gradient appears
 * only on the platform "powered by" marker, in its one correct direction:
 * left to right, cyan to violet.
 */

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

/** Only allow http(s) or root-relative URLs, so a manifest cannot inject javascript:. */
const safeUrl = (u: unknown): string =>
  typeof u === "string" && /^(https?:\/\/|\/)/.test(u) ? u : "";

const hrefFor = (slug: string, route: string): string =>
  "/" + encodeURIComponent(slug) + (route === "/" ? "" : route);

/** Is this route reachable for this brand? Only if the manifest declares it. */
export function routeExists(manifest: Manifest, route: string): boolean {
  return manifest.nav.some((n) => n.route === route);
}

function head(manifest: Manifest): string {
  const brandColor = safeCssColor(manifest.theme?.primary_color);
  const brandFont = manifest.theme?.font ? esc(manifest.theme.font) : "";
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(brandTitle(manifest))}</title>
<link rel="stylesheet" href="/tokens.css">
<style>
  :root {
    --brand-primary: ${brandColor || "var(--xappx-cool-gray)"};
    --brand-font: ${brandFont ? `'${brandFont}', ` : ""}var(--xappx-font-primary);
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--xappx-bg); color: var(--xappx-text);
         font: var(--xappx-body); font-family: var(--brand-font); }
  header.site { display: flex; align-items: center; gap: 14px; padding: 20px 28px;
                border-bottom: 1px solid rgba(255,255,255,0.08); }
  header.site .wordmark { font-family: var(--xappx-font-alternate); font-weight: 700;
                          font-size: 20px; letter-spacing: .01em; }
  header.site img { height: 28px; width: auto; border-radius: 4px; }
  nav.brand { display: flex; gap: 4px; flex-wrap: wrap; padding: 0 20px;
              border-bottom: 1px solid rgba(255,255,255,0.08); }
  nav.brand a { padding: 12px 14px; color: var(--xappx-text-muted); text-decoration: none;
                border-bottom: 2px solid transparent; }
  nav.brand a.active { color: var(--xappx-text); border-bottom-color: var(--brand-primary); }
  nav.brand a:hover { color: var(--xappx-text); }
  main { max-width: 820px; margin: 0 auto; padding: 40px 24px 64px; }
  h1 { font: var(--xappx-subheading); font-family: var(--brand-font); margin: 0 0 8px; }
  .lede { color: var(--xappx-text-muted); margin: 0 0 28px; }
  .panel { border: 1px solid rgba(255,255,255,0.10); border-radius: 12px; padding: 20px;
           margin-bottom: 20px; }
  .chips { display: flex; gap: 8px; flex-wrap: wrap; }
  .chip { font-size: 12px; color: var(--xappx-text-muted);
          border: 1px solid rgba(255,255,255,0.14); border-radius: 999px; padding: 3px 10px; }
  ol.steps { margin: 0; padding-left: 20px; }
  ol.steps li { margin: 6px 0; }
  .legal a { color: var(--xappx-text-muted); margin-right: 16px; }
  footer.platform { display: flex; align-items: center; gap: 10px; padding: 18px 28px;
                    border-top: 1px solid rgba(255,255,255,0.08); color: var(--xappx-text-muted);
                    font: var(--xappx-caption); }
  footer.platform .rule { height: 3px; width: 56px; border-radius: 2px;
                          background: var(--xappx-gradient-rule); }
</style></head>`;
}

function brandTitle(manifest: Manifest): string {
  return manifest.copy?.title || manifest.copy?.hero_title || manifest.slug;
}

/** Guard theme colour so it cannot break out of the CSS declaration. */
function safeCssColor(v: unknown): string {
  return typeof v === "string" && /^#[0-9a-fA-F]{3,8}$|^[a-zA-Z]+$|^rgb\([\d,\s.%]+\)$/.test(v.trim())
    ? v.trim()
    : "";
}

function navBar(manifest: Manifest, current: string): string {
  const items = manifest.nav
    .map((n) => {
      const cls = n.route === current ? ' class="active"' : "";
      return `<a href="${esc(hrefFor(manifest.slug, n.route))}"${cls}>${esc(n.label)}</a>`;
    })
    .join("");
  return `<nav class="brand">${items}</nav>`;
}

function routePanel(manifest: Manifest, current: string): string {
  const entry = manifest.nav.find((n) => n.route === current);
  const heading = entry ? entry.label : "";
  const hero = current === "/" ? esc(manifest.copy?.hero || manifest.copy?.hero_body || "") : "";
  const gatedBy = entry?.product
    ? `<p class="lede">Provided by the ${esc(entry.product)} product.</p>`
    : "";
  return `<h1>${esc(heading)}</h1>${hero ? `<p class="lede">${hero}</p>` : gatedBy}`;
}

function productsPanel(manifest: Manifest): string {
  const on = manifest.products.filter((p) => p.enabled);
  if (!on.length) return "";
  const chips = on
    .map((p) => `<span class="chip">${esc(p.display_name || p.code)}</span>`)
    .join("");
  return `<div class="panel"><div class="chips">${chips}</div></div>`;
}

function onboardingPanel(manifest: Manifest): string {
  const steps = manifest.onboarding ?? [];
  if (!steps.length) return "";
  const li = steps.map((s) => `<li>${esc(s.key)}</li>`).join("");
  return `<div class="panel"><h1 style="font-size:20px">Getting started</h1><ol class="steps">${li}</ol></div>`;
}

function legalFooter(manifest: Manifest): string {
  const t = safeUrl(manifest.legal?.terms_url);
  const p = safeUrl(manifest.legal?.privacy_url);
  if (!t && !p) return "";
  const links = [
    t ? `<a href="${esc(t)}">Terms</a>` : "",
    p ? `<a href="${esc(p)}">Privacy</a>` : "",
  ].join("");
  return `<div class="panel legal">${links}</div>`;
}

/** The full brand page for a route the manifest declares. */
export function renderPage(manifest: Manifest, current: string): string {
  const logo = safeUrl(manifest.theme?.logo_url);
  const header = `<header class="site">${
    logo ? `<img src="${esc(logo)}" alt="">` : ""
  }<span class="wordmark">${esc(brandTitle(manifest))}</span></header>`;

  return `${head(manifest)}<body>
${header}
${navBar(manifest, current)}
<main>
${routePanel(manifest, current)}
${current === "/" ? productsPanel(manifest) + onboardingPanel(manifest) : ""}
${legalFooter(manifest)}
</main>
<footer class="platform"><span class="rule"></span><span>Powered by XAPPX</span></footer>
</body></html>`;
}

/** A minimal, brand-neutral error shell for missing brands or routes. */
export function renderError(status: number, message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${status}</title><link rel="stylesheet" href="/tokens.css">
<style>body{margin:0;background:var(--xappx-bg);color:var(--xappx-text);
font:var(--xappx-body);display:grid;place-items:center;height:100vh;text-align:center}
.rule{height:3px;width:56px;border-radius:2px;background:var(--xappx-gradient-rule);margin:16px auto}
</style></head><body><div><h1>${status}</h1><div class="rule"></div>
<p>${esc(message)}</p></div></body></html>`;
}
