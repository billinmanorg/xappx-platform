import type { Application, Client, ProductRow, ModuleRow, AppFilters } from "./api.js";

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

/**
 * The application taxonomy from the brief (§7). Types are open-ended — the brief
 * lists "at least these" and ends with "Custom" — so the API stores free text
 * and this is the Factory's curated pick-list. Audience is a closed set.
 */
export const APPLICATION_TYPES: ReadonlyArray<readonly [string, string]> = [
  ["individual", "Individual"],
  ["creator", "Creator or influencer"],
  ["small_business", "Small business"],
  ["professional_services", "Professional services"],
  ["organization", "Organization"],
  ["enterprise", "Enterprise"],
  ["community", "Community"],
  ["social_network", "Social network"],
  ["event", "Event or conference"],
  ["education", "Education or learning"],
  ["membership", "Membership organization"],
  ["client_portal", "Client portal"],
  ["ai_twin", "AI twin application"],
  ["media", "Media application"],
  ["marketplace", "Marketplace"],
  ["rewards", "Rewards or loyalty"],
  ["token_ecosystem", "Token education or ecosystem"],
  ["internal_ops", "Internal operations"],
  ["custom", "Custom application"],
];
export const AUDIENCE_MODELS: ReadonlyArray<readonly [string, string]> = [
  ["b2c", "B2C"],
  ["b2b", "B2B"],
  ["b2b2c", "B2B2C"],
];
/** The eleven lifecycle states (brief §6), in lifecycle order, with UI labels. */
export const STATUS_STATES: ReadonlyArray<readonly [string, string]> = [
  ["discovery", "Discovery"],
  ["draft", "Draft"],
  ["configuring", "Configuring"],
  ["in_development", "In development"],
  ["testing", "Testing"],
  ["pending_approval", "Pending approval"],
  ["published", "Published"],
  ["paused", "Paused"],
  ["archived", "Archived"],
  ["exporting", "Exporting"],
  ["independent", "Independent"],
];
const STATUS_SET = new Set(STATUS_STATES.map(([v]) => v));
export const isStatus = (v: string) => STATUS_SET.has(v);

/** Module lifecycle states (Phase 2 registry), in order, with labels. */
export const MODULE_STATES: ReadonlyArray<readonly [string, string]> = [
  ["available", "Available"],
  ["beta", "Beta"],
  ["coming_soon", "Coming soon"],
  ["retired", "Retired"],
];
const MODULE_STATE: Readonly<Record<string, string>> = Object.fromEntries(MODULE_STATES);
const MODULE_STATE_SET = new Set(MODULE_STATES.map(([v]) => v));
export const isModuleStatus = (v: string) => MODULE_STATE_SET.has(v);
/** A chip for a module's lifecycle state. 'available' is the norm, so it gets no chip. */
function moduleChip(status?: string): string {
  if (!status || status === "available") return "";
  const label = MODULE_STATE[status] ?? status;
  return `<span class="mchip m-${esc(status)}">${esc(label)}</span>`;
}
/**
 * Sensible module pre-selections per application type (brief §7: "the type
 * affects recommended modules"). Only codes that actually exist in the live
 * catalogue are applied, so this can name modules a given install may not have.
 */
export const RECOMMENDED_MODULES: Readonly<Record<string, readonly string[]>> = {
  individual: ["twins", "vault"],
  creator: ["twins", "community", "video_plan"],
  small_business: ["agents", "vault", "community"],
  professional_services: ["agents", "vault"],
  organization: ["community", "vault"],
  enterprise: ["agents", "vault", "vault_premium"],
  community: ["community", "twins"],
  social_network: ["community", "twins"],
  event: ["community"],
  education: ["community", "twins", "vault"],
  membership: ["community", "vault"],
  client_portal: ["vault", "agents"],
  ai_twin: ["twins", "vault", "video_plan"],
  media: ["video_plan", "community"],
  marketplace: ["agents", "community"],
  rewards: ["community"],
  token_ecosystem: ["community"],
  internal_ops: ["agents", "vault"],
  custom: [],
};

/** Suggested user roles per audience model (brief §7 defaults). */
export const ROLE_DEFAULTS: Readonly<Record<string, readonly string[]>> = {
  b2c: ["Consumers", "Members", "Personal profiles"],
  b2b: ["Organizations", "Accounts", "Contacts", "Client administrators", "Staff users"],
  b2b2c: ["Parent organizations", "Delegated organization administrators", "End users"],
};

/** The business & workflow discovery questions (brief §7 wizard step 3). */
export const DISCOVERY_QUESTIONS: ReadonlyArray<{ key: string; label: string; placeholder: string }> = [
  { key: "problem", label: "What problem does the application solve?", placeholder: "The core need it addresses…" },
  { key: "user_goal", label: "What should a user accomplish?", placeholder: "The main thing a member comes to do…" },
  { key: "admin_goal", label: "What should an administrator accomplish?", placeholder: "What the owner runs day to day…" },
  { key: "onboarding", label: "What happens during onboarding?", placeholder: "First steps for a new member…" },
  { key: "workflows", label: "What are the main workflows?", placeholder: "The repeating flows the app supports…" },
];

const TYPE_LABEL = new Map(APPLICATION_TYPES);
const AUDIENCE_LABEL = new Map(AUDIENCE_MODELS);
export const isKnownType = (v: string) => TYPE_LABEL.has(v);
export const isAudienceModel = (v: string) => AUDIENCE_LABEL.has(v);
const typeLabel = (v?: string | null) => (v ? (TYPE_LABEL.get(v) ?? v) : "");
const audienceLabel = (v?: string | null) => (v ? (AUDIENCE_LABEL.get(v) ?? String(v).toUpperCase()) : "");
/** The muted "type · audience" line a card shows, or "" when neither is set. */
function taxoLine(a: Application): string {
  const bits = [typeLabel(a.application_type), audienceLabel(a.audience_model)].filter(Boolean);
  return bits.length ? `<span class="modn">${esc(bits.join(" · "))}</span>` : "";
}

const STYLE = `
  :root{ --cyan:#00C2FF; --violet:#7B5EFF; --navy:#080B12; --panel:#0E141F; --panel2:#131B29;
    --line:#1E2836; --white:#fff; --gray:#8A9BB5; --dim:#5C6B83; --pass:#3DDC97; --amber:#F5C451; --red:#FF6B84;
    --grad:linear-gradient(90deg,#00C2FF,#0066FF 50%,#7B5EFF);
    --sans:system-ui,"Segoe UI",Roboto,sans-serif; --mono:"Cascadia Code",ui-monospace,Consolas,monospace; }
  *{box-sizing:border-box} [hidden]{display:none!important}
  body{margin:0;background:var(--navy);color:var(--white);font-family:var(--sans);line-height:1.55}
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
  textarea{background:var(--navy);border:1px solid var(--line);border-radius:9px;padding:10px 12px;color:var(--white);
           font-family:inherit;font-size:15px;min-height:64px;resize:vertical}
  textarea:focus{outline:none;border-color:var(--cyan)}
  /* wizard */
  .stepper{display:flex;gap:8px;margin:0 0 20px;flex-wrap:wrap}
  .stepper .s{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--dim);padding:6px 12px;
              border:1px solid var(--line);border-radius:999px}
  .stepper .s .num{font-family:var(--mono);font-size:11px;width:18px;height:18px;border-radius:50%;
                   display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line)}
  .stepper .s.on{color:var(--white);border-color:var(--cyan)} .stepper .s.on .num{background:var(--cyan);color:#001018;border-color:transparent}
  .stepper .s.done{color:var(--gray)} .stepper .s.done .num{background:var(--panel2);color:var(--pass);border-color:transparent}
  .step[hidden]{display:none}
  .wnav{display:flex;gap:12px;align-items:center;margin-top:8px}
  .summary{font-size:14px;color:var(--gray)} .summary b{color:var(--white);font-weight:600}
  .rolechips{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
  .rolechips .rc{font-size:12.5px;color:var(--gray);border:1px solid var(--line);border-radius:999px;padding:3px 10px}
  .about{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;font-size:14px;margin-top:4px}
  .about dt{color:var(--gray);font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding-top:2px}
  .about dd{margin:0;color:var(--white)}
  /* filter bar */
  .filters{display:flex;flex-wrap:wrap;gap:10px;align-items:end;background:var(--panel);border:1px solid var(--line);
           border-radius:12px;padding:14px 16px;margin:0 0 8px}
  .filters .ff{display:flex;flex-direction:column;gap:5px}
  .filters .ff label{font-size:10px} .filters select,.filters input{font-size:13.5px;padding:7px 10px;min-width:150px}
  .filters .grow{flex:1;min-width:180px} .filters .grow input{min-width:100%}
  .countline{color:var(--gray);font-size:13px;margin:2px 0 16px} .countline .clear{margin-left:10px}
  .appcard[hidden]{display:none}
  /* module registry */
  .mchip{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;
         padding:2px 7px;border-radius:6px;border:1px solid var(--line);margin-left:8px;vertical-align:middle}
  .mchip.m-beta{color:var(--amber);border-color:rgba(245,196,81,.4)}
  .mchip.m-coming_soon{color:var(--violet);border-color:rgba(123,94,255,.4)}
  .mchip.m-retired{color:var(--dim)}
  .modrow{display:grid;grid-template-columns:1fr auto;gap:6px 16px;align-items:start;
          padding:16px 0;border-bottom:1px solid var(--line)}
  .modrow:last-child{border-bottom:none}
  .modrow .mn{font-weight:640;font-size:16px} .modrow .mc{font-family:var(--mono);font-size:11.5px;color:var(--dim)}
  .modrow .md{color:var(--gray);font-size:13.5px;margin-top:3px}
  .modrow .tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  .tag{font-family:var(--mono);font-size:10.5px;color:var(--gray);border:1px solid var(--line);border-radius:6px;padding:2px 8px}
  .modrow .use{text-align:right;color:var(--gray);font-size:12.5px;white-space:nowrap}
  .modrow .use b{display:block;font-family:var(--mono);font-size:20px;color:var(--white);font-weight:600}
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
  <nav>${nav("/", "Dashboard")}${nav("/apps", "Apps")}${nav("/modules", "Modules")}${nav("/apps/new", "New app")}</nav>
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

/** The Apps list (brief §6) — cards with logo/placeholder, status, and filtering. */
export function appsPage(
  apps: Application[],
  opts: { clients?: Client[]; filters?: AppFilters } = {},
): string {
  const clients = opts.clients ?? [];
  const filters = opts.filters ?? {};
  const clientName = new Map(clients.map((c) => [c.client_id, c.name]));

  const cards = apps
    .map((a) => {
      const memberView = `${webBase()}/${encodeURIComponent(a.slug)}`;
      const owner = clientName.get(a.client_id);
      const search = [a.name, a.slug, typeLabel(a.application_type), owner].filter(Boolean).join(" ").toLowerCase();
      return `<div class="appcard" data-search="${esc(search)}">
        <a href="/apps/${encodeURIComponent(a.slug)}">${monogram(a.name, a.slug)}</a>
        <div class="meta">
          <div class="nm">${esc(a.name)}</div><div class="sl">${esc(a.slug)}</div>
          <div class="foot"><span class="status ${statusClass(a.status)}">${esc(a.status)}</span>${taxoLine(a)}${
            owner ? `<span class="modn">${esc(owner)}</span>` : ""
          }${a.primary_domain ? `<span class="modn">${esc(a.primary_domain)}</span>` : ""}</div>
          <div class="acts"><a href="/apps/${encodeURIComponent(a.slug)}">Configure</a>
            <a href="${esc(memberView)}" target="_blank" rel="noreferrer">Open member view ↗</a></div>
        </div></div>`;
    })
    .join("");

  const sel = (name: keyof AppFilters, current: string | undefined, first: string, options: ReadonlyArray<readonly [string, string]>) =>
    `<select name="${name}"><option value="">${esc(first)}</option>${options
      .map(([v, label]) => `<option value="${v}"${v === current ? " selected" : ""}>${esc(label)}</option>`)
      .join("")}</select>`;

  const clientOpts = clients.map((c) => [c.client_id, c.name] as const);
  const active = Object.values(filters).some(Boolean);
  const filterBar = `<form class="filters" method="get" action="/apps">
      <div class="ff"><label>Client</label>${sel("client_id", filters.client_id, "All clients", clientOpts)}</div>
      <div class="ff"><label>Status</label>${sel("status", filters.status, "Any status", STATUS_STATES)}</div>
      <div class="ff"><label>Type</label>${sel("application_type", filters.application_type, "Any type", APPLICATION_TYPES)}</div>
      <div class="ff"><label>Audience</label>${sel("audience_model", filters.audience_model, "Any audience", AUDIENCE_MODELS)}</div>
      <div class="ff grow"><label>Search</label><input id="appsearch" type="search" placeholder="Filter by name, slug, type or client…" autocomplete="off"></div>
      <button class="btn" type="submit">Apply</button>
    </form>`;

  const count = `<div class="countline"><span id="appcount">${apps.length}</span> app${apps.length === 1 ? "" : "s"}${
    active ? ` match these filters<a class="clear" href="/apps">Clear filters</a>` : ""}</div>`;

  const body = `<div class="row"><div class="spacer"><h1>Apps</h1>
      <p class="sub">Every app on the XAPPX Platform. Launching a new app is configuration first, with custom development available when needed.</p></div>
      <a class="btn" href="/apps/new">New app</a></div>
    ${filterBar}
    ${count}
    ${apps.length ? `<div class="applist">${cards}</div>` : `<div class="empty">No apps match. <a href="/apps">Clear filters</a> or <a href="/apps/new">create one</a>.</div>`}
    <script>
    (function(){
      var box=document.getElementById('appsearch'), count=document.getElementById('appcount');
      if(!box) return;
      box.addEventListener('input',function(){
        var q=box.value.trim().toLowerCase(), n=0;
        document.querySelectorAll('.appcard').forEach(function(c){
          var hit=!q||c.getAttribute('data-search').indexOf(q)>=0; c.hidden=!hit; if(hit)n++;
        });
        count.textContent=n;
      });
    })();
    </script>`;
  return layout("Apps", body, "/apps");
}

/** The module registry (Phase 2): the platform catalogue with lifecycle state and usage. */
export function modulesPage(modules: ModuleRow[]): string {
  const rows = modules
    .map((m) => {
      const tags = [
        m.requires.length ? `<span class="tag">needs ${esc(m.requires.join(", "))}</span>` : "",
        m.billable ? `<span class="tag">billable</span>` : "",
        m.admin_only ? `<span class="tag">admin only</span>` : "",
      ].join("");
      return `<div class="modrow">
        <div><div class="mn">${esc(m.name)}${moduleChip(m.status)} <span class="mc">${esc(m.code)}</span></div>
          ${m.description ? `<div class="md">${esc(m.description)}</div>` : ""}
          ${tags ? `<div class="tags">${tags}</div>` : ""}</div>
        <div class="use"><b>${m.app_count}</b>${m.app_count === 1 ? "app" : "apps"}
          <div style="margin-top:8px"><a href="/modules/${encodeURIComponent(m.code)}">Edit →</a></div></div>
      </div>`;
    })
    .join("");
  const body = `<div class="row"><div class="spacer"><h1>Modules</h1>
      <p class="sub">The platform module catalogue. Switching a module on for an app is done from that app; this is the registry of what exists and where it stands.</p></div></div>
    ${modules.length ? `<div class="panel">${rows}</div>` : `<div class="empty">No modules in the catalogue.</div>`}`;
  return layout("Modules", body, "/modules");
}

/** Edit one module in the registry: its lifecycle state and catalogue metadata. */
export function moduleEditPage(m: ModuleRow, flash?: { ok?: string; err?: string }): string {
  const stateOpts = MODULE_STATES
    .map(([v, label]) => `<option value="${v}"${v === m.status ? " selected" : ""}>${esc(label)}</option>`)
    .join("");
  const tags = [
    m.requires.length ? `<span class="tag">needs ${esc(m.requires.join(", "))}</span>` : "",
    m.billable ? `<span class="tag">billable</span>` : "",
    m.admin_only ? `<span class="tag">admin only</span>` : "",
    `<span class="tag">${m.app_count} app${m.app_count === 1 ? "" : "s"} using it</span>`,
  ].join("");
  const body = `<div class="row"><div class="spacer"><h1>${esc(m.name)}</h1>
      <p class="sub"><span class="sl">${esc(m.code)}</span> · ${moduleChip(m.status) || '<span class="status st-published">Available</span>'}</p></div>
      <a class="btn quiet" href="/modules">← All modules</a></div>
    ${flash?.ok ? `<div class="notice ok">${esc(flash.ok)}</div>` : ""}
    ${flash?.err ? `<div class="notice err">${esc(flash.err)}</div>` : ""}
    <form class="panel" method="post" action="/modules/${encodeURIComponent(m.code)}">
      <div class="field"><label for="status">Lifecycle state</label>
        <select id="status" name="status" style="max-width:260px">${stateOpts}</select>
        <span class="hint">How the module reads across the platform. Retiring one does not switch it off in apps that already use it.</span></div>
      <div class="field"><label for="name">Name</label>
        <input id="name" name="name" value="${esc(m.name)}" required></div>
      <div class="field"><label for="description">Description</label>
        <textarea id="description" name="description" placeholder="What this module does">${esc(m.description ?? "")}</textarea></div>
      <div class="field"><label for="sort_order">Sort order</label>
        <input id="sort_order" name="sort_order" type="number" value="${m.sort_order}" style="max-width:140px">
        <span class="hint">Lower shows first in the registry and module lists.</span></div>
      <div class="field"><label>Capabilities</label><div class="tags">${tags}</div>
        <span class="hint">Dependencies and billing are defined in the catalogue, not edited here.</span></div>
      <div class="row"><button class="btn" type="submit">Save module</button><a class="btn quiet" href="/modules">Cancel</a></div>
    </form>`;
  return layout(m.name, body, "/modules");
}

export interface NewAppValues {
  name?: string; slug?: string; client_id?: string; application_type?: string; audience_model?: string;
  roles?: string; problem?: string; user_goal?: string; admin_goal?: string; onboarding?: string; workflows?: string;
}

/** The guided "Create New App" wizard (brief §7): build → people → discovery → launch. */
export function newPage(clients: Client[], catalog: ModuleRow[], values: NewAppValues = {}, error?: string): string {
  const v = (k: keyof NewAppValues) => esc(values[k] ?? "");
  const clientOpts = clients
    .map((c) => `<option value="${esc(c.client_id)}"${c.client_id === values.client_id ? " selected" : ""}>${esc(c.name)}</option>`)
    .join("");
  const typeOpts = APPLICATION_TYPES
    .map(([val, label]) => `<option value="${val}"${val === values.application_type ? " selected" : ""}>${esc(label)}</option>`)
    .join("");
  const audienceChoices = AUDIENCE_MODELS
    .map(([val, label]) =>
      `<label class="check"><input type="radio" name="audience_model" value="${val}"${
        val === values.audience_model ? " checked" : ""}>${esc(label)}</label>`)
    .join("");
  const checks = catalog
    .map((p) => `<label class="check"><input type="checkbox" name="products" value="${esc(p.code)}" data-code="${esc(p.code)}">${esc(p.name)}</label>`)
    .join("");
  const discovery = DISCOVERY_QUESTIONS
    .map((q) => `<div class="field"><label for="${q.key}">${esc(q.label)}</label>
      <textarea id="${q.key}" name="${q.key}" placeholder="${esc(q.placeholder)}">${v(q.key as keyof NewAppValues)}</textarea></div>`)
    .join("");

  const stepper = ["Build", "People", "Discovery", "Launch"]
    .map((t, i) => `<div class="s" data-dot="${i}"><span class="num">${i + 1}</span>${t}</div>`)
    .join("");

  // Only recommend/seed with modules that actually exist in this catalogue.
  const catalogCodes = JSON.stringify(catalog.map((p) => p.code));

  const body = `<h1>Create new app</h1>
  <p class="sub">Start with what you're building — the type and audience shape the defaults — then name it and launch.</p>
  ${error ? `<div class="notice err">${esc(error)}</div>` : ""}
  <div class="stepper">${stepper}</div>
  <form class="panel" method="post" action="/apps" id="wizard">

    <section class="step" data-step="0">
      <div class="field"><label for="application_type">What are you building?</label>
        <select id="application_type" name="application_type" required>
          <option value="" disabled${values.application_type ? "" : " selected"}>Choose an application type…</option>
          ${typeOpts}</select>
        <span class="hint">Sets recommended modules, navigation and defaults. You can change everything later.</span></div>
      <div class="field"><label>Audience model</label><div class="checks">${audienceChoices}</div>
        <span class="hint">B2C serves members directly · B2B serves organizations · B2B2C serves organizations who serve their own users.</span></div>
    </section>

    <section class="step" data-step="1" hidden>
      <div class="field"><label for="roles">Who uses this app?</label>
        <textarea id="roles" name="roles" placeholder="One role per line — e.g. Members">${v("roles")}</textarea>
        <span class="hint">Suggested from your audience model. Add or remove any; one per line.</span>
        <div class="rolechips" id="rolehints"></div></div>
    </section>

    <section class="step" data-step="2" hidden>
      <p class="hint" style="margin:-4px 0 14px">A few questions to shape templates and onboarding. All optional — skip any.</p>
      ${discovery}
    </section>

    <section class="step" data-step="3" hidden>
      <div class="summary" id="review" style="margin-bottom:16px"></div>
      <div class="field"><label for="client_id">Client</label>
        <select id="client_id" name="client_id" required>${clientOpts || `<option value="">No clients yet</option>`}</select></div>
      <div class="field"><label for="name">App name</label>
        <input id="name" name="name" value="${v("name")}" placeholder="Aurora" required></div>
      <div class="field"><label for="slug">Slug</label>
        <input id="slug" name="slug" value="${v("slug")}" placeholder="aurora" pattern="[a-z0-9]+(-[a-z0-9]+)*" required>
        <span class="hint">Lowercase words with hyphens. Used in the URL: <code>/&lt;slug&gt;</code></span></div>
      ${catalog.length ? `<div class="field"><label>Modules to launch with</label><div class="checks">${checks}</div>
        <span class="hint">Pre-selected for your application type — adjust freely.</span></div>` : ""}
    </section>

    <div class="wnav">
      <button class="btn quiet" type="button" id="back" hidden>← Back</button>
      <button class="btn" type="button" id="next">Continue →</button>
      <button class="btn" type="submit" id="create" hidden>Create app</button>
      <a class="btn quiet" href="/apps">Cancel</a>
    </div>
  </form>
  <script>
  (function(){
    var RECO=${JSON.stringify(RECOMMENDED_MODULES)}, ROLES=${JSON.stringify(ROLE_DEFAULTS)}, CODES=${catalogCodes};
    var TYPES=${JSON.stringify(Object.fromEntries(APPLICATION_TYPES))}, AUD=${JSON.stringify(Object.fromEntries(AUDIENCE_MODELS))};
    var form=document.getElementById('wizard'), steps=form.querySelectorAll('.step'), dots=document.querySelectorAll('.stepper .s');
    var back=document.getElementById('back'), next=document.getElementById('next'), create=document.getElementById('create');
    var typeSel=document.getElementById('application_type'), roles=document.getElementById('roles');
    var name=document.getElementById('name'), slug=document.getElementById('slug'), slugTouched=false, modTouched=false, rolesTouched=false;
    var i=0;
    function audience(){var r=form.querySelector('input[name=audience_model]:checked');return r?r.value:'';}
    function show(){
      for(var k=0;k<steps.length;k++) steps[k].hidden = (k!==i);
      for(var d=0;d<dots.length;d++){dots[d].className='s'+(d===i?' on':(d<i?' done':''));}
      back.hidden=(i===0); next.hidden=(i===steps.length-1); create.hidden=(i!==steps.length-1);
      if(i===1) fillRoles();
      if(i===steps.length-1) review();
      window.scrollTo(0,0);
    }
    function valid(){
      if(i===0 && !typeSel.value){typeSel.reportValidity();return false;}
      return true;
    }
    next.addEventListener('click',function(){if(valid()&&i<steps.length-1){i++;show();}});
    back.addEventListener('click',function(){if(i>0){i--;show();}});
    // slug auto-fill
    slug.addEventListener('input',function(){slugTouched=true;});
    name.addEventListener('input',function(){if(!slugTouched)slug.value=name.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');});
    // recommended modules on type change (until user edits them)
    form.querySelectorAll('input[name=products]').forEach(function(cb){cb.addEventListener('change',function(){modTouched=true;});});
    function applyReco(){
      if(modTouched) return; var rec=RECO[typeSel.value]||[];
      form.querySelectorAll('input[name=products]').forEach(function(cb){cb.checked=rec.indexOf(cb.getAttribute('data-code'))>=0;});
    }
    typeSel.addEventListener('change',applyReco);
    // role suggestions from audience (until user edits the box)
    roles.addEventListener('input',function(){rolesTouched=true;});
    function fillRoles(){
      var def=ROLES[audience()]||[]; var hint=document.getElementById('rolehints');
      hint.innerHTML=def.map(function(r){return '<span class="rc">'+r+'</span>';}).join('');
      if(!rolesTouched && !roles.value.trim() && def.length) roles.value=def.join('\\n');
    }
    function review(){
      var mods=[]; form.querySelectorAll('input[name=products]:checked').forEach(function(cb){mods.push(cb.getAttribute('data-code'));});
      document.getElementById('review').innerHTML='Creating a <b>'+(TYPES[typeSel.value]||'—')+'</b>'+
        (audience()?' · <b>'+AUD[audience()]+'</b>':'')+' app'+
        (mods.length?' with <b>'+mods.length+'</b> module'+(mods.length>1?'s':''):'')+'.';
    }
    show();
  })();
  </script>`;
  return layout("New app", body, "/apps/new");
}

export function editPage(app: Application, products: ProductRow[], flash?: { ok?: string; err?: string }): string {
  const rows = products
    .map((p) => {
      const enabled = p.enabled;
      const req = p.requires.length ? `<span class="req">needs ${esc(p.requires.join(", "))}</span>` : "";
      return `<div class="prod">
        <div><span class="pn">${esc(p.display_name || p.name)}</span>${moduleChip(p.status)} <span class="pc">${esc(p.code)}</span></div>
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
      <p class="sub"><span class="sl">${esc(app.slug)}</span> · <span class="status ${statusClass(app.status)}">${esc(app.status)}</span> ${taxoLine(app)}</p></div>
      <a class="btn quiet" href="${esc(memberView)}" target="_blank" rel="noreferrer">Open member view ↗</a></div>
    ${flash?.ok ? `<div class="notice ok">${esc(flash.ok)}</div>` : ""}
    ${flash?.err ? `<div class="notice err">${esc(flash.err)}</div>` : ""}
    ${statusPanel(app)}
    ${detailsPanel(app)}
    <div class="panel"><label style="display:block;margin-bottom:6px">Modules</label>
      <p class="hint" style="margin-bottom:8px">Switch a module on and it appears in this app — nav, onboarding and API — with no deploy. Off is non-destructive.</p>
      ${rows || `<p class="hint">No modules in the catalogue.</p>`}</div>
    <p class="hint" style="margin-top:20px"><a href="/apps">← All apps</a></p>`;
  return layout(app.name, body, "/apps");
}

/** Lifecycle control: move the app through its eleven states (brief §6). */
function statusPanel(app: Application): string {
  const opts = STATUS_STATES
    .map(([v, label]) => `<option value="${v}"${v === app.status ? " selected" : ""}>${esc(label)}</option>`)
    .join("");
  return `<div class="panel"><label for="status">Lifecycle status</label>
    <form class="row" method="post" action="/apps/${encodeURIComponent(app.slug)}/status" style="margin-top:8px;gap:10px">
      <select id="status" name="status" style="max-width:260px">${opts}</select>
      <button class="btn" type="submit">Update status</button>
    </form>
    <p class="hint" style="margin-top:8px">Setting it to <b>Published</b> takes the app live to members.</p></div>`;
}

/** Editable details: name, domain, type, audience, roles and the intake answers. */
function detailsPanel(app: Application): string {
  const intake = app.intake ?? {};
  const typeOpts = `<option value="">—</option>` + APPLICATION_TYPES
    .map(([v, label]) => `<option value="${v}"${v === app.application_type ? " selected" : ""}>${esc(label)}</option>`).join("");
  const audienceChoices = AUDIENCE_MODELS
    .map(([v, label]) => `<label class="check"><input type="radio" name="audience_model" value="${v}"${
      v === app.audience_model ? " checked" : ""}>${esc(label)}</label>`).join("");
  const rolesVal = esc((intake.roles ?? []).join("\n"));
  const discovery = DISCOVERY_QUESTIONS.map((q) => {
    const val = intake[q.key as keyof typeof intake];
    return `<div class="field"><label for="e_${q.key}">${esc(q.label)}</label>
      <textarea id="e_${q.key}" name="${q.key}" placeholder="${esc(q.placeholder)}">${esc(typeof val === "string" ? val : "")}</textarea></div>`;
  }).join("");
  return `<form class="panel" method="post" action="/apps/${encodeURIComponent(app.slug)}/edit">
    <label style="display:block;margin-bottom:10px">Details</label>
    <div class="field"><label for="e_name">App name</label>
      <input id="e_name" name="name" value="${esc(app.name)}" required></div>
    <div class="field"><label for="e_domain">Primary domain</label>
      <input id="e_domain" name="primary_domain" value="${esc(app.primary_domain ?? "")}" placeholder="app.example.com"></div>
    <div class="field"><label for="e_type">Application type</label>
      <select id="e_type" name="application_type">${typeOpts}</select></div>
    <div class="field"><label>Audience model</label><div class="checks">${audienceChoices}</div></div>
    <div class="field"><label for="e_roles">Roles</label>
      <textarea id="e_roles" name="roles" placeholder="One role per line">${rolesVal}</textarea></div>
    ${discovery}
    <div class="row"><button class="btn" type="submit">Save details</button></div>
  </form>`;
}

export function errorPage(status: number, message: string): string {
  return layout(String(status), `<div class="empty"><h1>${status}</h1><p>${esc(message)}</p><p><a href="/apps">← All apps</a></p></div>`);
}
