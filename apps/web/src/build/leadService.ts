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
  submit(payload: LeadPayload): Promise<{ ok: boolean }>;
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
    try {
      const res = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encode(body),
      });
      return { ok: res.ok };
    } catch {
      return { ok: false };
    }
  },
};

export function getLeadService(): LeadService {
  return netlifyLeadService;
}
