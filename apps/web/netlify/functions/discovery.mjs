// Server-side discovery proxy. Holds ANTHROPIC_API_KEY (never sent to the
// browser) and returns structured JSON for the /build flow. If the key is
// missing or anything fails, it returns { fallback: true } so the client
// gracefully uses its curated data — nothing breaks, no cost until enabled.

const MODEL = process.env.LLM_MODEL || "claude-haiku-4-5-20251001";
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
const clean = (s, max) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, max);

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
  const key = process.env.ANTHROPIC_API_KEY;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
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

export default async (req) => {
  if (!process.env.ANTHROPIC_API_KEY) return json({ fallback: true });
  let body;
  try { body = await req.json(); } catch { return json({ fallback: true }); }
  const { kind, industry, challenge, discovery } = body || {};

  try {
    let data;
    if (kind === "challenges") {
      const out = extractJson(await complete(
        'You scope software projects. Given an industry, list the concrete problems businesses in it hire software to solve — specific to the industry, not generic. Reply with ONLY a JSON array of 5 objects: {"id": short kebab slug, "label": string <=7 words plain language, "blurb": string <=12 words}. No markdown.',
        `Industry: ${industry}`, 700));
      data = Array.isArray(out)
        ? out.map((o, i) => ({ id: clean(o.id || "c" + i, 40) || "c" + i, label: clean(o.label, 60), blurb: clean(o.blurb, 90) || undefined })).filter((o) => o.label).slice(0, 6)
        : [];
      if (!data.length) throw new Error("empty");
    } else if (kind === "stakeholders") {
      const out = extractJson(await complete(
        "Given an industry and a business challenge, list the 6-7 people/roles most involved in that workflow. Reply with ONLY a JSON array of short strings (<=4 words each). No markdown.",
        `Industry: ${industry}\nChallenge: ${challenge}`, 400));
      data = Array.isArray(out) ? out.map((s) => clean(s, 40)).filter(Boolean).slice(0, 8) : [];
      if (!data.length) throw new Error("empty");
    } else if (kind === "outcomes") {
      const out = extractJson(await complete(
        "Given an industry and challenge, list 4-5 concrete outcomes a good solution should achieve. Reply with ONLY a JSON array of short strings (<=6 words each). No markdown.",
        `Industry: ${industry}\nChallenge: ${challenge}`, 400));
      data = Array.isArray(out) ? out.map((s) => clean(s, 60)).filter(Boolean).slice(0, 6) : [];
      if (!data.length) throw new Error("empty");
    } else if (kind === "blueprint") {
      const d = discovery || {};
      const out = extractJson(await complete(
        'You are a solution architect. From the discovery, produce a concise solution blueprint that keeps humans in control of key decisions. Reply with ONLY JSON: {"understood": 1-2 sentence summary, "solutionName": string <=6 words, "users": array of strings, "workflow": array of 4-6 short step strings, "aiOpportunities": array of 3-5 short strings}. No markdown.',
        `Industry: ${d.industry?.label || ""}\nChallenge: ${d.challenge || ""}\nUsers: ${(d.stakeholders || []).join(", ")}\nOutcomes: ${(d.outcomes || []).join(", ")}`, 800));
      data = {
        understood: clean(out.understood, 400),
        solutionName: clean(out.solutionName, 80) || "Your AI-assisted solution",
        users: Array.isArray(out.users) ? out.users.map((s) => clean(s, 60)).filter(Boolean) : [],
        workflow: Array.isArray(out.workflow) ? out.workflow.map((s) => clean(s, 80)).filter(Boolean) : [],
        aiOpportunities: Array.isArray(out.aiOpportunities) ? out.aiOpportunities.map((s) => clean(s, 80)).filter(Boolean) : [],
      };
      if (!data.workflow.length || !data.understood) throw new Error("empty");
    } else {
      return json({ fallback: true });
    }
    return json({ ok: true, data });
  } catch {
    return json({ fallback: true });
  }
};
