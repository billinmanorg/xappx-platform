/* Lead capture: send the solutions team an informed lead carrying the whole
   discovery. Delivery is via Netlify Forms (the site is on Netlify), so leads
   arrive by email with no extra service — set the notification recipient
   (xappx@gmail.com) in Netlify → Forms → Notifications. A local copy is also
   kept as a backup so nothing is ever lost. */

export interface LeadPayload {
  name: string;
  email: string;
  company: string;
  message?: string;
  industry?: string;
  challenge?: string;
  stakeholders: string[];
  outcomes: string[];
  blueprintName?: string;
  submittedAt: number;
}

export interface LeadService {
  /** `emailed` is true when the acknowledgement email to the client was sent. */
  submit(payload: LeadPayload): Promise<{ ok: boolean; emailed: boolean }>;
}

/** Ask the server to email the client (and the team). Never blocks or fails the submission. */
async function notify(payload: LeadPayload, kind: "build" | "solutions"): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch("/.netlify/functions/notify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        kind, name: payload.name, email: payload.email, company: payload.company,
        product: payload.industry || "XAPPX", challenge: payload.challenge, message: payload.message, blueprintName: payload.blueprintName,
      }),
    });
    window.clearTimeout(t);
    if (!r.ok) return false;
    const j = (await r.json()) as { sent?: { client?: boolean } };
    return Boolean(j.sent?.client);
  } catch {
    return false;
  }
}

const FORM_NAME = "xappx-lead";
const encode = (data: Record<string, string>) =>
  Object.entries(data).map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");

function backup(payload: LeadPayload) {
  try {
    const key = "xappx_leads";
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push(payload);
    localStorage.setItem(key, JSON.stringify(arr));
  } catch { /* ignore storage errors */ }
}

const netlifyLeadService: LeadService = {
  async submit(payload) {
    backup(payload); // keep a local copy regardless
    const body = {
      "form-name": FORM_NAME,
      "bot-field": "",
      name: payload.name,
      email: payload.email,
      company: payload.company,
      message: payload.message || "",
      industry: payload.industry || "",
      challenge: payload.challenge || "",
      stakeholders: payload.stakeholders.join(", "),
      outcomes: payload.outcomes.join(", "),
      blueprint: payload.blueprintName || "",
      "submitted-at": new Date(payload.submittedAt).toISOString(),
    };
    let ok = false;
    try {
      const res = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encode(body),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
    const emailed = ok ? await notify(payload, payload.challenge === "Solutions page enquiry" ? "solutions" : "build") : false;
    return { ok, emailed };
  },
};

export function getLeadService(): LeadService {
  return netlifyLeadService;
}
