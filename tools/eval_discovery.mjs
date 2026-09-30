// XAPPX /build evaluation harness
// ---------------------------------
// Runs a fixed set of real-world industry problems through the SAME discovery
// pipeline the /build flow uses (challenges -> stakeholders -> outcomes ->
// blueprint), by calling the deployed Netlify discovery function. It then
// writes one grouped, score-ready HTML report for Bill & Narinder to review.
//
// The AI key lives ONLY on Netlify (server-side). This script never sees it.
// If the key is not set on the site, every call returns { fallback: true } and
// the report marks the item "AI not enabled" — set the key on Netlify and rerun
// to get the real AI output.
//
// Usage:
//   node tools/eval_discovery.mjs
//   ENDPOINT=https://xappx-staging.netlify.app/.netlify/functions/discovery node tools/eval_discovery.mjs
//   node tools/eval_discovery.mjs --out tools/eval-report.html

const ENDPOINT = process.env.ENDPOINT || "https://xappx-app.netlify.app/.netlify/functions/discovery";
const OUT = (() => { const i = process.argv.indexOf("--out"); return i > -1 ? process.argv[i + 1] : "tools/eval-report.html"; })();
const CONCURRENCY = Number(process.env.CONCURRENCY || 4);

// 25 real problems, 2-3 per industry across the ones we identified (+ a few from
// the expanded list). Each is what a real business would actually say.
const PROBLEMS = [
  ["Financial Services", "Onboarding new clients takes weeks of manual KYC checks and chasing documents."],
  ["Financial Services", "Loan officers spend hours summarizing applications and flagging risk by hand."],
  ["Healthcare", "Clinic staff lose hours to insurer prior-authorization paperwork."],
  ["Healthcare", "Patients miss appointments and no-shows are never followed up."],
  ["Retail", "Support is buried under 'where is my order' and return requests."],
  ["Retail", "Product listings are inconsistent and slow to create across channels."],
  ["E-Commerce", "Abandoned carts aren't recovered and promos aren't personalized."],
  ["Manufacturing", "Unplanned machine downtime isn't predicted and spare parts run out."],
  ["Manufacturing", "Quality inspection is manual and defects are caught too late."],
  ["Logistics", "Dispatchers plan routes by hand and can't react to delays."],
  ["Logistics", "Proof-of-delivery and exception handling is still paper-based."],
  ["Real Estate", "Leads from listings aren't qualified or followed up fast enough."],
  ["Real Estate", "Lease and contract review is slow and error-prone."],
  ["Professional Services", "Consultants spend billable hours writing proposals and status reports."],
  ["Professional Services", "Client intake and scoping is inconsistent between partners."],
  ["Education & Training", "Instructors spend hours grading and giving feedback on assignments."],
  ["Education & Training", "Prospective students' questions go unanswered after hours."],
  ["Hospitality & Tourism", "Guest inquiries and booking changes overwhelm the front desk."],
  ["Hospitality & Tourism", "Reviews across platforms aren't monitored or answered."],
  ["IT & Software", "Support tickets are triaged manually and SLAs slip."],
  ["Insurance", "Claims intake needs manual data entry from photos and PDFs."],
  ["Legal Services", "Contract drafting and clause review eats junior lawyers' time."],
  ["Agriculture & Allied", "Crop, equipment and compliance records are on paper and hard to act on."],
  ["Marketing & Advertising", "Campaign reporting is stitched together by hand from many tools."],
  ["Construction & Infrastructure", "RFIs and change orders get lost across email and spreadsheets."],
];

async function call(kind, payload) {
  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, ...payload }),
    });
    if (!r.ok) return { fallback: true, error: "http " + r.status };
    const d = await r.json();
    if (!d || d.fallback || !d.ok) return { fallback: true };
    return { data: d.data };
  } catch (e) {
    return { fallback: true, error: String(e && e.message || e) };
  }
}

// Challenges are per-industry — fetch once and cache.
const challengeCache = new Map();
async function challengesFor(industry) {
  if (!challengeCache.has(industry)) challengeCache.set(industry, call("challenges", { industry }));
  return challengeCache.get(industry);
}

async function runOne([industry, problem], idx) {
  const [ch, roles, outc] = await Promise.all([
    challengesFor(industry),
    call("stakeholders", { industry, challenge: problem }),
    call("outcomes", { industry, challenge: problem }),
  ]);
  const bp = await call("blueprint", {
    discovery: {
      industry: { label: industry },
      challenge: problem,
      stakeholders: (roles.data || []),
      outcomes: (outc.data || []),
    },
  });
  const live = [ch, roles, outc, bp].some((r) => r.data);
  process.stdout.write(`  [${idx + 1}/${PROBLEMS.length}] ${industry} — ${live ? "AI" : "fallback"}\n`);
  return { industry, problem, challenges: ch, stakeholders: roles, outcomes: outc, blueprint: bp, live };
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  });
  await Promise.all(workers);
  return out;
}

// ---- report rendering ----
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const chips = (arr) => (arr && arr.length) ? `<div class="chips">${arr.map((x) => `<span class="chip">${esc(x.label || x)}</span>`).join("")}</div>` : `<span class="none">—</span>`;

function card(r, n) {
  const bp = r.blueprint.data;
  const badge = r.live ? `<span class="b b-ai">AI</span>` : `<span class="b b-fb">AI not enabled</span>`;
  return `
  <article class="card">
    <header><span class="num">${n}</span><h3>${esc(r.problem)}</h3>${badge}</header>
    <div class="grid">
      <section><h4>Suggested challenges for ${esc(r.industry)}</h4>${chips(r.challenges.data)}</section>
      <section><h4>Stakeholders inferred</h4>${chips(r.stakeholders.data)}</section>
      <section><h4>Target outcomes</h4>${chips(r.outcomes.data)}</section>
    </div>
    <section class="bp">
      <h4>Generated blueprint</h4>
      ${bp ? `
        <p class="sol"><b>${esc(bp.solutionName)}</b></p>
        <p class="understood">${esc(bp.understood)}</p>
        <div class="grid2">
          <div><h5>Workflow</h5><ol>${(bp.workflow || []).map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>
          <div><h5>AI opportunities</h5><ul>${(bp.aiOpportunities || []).map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>
        </div>` : `<p class="none">AI not enabled — set ANTHROPIC_API_KEY on Netlify and rerun.</p>`}
    </section>
    <table class="score">
      <tr><th>Relevant?</th><th>Specific (not generic)?</th><th>Right solution?</th><th>Would a client pay?</th><th>Reviewer notes</th></tr>
      <tr><td></td><td></td><td></td><td></td><td></td></tr>
    </table>
  </article>`;
}

function render(results) {
  const byIndustry = new Map();
  for (const r of results) { if (!byIndustry.has(r.industry)) byIndustry.set(r.industry, []); byIndustry.get(r.industry).push(r); }
  const liveCount = results.filter((r) => r.live).length;
  let n = 0;
  const sections = [...byIndustry.entries()].map(([ind, rs]) =>
    `<h2>${esc(ind)}</h2>${rs.map((r) => card(r, ++n)).join("")}`).join("");
  const engine = liveCount === results.length ? "Live AI (real output)" : liveCount === 0 ? "AI NOT enabled (fallback shown — set the key on Netlify and rerun)" : `Partial (${liveCount}/${results.length} live)`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>XAPPX /build — Problem Test Report</title><style>
:root{--ink:#070A10;--ink2:#0E141F;--line:#1C2636;--on:#EDF2FA;--dim:#93A3BC;--body:#C7D2E4;--cyan:#00C2FF;--grad:linear-gradient(100deg,#00C2FF,#2f7bff,#8A73FF)}
*{box-sizing:border-box}body{margin:0;background:var(--ink);color:var(--on);font-family:"Segoe UI",system-ui,sans-serif;line-height:1.55}
.wrap{max-width:1000px;margin:0 auto;padding:32px 22px 80px}
h1{font-size:30px;margin:0 0 4px}.sub{color:var(--dim);font-size:14px;margin:0 0 6px}
.eng{display:inline-block;font-size:13px;padding:5px 12px;border-radius:999px;border:1px solid var(--line);background:var(--ink2);margin:10px 0 24px}
h2{font-size:15px;letter-spacing:.14em;text-transform:uppercase;color:var(--cyan);margin:34px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}
.card{border:1px solid var(--line);background:var(--ink2);border-radius:14px;padding:18px 20px;margin:14px 0}
.card header{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.num{font:700 13px ui-monospace,monospace;color:var(--dim)}
.card h3{font-size:17px;margin:0;flex:1}
.b{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;letter-spacing:.08em}
.b-ai{background:rgba(0,194,255,.15);color:var(--cyan);border:1px solid rgba(0,194,255,.4)}
.b-fb{background:#2a1d0a;color:#e9b872;border:1px solid #5a4415}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:8px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
h4{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin:0 0 6px}
h5{font-size:13px;margin:0 0 4px;color:var(--on)}
.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{font-size:12.5px;background:#0b1220;border:1px solid var(--line);border-radius:8px;padding:4px 9px;color:var(--body)}
.none{color:var(--dim);font-style:italic;font-size:13px}
.bp{margin-top:12px;border-top:1px solid var(--line);padding-top:12px}
.sol{margin:2px 0;font-size:16px}.understood{color:var(--body);margin:4px 0 10px}
ol,ul{margin:4px 0;padding-left:20px}li{color:var(--body);font-size:13.5px;margin:2px 0}
.score{width:100%;border-collapse:collapse;margin-top:14px;font-size:12.5px}
.score th{background:#0b1220;color:var(--dim);font-weight:600;text-align:left}
.score th,.score td{border:1px solid var(--line);padding:7px 9px}.score td{height:34px}
@media(max-width:760px){.grid,.grid2{grid-template-columns:1fr}}
</style></head><body><div class="wrap">
<h1>XAPPX /build — Problem Test Report</h1>
<p class="sub">${results.length} real problems across ${byIndustry.size} industries · Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} · Endpoint: ${esc(ENDPOINT)}</p>
<div class="eng">Engine: ${esc(engine)}</div>
<p class="sub">For each problem, XAPPX ran the same pipeline the live site uses. Score each card, then we iterate the prompts on anything weak.</p>
${sections}
</div></body></html>`;
}

(async () => {
  console.log(`Running ${PROBLEMS.length} problems against ${ENDPOINT} ...`);
  const results = await pool(PROBLEMS, CONCURRENCY, runOne);
  const { writeFileSync } = await import("node:fs");
  writeFileSync(OUT, render(results));
  const live = results.filter((r) => r.live).length;
  console.log(`\nDone. ${live}/${results.length} returned real AI output.`);
  console.log(`Report: ${OUT}`);
  if (live === 0) console.log("NOTE: AI not enabled on the endpoint — set ANTHROPIC_API_KEY on Netlify and rerun for real output.");
})();
