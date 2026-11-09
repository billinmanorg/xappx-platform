// Server side of the Agent Organization. The Research agent reads the Twin
// Vault here (the key never reaches the browser) and the Content agent calls
// the model here (same for the API key). Both degrade honestly: when the
// Vault or the AI is not configured, the response says so and the client
// logs it instead of pretending.
//
// Privacy: this endpoint is public (it powers xappx.ai/build), so the Vault
// read returns AGGREGATES ONLY (folder and match counts), never file names or
// contents. Per-client Vault folders come with client sign-in.
//
// POST { action: "research", industry, challenge, outcomes[], stakeholders[] }
//   -> { ok, data: { vault:{configured, folders?, matches?, query?, error?}, ai:{enabled, used}, insights:string[] } }
// POST { action: "content", industry, challenge, appName, summary, outcomes[] }
//   -> { ok, data: { headline, subhead, cta, ai:boolean } }
import { vaultConfigured, vaultGet } from "./_vaultClient.mjs";

const MODEL = process.env.LLM_MODEL || "claude-haiku-4-5-20251001";
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const clean = (s, max) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, max);
const count = (data, ...keys) => {
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === "object") {
    for (const k of keys) if (Array.isArray(data[k])) return data[k].length;
    if (typeof data.total === "number") return data.total;
  }
  return 0;
};

function extractJson(text) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[[{]/);
  if (start === -1) throw new Error("no json");
  const open = raw[start], close = open === "[" ? "]" : "}";
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; }
    else if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error("unbalanced");
  return JSON.parse(raw.slice(start, end + 1));
}

async function complete(system, user, maxTokens) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error("anthropic " + res.status);
    const data = await res.json();
    const text = (data.content || []).find((b) => b.type === "text")?.text;
    if (!text) throw new Error("empty");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** Aggregate-only look at the Vault: how many folders exist, how many files match the industry keyword. */
async function researchVault(industry) {
  if (!vaultConfigured()) return { configured: false };
  const query = clean(industry, 40).split(/[\s&,/]+/).filter((w) => w.length > 3)[0] || clean(industry, 20) || "client";
  const budget = new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 6500));
  const work = Promise.allSettled([vaultGet("/drive/all-folders"), vaultGet("/drive/search", { query })]);
  const result = await Promise.race([work, budget]);
  if (!Array.isArray(result)) return { configured: true, query, error: "timeout" };
  const [folders, search] = result;
  if (folders.status === "rejected" && search.status === "rejected") {
    return { configured: true, query, error: clean(folders.reason?.message || "read_failed", 60) };
  }
  return {
    configured: true,
    query,
    folders: folders.status === "fulfilled" ? count(folders.value, "folders", "items", "data") : 0,
    matches: search.status === "fulfilled" ? count(search.value, "files", "results", "items", "data") : 0,
  };
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const action = body?.action;
  const industry = clean(body?.industry, 80) || "your industry";
  const challenge = clean(body?.challenge, 300) || "the problem";
  const outcomes = Array.isArray(body?.outcomes) ? body.outcomes.map((s) => clean(s, 80)).filter(Boolean).slice(0, 6) : [];
  const stakeholders = Array.isArray(body?.stakeholders) ? body.stakeholders.map((s) => clean(s, 40)).filter(Boolean).slice(0, 8) : [];
  const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY);

  if (action === "research") {
    const [vault, insights] = await Promise.all([
      researchVault(industry).catch((e) => ({ configured: vaultConfigured(), error: clean(e?.message || "read_failed", 60) })),
      (async () => {
        if (!aiEnabled) return [];
        try {
          const out = extractJson(await complete(
            "You are the research agent of XAPPX, a studio that builds AI solutions on the Twin Vault (each party owns its data; the AI acts only on what they authorize). Given an industry and a specific business problem, list what a solution designer must know before building: existing data the business already holds, the two or three failure points in today's manual process, and one measurable baseline to beat. Be concrete to this industry and problem; no generic advice. Reply with ONLY a JSON array of 3-4 short strings (<=18 words each). No markdown.",
            `Industry: ${industry}\nProblem: ${challenge}\nPeople involved: ${stakeholders.join(", ")}\nDesired outcomes: ${outcomes.join("; ")}`, 450));
          return Array.isArray(out) ? out.map((s) => clean(s, 140)).filter(Boolean).slice(0, 4) : [];
        } catch { return []; }
      })(),
    ]);
    return json({ ok: true, data: { vault, ai: { enabled: aiEnabled, used: insights.length > 0 }, insights } });
  }

  if (action === "content") {
    const appName = clean(body?.appName, 80) || "Your solution";
    const summary = clean(body?.summary, 400);
    const fallback = {
      headline: appName,
      subhead: summary || `Built for ${industry} teams who need ${outcomes[0] ? outcomes[0].toLowerCase() : "results they can see"}.`,
      cta: "See it in action",
      ai: false,
    };
    if (!aiEnabled) return json({ ok: true, data: fallback });
    try {
      const out = extractJson(await complete(
        "You write launch copy for software products the way a top agency would: specific, confident, no jargon, no words like streamline, leverage, empower, seamless or revolutionize. Reply with ONLY JSON: {\"headline\": <=9 words naming the outcome, \"subhead\": one sentence <=24 words saying who it is for and what changes, \"cta\": <=4 words}. No markdown.",
        `Product: ${appName}\nIndustry: ${industry}\nProblem it solves: ${challenge}\nSummary: ${summary}\nOutcomes: ${outcomes.join("; ")}`, 300));
      const data = { headline: clean(out.headline, 90), subhead: clean(out.subhead, 200), cta: clean(out.cta, 30) || "See it in action", ai: true };
      if (!data.headline || !data.subhead) throw new Error("empty");
      return json({ ok: true, data });
    } catch {
      return json({ ok: true, data: fallback });
    }
  }

  return json({ error: "unknown_action" }, 400);
};
