import type { Application, Client, ProductRow } from "./api.js";

/**
 * The XAPPX Factory console. This IS an XAPPX platform surface, so it wears the
 * XAPPX identity — deep navy, the cyan→violet gradient. That is the opposite of
 * the member runtime, which wears each *application's* own colours.
 *
 * Terminology follows the platform brief: the things being built are
 * "applications" / "apps", never "brands" (a brand is only logos/colours/fonts).
 */
const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

const webBase = () => {
  let b = (process.env.WEB_RUNTIME_BASE ?? "http://localhost:8090").trim().replace(/\/$/, "");
  if (!/^https?:\/\//.test(b)) b = "https://" + b;
  return b;
};

/** A polished initials placeholder when an app has no uploaded logo (brief §6/§9). */
function initials(name: string): string {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : (parts[0]?.[1] ?? "");
  return (first + second).toUpperCase();
}
function monoHue(slug: string): number {
  let h = 0;
  for (const ch of String(slug)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
function monogram(name: string, slug: string, size = 40): string {
  const hue = monoHue(slug);
  return `<span class="mono-logo" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px;` +
    `background:linear-gradient(135deg,hsl(${hue} 62% 42%),hsl(${(hue + 40) % 360} 62% 32%))">${esc(initials(name))}</span>`;
}
const statusClass = (s: string) => "st-" + String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-");

const STYLE = `
  :root{ --cyan:#00C2FF; --violet:#7B5EFF; --navy:#080B12; --panel:#0E141F; --panel2:#131B29;
    --line:#1E2836; --white:#fff; --gray:#8A9BB5; --dim:#5C6B83; --pass:#3DDC97; --amber:#F5C451; --red:#FF6B84;
    --grad:linear-gradient(90deg,#00C2FF,#0066FF 50%,#7B5EFF);
    --sans:system-ui,"Segoe UI",Roboto,sans-serif; --mono:"Cascadia Code",ui-monospace,Consolas,monospace; }
  *{box-sizing:border-box} body{margin:0;background:var(--navy);color:var(--white);font-family:var(--sans);line-height:1.55}
  a{color:var(--cyan);text-decoration:none} a:hover{text-decoration:underline}
  .top{display:flex;align-items:center;gap:16px;padding:16px 26px;border-bottom:1px solid var(--line);background:var(--panel)}
  .wm{font-family:var(--mono);font-weight:700;letter-spacing:.28em;font-size:14px}
  .wm b{background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  .top .sep{color:var(--dim)} .top .app{font-weight:640}
  .badge{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--violet);
         border:1px solid var(--line);border-radius:6px;padding:2px 8px}
  .top nav{margin-left:auto;display:flex;gap:6px}
  .top nav a{color:var(--gray);padding:6px 12px;border-radius:8px}
  .top nav a:hover,.top nav a.on{background:var(--panel2);color:var(--white);text-decoration:none}
  main{max-width:980px;margin:0 auto;padding:32px 24px 72px}
  h1{font-size:26px;letter-spacing:-.02em;margin:0 0 4px} .sub{color:var(--gray);margin:0 0 26px}
  .row{display:flex;align-items:center;gap:12px} .spacer{flex:1}
  .btn{display:inline-block;background:var(--grad);color:#fff;border:none;border-radius:9px;padding:9px 16px;
       font-weight:600;font-size:14px;cursor:pointer;font-family:inherit}
  .btn:hover{filter:brightness(1.1)} .btn.quiet{background:none;border:1px solid var(--line);color:var(--white)}
  .btn.quiet:hover{border-color:var(--cyan);filter:none}
  .mono-logo{display:inline-flex;align-items:center;justify-content:center;border-radius:10px;color:#fff;
             font-weight:700;letter-spacing:.02em;flex:none}
  /* dashboard */
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin:6px 0 26px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px}
  .card .n{font-family:var(--mono);font-size:28px;font-weight:600;letter-spacing:-.02em}
  .card .n.g{background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  .card .l{font-size:12.5px;color:var(--gray);margin-top:4px}
  .card.muted .n{color:var(--dim)} .card.muted .l .z{color:var(--dim);font-size:11px}
  .eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gray);margin:26px 0 10px}
  /* app list cards */
  .applist{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
  .appcard{display:flex;gap:14px;align-items:flex-start;background:var(--panel);border:1px solid var(--line);
           border-radius:14px;padding:16px}
  .appcard .meta{flex:1;min-width:0}
  .appcard .nm{font-weight:640;font-size:16px} .appcard .sl{font-family:var(--mono);font-size:11.5px;color:var(--dim)}
  .appcard .foot{display:flex;align-items:center;gap:12px;margin-top:12px;font-size:12px;color:var(--gray);flex-wrap:wrap}
  .appcard .acts{display:flex;gap:12px;margin-top:12px;font-size:13px}
  .modn{font-family:var(--mono);color:var(--gray)}
  .status{font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;
          padding:2px 8px;border-radius:6px;border:1px solid var(--line);color:var(--gray)}
  .status.st-published,.status.st-independent,.status.st-active{color:var(--pass);border-color:rgba(61,220,151,.35)}
  .status.st-draft,.status.st-discovery{color:var(--cyan);border-color:rgba(0,194,255,.3)}
  .status.st-configuring,.status.st-exporting{color:var(--violet);border-color:rgba(123,94,255,.35)}
  .status.st-testing,.status.st-in-development,.status.st-pending-approval{color:var(--amber);border-color:rgba(245,196,81,.35)}
  .status.st-paused,.status.st-archived{color:var(--dim)}
  .status.st-suspended{color:var(--red);border-color:rgba(255,107,132,.35)}
  /* forms */
  .panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:22px;margin-bottom:18px}
  .field{display:flex;flex-direction:column;gap:6px;margin-bottom:16px}
  label{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--gray)}
  input,select{background:var(--navy);border:1px solid var(--line);border-radius:9px;padding:10px 12px;color:var(--white);
               font-family:inherit;font-size:15px}
  input:focus,select:focus{outline:none;border-color:var(--cyan)}
  .hint{font-size:12px;color:var(--dim)} .hint code{font-family:var(--mono);color:var(--gray)}
  .checks{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
  .check{display:flex;align-items:center;gap:9px;border:1px solid var(--line);border-radius:9px;padding:9px 12px;
         background:var(--navy);font-size:14px;cursor:pointer}
  .check input{width:16px;height:16px;accent-color:var(--cyan)}
  .prod{display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--line)}
  .prod:last-child{border-bottom:none}
  .prod .pn{font-weight:560} .prod .pc{font-family:var(--mono);font-size:11.5px;color:var(--dim)}
  .prod .req{font-family:var(--mono);font-size:11px;color:var(--dim)} .prod form{margin:0 0 0 auto}
  .switch{font-family:var(--mono);font-size:12px;font-weight:600;padding:6px 14px;border-radius:999px;cursor:pointer;
          border:1px solid var(--line);background:var(--navy);color:var(--gray);min-width:64px}
  .switch.on{color:#fff;border-color:transparent;background:linear-gradient(90deg,rgba(0,194,255,.25),rgba(123,94,255,.25));
             box-shadow:inset 0 0 0 1px rgba(0,194,255,.5)}
  .notice{border:1px solid var(--line);border-left:3px solid var(--cyan);background:rgba(0,194,255,.06);
          border-radius:9px;padding:12px 14px;margin-bottom:18px;font-size:14px}
  .notice.err{border-left-color:var(--red);background:rgba(255,107,132,.08)}
  .notice.ok{border-left-color:var(--pass);background:rgba(61,220,151,.08)}
  footer{max-width:980px;margin:0 auto;padding:0 24px 48px;color:var(--dim);font-size:12.5px}
  .empty{border:1px dashed var(--line);border-radius:12px;padding:34px;text-align:center;color:var(--gray)}
`;

function layout(title: string, body: string, active = ""): string {
  const nav = (href: string, label: string) =>
    `<a href="${href}"${active === href ? ' class="on"' : ""}>${label}</a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · XAPPX Factory</title>
<link rel="stylesheet" href="/tokens.css"><style>${STYLE}</style></head><body>
<header class="top">
  <span class="wm">X<b>APP</b>X</span><span class="sep">/</span><span class="app">Factory</span>
  <span class="badge">internal</span>
  <nav>${nav("/", "Dashboard")}${nav("/apps", "Apps")}${nav("/apps/new", "New app")}</nav>
</header>
<main>${body}</main>
<footer>XAPPX Factory — a pure API client over the platform services. This build uses a shared-password
gate; role-based sign-in (platform-admin, factory-admin, …) is a planned next step.</footer>
</body></html>`;
}

export interface FactoryStats {
  totalApps: number;
  published: number;
  drafts: number;
  otherStatus: number;
  clients: number;
  modules: number;
}

/** Factory home: a real platform dashboard with honest zero-states (brief §5). */
export function dashboardPage(stats: FactoryStats, recent: Application[]): string {
  const card = (n: number | string, label: string, grad = false) =>
    `<div class="card"><div class="n${grad ? " g" : ""}">${n}</div><div class="l">${esc(label)}</div></div>`;
  const muted = (label: string) =>
    `<div class="card muted"><div class="n">—</div><div class="l">${esc(label)} <span class="z">· not yet tracked</span></div></div>`;

  const recentRows = recent.length
    ? recent.slice(0, 6).map((a) =>
        `<div class="appcard"><a href="/apps/${encodeURIComponent(a.slug)}">${monogram(a.name, a.slug)}</a>
          <div class="meta"><div class="nm">${esc(a.name)}</div><div class="sl">${esc(a.slug)}</div>
          <div class="foot"><span class="status ${statusClass(a.status)}">${esc(a.status)}</span>
          <a href="/apps/${encodeURIComponent(a.slug)}">Configure →</a></div></div></div>`,
      ).join("")
    : `<div class="empty">No applications yet. Create your first one.</div>`;

  const body = `<div class="row"><div class="spacer"><h1>Factory</h1>
      <p class="sub">The XAPPX application-building platform. Launch a new app by configuration; add custom development when needed.</p></div>
      <a class="btn" href="/apps/new">Create New App</a></div>

    <div class="eyebrow">Platform</div>
    <div class="cards">
      ${card(stats.totalApps, "Applications", true)}
      ${card(stats.published, "Published")}
      ${card(stats.drafts, "Drafts")}
      ${card(stats.otherStatus, "In progress")}
      ${card(stats.clients, "Clients")}
      ${card(stats.modules, "Modules available")}
    </div>

    <div class="eyebrow">Activity &amp; usage</div>
    <div class="cards">
      ${muted("Active users")}${muted("AI usage")}${muted("Points issued")}
      ${muted("Referrals")}${muted("Monthly revenue")}${muted("API calls")}
    </div>

    <div class="eyebrow">Recent applications</div>
    <div class="applist">${recentRows}</div>
    <p class="hint" style="margin-top:18px"><a href="/apps">View all apps →</a></p>`;
  return layout("Dashboard", body, "/");
}

/** The Apps list (brief §6) — cards with logo/placeholder, status, actions. */
export function appsPage(apps: Application[]): string {
  const cards = apps
    .map((a) => {
      const memberView = `${webBase()}/${encodeURIComponent(a.slug)}`;
      return `<div class="appcard">
        <a href="/apps/${encodeURIComponent(a.slug)}">${monogram(a.name, a.slug)}</a>
        <div class="meta">
          <div class="nm">${esc(a.name)}</div><div class="sl">${esc(a.slug)}</div>
          <div class="foot"><span class="status ${statusClass(a.status)}">${esc(a.status)}</span>${
            a.primary_domain ? `<span class="modn">${esc(a.primary_domain)}</span>` : ""
          }</div>
          <div class="acts"><a href="/apps/${encodeURIComponent(a.slug)}">Configure</a>
            <a href="${esc(memberView)}" target="_blank" rel="noreferrer">Open member view ↗</a></div>
        </div></div>`;
    })
    .join("");
  const body = `<div class="row"><div class="spacer"><h1>Apps</h1>
      <p class="sub">Every app on the XAPPX Platform. Launching a new app is configuration first, with custom development available when needed.</p></div>
      <a class="btn" href="/apps/new">New app</a></div>
    ${apps.length ? `<div class="applist">${cards}</div>` : `<div class="empty">No apps yet. Create the first one.</div>`}`;
  return layout("Apps", body, "/apps");
}

export function newPage(
  clients: Client[],
  catalog: ProductRow[],
  values: { name?: string; slug?: string; client_id?: string } = {},
  error?: string,
): string {
  const clientOpts = clients
    .map((c) => `<option value="${esc(c.client_id)}"${c.client_id === values.client_id ? " selected" : ""}>${esc(c.name)}</option>`)
    .join("");
  const checks = catalog
    .map((p) => `<label class="check"><input type="checkbox" name="products" value="${esc(p.code)}">${esc(p.name)}</label>`)
    .join("");
  const body = `<h1>New app</h1><p class="sub">Name it, choose a slug, switch on the modules it launches with. It goes live from its own page.</p>
  ${error ? `<div class="notice err">${esc(error)}</div>` : ""}
  <form class="panel" method="post" action="/apps">
    <div class="field"><label for="client_id">Client</label>
      <select id="client_id" name="client_id" required>${clientOpts || `<option value="">No clients yet</option>`}</select></div>
    <div class="field"><label for="name">App name</label>
      <input id="name" name="name" value="${esc(values.name ?? "")}" placeholder="Aurora" autofocus required></div>
    <div class="field"><label for="slug">Slug</label>
      <input id="slug" name="slug" value="${esc(values.slug ?? "")}" placeholder="aurora" pattern="[a-z0-9]+(-[a-z0-9]+)*" required>
      <span class="hint">Lowercase words with hyphens. Used in the URL: <code>/&lt;slug&gt;</code></span></div>
    ${catalog.length ? `<div class="field"><label>Modules to launch with</label><div class="checks">${checks}</div></div>` : ""}
    <div class="row"><button class="btn" type="submit">Create app</button><a class="btn quiet" href="/apps">Cancel</a></div>
  </form>
  <script>
    (function(){var n=document.getElementById('name'),s=document.getElementById('slug'),t=false;
     s.addEventListener('input',function(){t=true});
     n.addEventListener('input',function(){if(!t)s.value=n.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')});})();
  </script>`;
  return layout("New app", body, "/apps/new");
}

export function editPage(app: Application, products: ProductRow[], flash?: { ok?: string; err?: string }): string {
  const rows = products
    .map((p) => {
      const enabled = p.enabled;
      const req = p.requires.length ? `<span class="req">needs ${esc(p.requires.join(", "))}</span>` : "";
      return `<div class="prod">
        <div><span class="pn">${esc(p.display_name || p.name)}</span> <span class="pc">${esc(p.code)}</span></div>
        ${req}
        <form method="post" action="/apps/${encodeURIComponent(app.slug)}/toggle">
          <input type="hidden" name="code" value="${esc(p.code)}">
          <input type="hidden" name="enabled" value="${enabled ? "false" : "true"}">
          <button class="switch ${enabled ? "on" : ""}" type="submit" aria-pressed="${enabled}">${enabled ? "On" : "Off"}</button>
        </form></div>`;
    })
    .join("");
  const memberView = `${webBase()}/${encodeURIComponent(app.slug)}`;
  const body = `<div class="row">${monogram(app.name, app.slug, 44)}<div class="spacer"><h1>${esc(app.name)}</h1>
      <p class="sub"><span class="sl">${esc(app.slug)}</span> · <span class="status ${statusClass(app.status)}">${esc(app.status)}</span></p></div>
      <a class="btn quiet" href="${esc(memberView)}" target="_blank" rel="noreferrer">Open member view ↗</a></div>
    ${flash?.ok ? `<div class="notice ok">${esc(flash.ok)}</div>` : ""}
    ${flash?.err ? `<div class="notice err">${esc(flash.err)}</div>` : ""}
    <div class="panel"><label style="display:block;margin-bottom:6px">Modules</label>
      <p class="hint" style="margin-bottom:8px">Switch a module on and it appears in this app — nav, onboarding and API — with no deploy. Off is non-destructive.</p>
      ${rows || `<p class="hint">No modules in the catalogue.</p>`}</div>
    <form method="post" action="/apps/${encodeURIComponent(app.slug)}/publish">
      <button class="btn" type="submit"${app.status === "published" ? " disabled" : ""}>${app.status === "published" ? "Published" : "Publish app"}</button>
    </form>
    <p class="hint" style="margin-top:20px"><a href="/apps">← All apps</a></p>`;
  return layout(app.name, body, "/apps");
}

export function errorPage(status: number, message: string): string {
  return layout(String(status), `<div class="empty"><h1>${status}</h1><p>${esc(message)}</p><p><a href="/apps">← All apps</a></p></div>`);
}
