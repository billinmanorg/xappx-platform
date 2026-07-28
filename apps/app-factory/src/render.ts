import type { Application, Client, ProductRow } from "./api.js";

/**
 * The console's screens. This IS an XAPPX platform surface (the App Factory), so
 * it wears the XAPPX identity — deep navy, the cyan→violet gradient left to
 * right. That is the opposite of the web runtime, which must wear each *client
 * brand's* colours, never XAPPX's.
 */
const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

const webBase = () => {
  let b = (process.env.WEB_RUNTIME_BASE ?? "http://localhost:8090").trim().replace(/\/$/, "");
  if (!/^https?:\/\//.test(b)) b = "https://" + b; // bare cloud host -> https
  return b;
};

const STYLE = `
  :root, :root[data-theme=light], :root[data-theme=dark]{
    --cyan:#00C2FF; --blue:#0066FF; --violet:#7B5EFF; --navy:#080B12; --panel:#0E141F;
    --panel2:#131B29; --line:#1E2836; --white:#fff; --gray:#8A9BB5; --dim:#5C6B83;
    --pass:#3DDC97; --grad:linear-gradient(90deg,#00C2FF,#0066FF 50%,#7B5EFF);
    --sans:system-ui,"Segoe UI",Roboto,sans-serif;
    --mono:"Cascadia Code",ui-monospace,"SF Mono",Consolas,monospace; }
  *{box-sizing:border-box} body{margin:0;background:var(--navy);color:var(--white);font-family:var(--sans);line-height:1.55}
  a{color:var(--cyan);text-decoration:none} a:hover{text-decoration:underline}
  .top{display:flex;align-items:center;gap:18px;padding:16px 26px;border-bottom:1px solid var(--line);background:var(--panel)}
  .wm{font-family:var(--mono);font-weight:700;letter-spacing:.28em;font-size:14px}
  .wm b{background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  .top .sep{color:var(--dim)} .top .app{font-weight:640;letter-spacing:-.01em}
  .badge{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--violet);
         border:1px solid var(--line);border-radius:6px;padding:2px 8px}
  .top nav{margin-left:auto;display:flex;gap:8px}
  .top nav a{color:var(--gray);padding:6px 12px;border-radius:8px}
  .top nav a:hover{background:var(--panel2);color:var(--white);text-decoration:none}
  main{max-width:860px;margin:0 auto;padding:34px 24px 72px}
  h1{font-size:26px;letter-spacing:-.02em;margin:0 0 4px} .sub{color:var(--gray);margin:0 0 26px}
  .row{display:flex;align-items:center;gap:12px}
  .btn{display:inline-block;background:var(--grad);color:#fff;border:none;border-radius:9px;padding:9px 16px;
       font-weight:600;font-size:14px;cursor:pointer;font-family:inherit}
  .btn:hover{filter:brightness(1.1)} .btn.quiet{background:none;border:1px solid var(--line);color:var(--white)}
  .btn.quiet:hover{border-color:var(--cyan);filter:none}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);
     text-align:left;padding:10px 12px;border-bottom:1px solid var(--line)}
  td{padding:13px 12px;border-bottom:1px solid var(--line)}
  tr:hover td{background:var(--panel)}
  .bname{font-weight:620} .slug{font-family:var(--mono);font-size:12px;color:var(--gray)}
  .status{font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;
          padding:2px 8px;border-radius:6px;border:1px solid var(--line);color:var(--gray)}
  .status.published{color:var(--pass);border-color:rgba(61,220,151,.35)}
  .status.draft{color:var(--cyan);border-color:rgba(0,194,255,.3)}
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
  .prod .req{font-family:var(--mono);font-size:11px;color:var(--dim)}
  .prod form{margin:0 0 0 auto}
  .switch{font-family:var(--mono);font-size:12px;font-weight:600;padding:6px 14px;border-radius:999px;cursor:pointer;
          border:1px solid var(--line);background:var(--navy);color:var(--gray);min-width:64px}
  .switch.on{color:#fff;border-color:transparent;background:linear-gradient(90deg,rgba(0,194,255,.25),rgba(123,94,255,.25));
             box-shadow:inset 0 0 0 1px rgba(0,194,255,.5)}
  .notice{border:1px solid var(--line);border-left:3px solid var(--cyan);background:rgba(0,194,255,.06);
          border-radius:9px;padding:12px 14px;margin-bottom:18px;font-size:14px}
  .notice.err{border-left-color:#FF5C7A;background:rgba(255,92,122,.08)}
  .notice.ok{border-left-color:var(--pass);background:rgba(61,220,151,.08)}
  footer{max-width:860px;margin:0 auto;padding:0 24px 48px;color:var(--dim);font-size:12.5px}
  .empty{border:1px dashed var(--line);border-radius:12px;padding:34px;text-align:center;color:var(--gray)}
`;

function layout(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · XAPPX App Factory</title>
<link rel="stylesheet" href="/tokens.css"><style>${STYLE}</style></head><body>
<header class="top">
  <span class="wm">X<b>APP</b>X</span><span class="sep">/</span><span class="app">App Factory</span>
  <span class="badge">internal</span>
  <nav><a href="/">Brands</a><a href="/new">New brand</a></nav>
</header>
<main>${body}</main>
<footer>App Factory — a pure API client over clients-service. This build has <b>no authentication</b>;
it is an internal tool only. An admin sign-in is required before it leaves a local machine.</footer>
</body></html>`;
}

export function listPage(brands: Application[]): string {
  const rows = brands
    .map(
      (b) => `<tr>
      <td><div class="bname">${esc(b.name)}</div><div class="slug">${esc(b.slug)}</div></td>
      <td><span class="status ${esc(b.status)}">${esc(b.status)}</span></td>
      <td style="text-align:right"><a href="/brands/${encodeURIComponent(b.slug)}">Configure →</a></td>
    </tr>`,
    )
    .join("");
  const table = brands.length
    ? `<table><thead><tr><th>Brand</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
    : `<div class="empty">No brands yet. Create the first one.</div>`;
  return layout(
    "Brands",
    `<div class="row"><div style="flex:1"><h1>Brands</h1><p class="sub">Every brand on the platform. Launching one is configuration, not a build.</p></div>
     <a class="btn" href="/new">New brand</a></div>${table}`,
  );
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
    .map(
      (p) => `<label class="check"><input type="checkbox" name="products" value="${esc(p.code)}">${esc(p.name)}</label>`,
    )
    .join("");
  const body = `<h1>New brand</h1><p class="sub">Name it, choose a slug, switch on the products it launches with. It goes live from its own page.</p>
  ${error ? `<div class="notice err">${esc(error)}</div>` : ""}
  <form class="panel" method="post" action="/brands">
    <div class="field"><label for="client_id">Client</label>
      <select id="client_id" name="client_id" required>${clientOpts || `<option value="">No clients yet</option>`}</select></div>
    <div class="field"><label for="name">Brand name</label>
      <input id="name" name="name" value="${esc(values.name ?? "")}" placeholder="Aurora" autofocus required></div>
    <div class="field"><label for="slug">Slug</label>
      <input id="slug" name="slug" value="${esc(values.slug ?? "")}" placeholder="aurora" pattern="[a-z0-9]+(-[a-z0-9]+)*" required>
      <span class="hint">Lowercase words with hyphens. Used in the URL: <code>/&lt;slug&gt;</code></span></div>
    ${catalog.length ? `<div class="field"><label>Products to launch with</label><div class="checks">${checks}</div></div>` : ""}
    <div class="row"><button class="btn" type="submit">Create brand</button><a class="btn quiet" href="/">Cancel</a></div>
  </form>
  <script>
    // Convenience only: fill the slug from the name until the slug is edited.
    (function(){var n=document.getElementById('name'),s=document.getElementById('slug'),t=false;
     s.addEventListener('input',function(){t=true});
     n.addEventListener('input',function(){if(!t)s.value=n.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')});})();
  </script>`;
  return layout("New brand", body);
}

export function editPage(app: Application, products: ProductRow[], flash?: { ok?: string; err?: string }): string {
  const on = new Set(products.filter((p) => p.enabled).map((p) => p.code));
  const rows = products
    .map((p) => {
      const enabled = p.enabled;
      const req = p.requires.length ? `<span class="req">needs ${esc(p.requires.join(", "))}</span>` : "";
      return `<div class="prod">
        <div><span class="pn">${esc(p.display_name || p.name)}</span> <span class="pc">${esc(p.code)}</span></div>
        ${req}
        <form method="post" action="/brands/${encodeURIComponent(app.slug)}/toggle">
          <input type="hidden" name="code" value="${esc(p.code)}">
          <input type="hidden" name="enabled" value="${enabled ? "false" : "true"}">
          <button class="switch ${enabled ? "on" : ""}" type="submit" aria-pressed="${enabled}">${enabled ? "On" : "Off"}</button>
        </form></div>`;
    })
    .join("");
  const memberView = `${webBase()}/${encodeURIComponent(app.slug)}`;
  const body = `<div class="row"><div style="flex:1"><h1>${esc(app.name)}</h1>
      <p class="sub"><span class="slug">${esc(app.slug)}</span> · <span class="status ${esc(app.status)}">${esc(app.status)}</span></p></div>
      <a class="btn quiet" href="${esc(memberView)}" target="_blank" rel="noreferrer">Open member view ↗</a></div>
    ${flash?.ok ? `<div class="notice ok">${esc(flash.ok)}</div>` : ""}
    ${flash?.err ? `<div class="notice err">${esc(flash.err)}</div>` : ""}
    <div class="panel"><label style="display:block;margin-bottom:6px">Products</label>
      <p class="hint" style="margin-bottom:8px">Switch a product on and it appears in this brand's app — nav, onboarding and API — with no deploy. Off is non-destructive.</p>
      ${rows || `<p class="hint">No products in the catalogue.</p>`}</div>
    <form method="post" action="/brands/${encodeURIComponent(app.slug)}/publish">
      <button class="btn" type="submit"${app.status === "published" ? " disabled" : ""}>${app.status === "published" ? "Published" : "Publish brand"}</button>
    </form>
    <p class="hint" style="margin-top:20px"><a href="/">← All brands</a></p>`;
  void on;
  return layout(app.name, body);
}

export function errorPage(status: number, message: string): string {
  return layout(String(status), `<div class="empty"><h1>${status}</h1><p>${esc(message)}</p><p><a href="/">← All brands</a></p></div>`);
}
