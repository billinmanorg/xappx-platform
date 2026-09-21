import { mockService } from "./discoveryService";
import type { Blueprint, Challenge, DiscoveryAIService, SolutionDiscovery } from "./types";

/* Live adapter: calls the server-side discovery function (which holds the API
   key). Every method falls back to the curated mock on any failure — no key,
   function down, timeout, or bad JSON — so the flow is always usable and the
   real AI simply upgrades it when configured (brief §37/§38). */

const ENDPOINT = "/.netlify/functions/discovery";
const label = (slug: string) => mockService.getIndustries().find((i) => i.slug === slug)?.label ?? slug;

async function call(kind: string, payload: Record<string, unknown>): Promise<unknown> {
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, ...payload }),
  });
  if (!r.ok) throw new Error("net");
  const d = (await r.json()) as { ok?: boolean; fallback?: boolean; data?: unknown };
  if (!d || d.fallback || !d.ok) throw new Error("fallback");
  return d.data;
}

export const liveService: DiscoveryAIService = {
  getIndustries: () => mockService.getIndustries(),

  getChallenges: async (slug) => {
    try { return (await call("challenges", { industry: label(slug) })) as unknown as Challenge[]; }
    catch { return mockService.getChallenges(slug); }
  },
  getStakeholders: async (slug, challenge) => {
    try { return (await call("stakeholders", { industry: label(slug), challenge })) as unknown as string[]; }
    catch { return mockService.getStakeholders(slug, challenge); }
  },
  getOutcomes: async (slug, challenge) => {
    try { return (await call("outcomes", { industry: label(slug), challenge })) as unknown as string[]; }
    catch { return mockService.getOutcomes(slug, challenge); }
  },
  generateBlueprint: async (d: SolutionDiscovery) => {
    try { return (await call("blueprint", { discovery: d })) as unknown as Blueprint; }
    catch { return mockService.generateBlueprint(d); }
  },
  // The prototype is a UI shell, not an AI-generation target — stays templated.
  generatePrototype: (d) => mockService.generatePrototype(d),
};

export function getDiscoveryService(): DiscoveryAIService {
  return liveService;
}
