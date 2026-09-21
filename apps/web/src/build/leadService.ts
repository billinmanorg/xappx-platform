import type { PlanId } from "./plans";

/* Lead capture (brief §30/§51): send the sales/solutions team an informed lead
   carrying the whole discovery, not a blank form. Behind an interface with a
   mock (brief §38) — swap in a real adapter later (email, CRM, or Netlify
   Forms on the staging host) without changing the UI. */

export interface LeadPayload {
  name: string;
  email: string;
  company: string;
  message?: string;
  plan: PlanId;
  complexity: PlanId;
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

const mockLeadService: LeadService = {
  async submit(payload) {
    // No backend yet: persist locally so nothing is lost and the flow is real.
    try {
      const key = "xappx_leads";
      const arr = JSON.parse(localStorage.getItem(key) || "[]");
      arr.push(payload);
      localStorage.setItem(key, JSON.stringify(arr));
    } catch { /* ignore storage errors */ }
    await new Promise((r) => setTimeout(r, 900));
    return { ok: true };
  },
};

export function getLeadService(): LeadService {
  return mockLeadService;
}
