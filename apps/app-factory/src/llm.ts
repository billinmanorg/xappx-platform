/**
 * Thin Anthropic Messages API client for the guided discovery funnel
 * (Narinder's core vision: industry → AI-suggested problems → AI follow-up
 * questions, narrowing with the LLM at each step). See docs/open-questions.md
 * B3: the provider is configurable and the wizard MUST still work without it.
 *
 * No SDK dependency — Node 22+ has native fetch. The API key is read from the
 * environment only (ANTHROPIC_API_KEY); it is never logged, returned to the
 * browser, or committed. Every call has a hard timeout and every caller falls
 * back to the static question set on any failure, so the wizard never hangs or
 * breaks when the key is missing, the network is slow, or the model misbehaves.
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.LLM_MODEL ?? "claude-haiku-4-5-20251001";
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 12000);

/** True when an API key is configured. The wizard degrades gracefully when false. */
export function llmEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** A suggested problem to show as a selectable option. */
export interface ProblemSuggestion { label: string; blurb?: string }
/** A follow-up clarifying question with selectable options. */
export interface FollowUp { question: string; options: string[] }

/** Call the model and return the first text block. Throws on any non-2xx or timeout. */
async function complete(system: string, user: string, maxTokens: number): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("no api key");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (data.content ?? []).find((b) => b.type === "text")?.text;
    if (!text) throw new Error("empty completion");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** Pull the first JSON value out of a model reply, tolerating ```json fences and prose. */
function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const raw = fenced ? fenced[1]! : text;
  const start = raw.search(/[[{]/);
  if (start === -1) throw new Error("no json in reply");
  // Walk to the matching close so trailing prose can't break the parse.
  const open = raw[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error("unbalanced json in reply");
  return JSON.parse(raw.slice(start, end + 1));
}

const clean = (s: unknown, max: number): string => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * Ask the model for the concrete problems businesses in an industry hire
 * software to solve — the "is your problem one of these?" list. Returns 4–6
 * short, non-overlapping options. Throws on failure so the caller can fall back.
 */
export async function suggestProblems(industry: string): Promise<ProblemSuggestion[]> {
  const system =
    "You help scope software projects. Given an industry, list the concrete, common problems " +
    "that businesses in that industry hire software to solve. Be specific to the industry, not generic. " +
    "Reply with ONLY a JSON array of 5 objects: {\"label\": string (<= 7 words, plain language, no jargon), " +
    "\"blurb\": string (<= 12 words)}. No markdown, no commentary.";
  const out = extractJson(await complete(system, `Industry: ${industry}`, 700));
  if (!Array.isArray(out)) throw new Error("expected array");
  const items = out
    .map((o) => ({ label: clean((o as any)?.label, 60), blurb: clean((o as any)?.blurb, 90) || undefined }))
    .filter((o) => o.label.length > 0)
    .slice(0, 6);
  if (items.length === 0) throw new Error("no usable problems");
  return items;
}

/**
 * Given the industry and the chosen/described problem, return up to 3 short
 * multiple-choice questions that narrow the scope further (Narinder's "next set
 * of selectable questions"). Throws on failure so the caller can fall back.
 */
export async function followUpQuestions(industry: string, problem: string): Promise<FollowUp[]> {
  const system =
    "You scope software projects by asking a few sharp, multiple-choice questions. " +
    "Given an industry and the problem to solve, return the 2-3 most useful clarifying questions. " +
    "Reply with ONLY a JSON array of objects: {\"question\": string (<= 12 words), " +
    "\"options\": array of 3-5 short strings (<= 5 words each)}. No markdown, no commentary.";
  const out = extractJson(await complete(system, `Industry: ${industry}\nProblem: ${problem}`, 700));
  if (!Array.isArray(out)) throw new Error("expected array");
  const items = out
    .map((q) => ({
      question: clean((q as any)?.question, 120),
      options: Array.isArray((q as any)?.options)
        ? (q as any).options.map((o: unknown) => clean(o, 40)).filter((o: string) => o.length > 0).slice(0, 5)
        : [],
    }))
    .filter((q) => q.question.length > 0 && q.options.length >= 2)
    .slice(0, 3);
  if (items.length === 0) throw new Error("no usable questions");
  return items;
}
