import type { SolutionDiscovery } from "./types";

/* Commercial packages (brief §28-29). Config-driven so the team can change
   copy/pricing without touching components. Prices are intentionally NOT
   hardcoded numbers — the meeting figures were illustrative; set real pricing
   here (or from a CMS/API) when it's confirmed. */

export type PlanId = "standard" | "advanced" | "custom";

export interface SolutionPlan {
  id: PlanId;
  name: string;
  tagline: string;
  priceLabel: string; // e.g. "Fixed project quote" — replace with real pricing when set
  includes: string[];
  cta: string;
}

export const PLANS: SolutionPlan[] = [
  {
    id: "standard",
    name: "Standard Solution",
    tagline: "For a defined problem with a straightforward build.",
    priceLabel: "Fixed project quote",
    includes: ["Complete application", "Core workflows", "Standard AI functions", "Standard integrations", "Deployment & support"],
    cta: "Continue with this solution",
  },
  {
    id: "advanced",
    name: "Advanced / Enterprise",
    tagline: "For larger or more complex requirements.",
    priceLabel: "Custom quote",
    includes: ["Advanced customization", "Multiple workflows", "Complex integrations", "Enterprise security", "Roles & access controls", "Scalable architecture", "Dedicated developers"],
    cta: "Talk to a solution expert",
  },
  {
    id: "custom",
    name: "Custom Engagement",
    tagline: "For highly specialized requirements.",
    priceLabel: "Scoped proposal",
    includes: ["Bespoke architecture", "Deep domain work", "Ongoing partnership"],
    cta: "Request a custom proposal",
  },
];

/** Light complexity read used to recommend a plan and tailor messaging (brief §52).
    Deliberately a simple heuristic, not a fake "AI confidence" number. */
export function classifyComplexity(d: SolutionDiscovery): PlanId {
  const score = d.stakeholders.length + d.outcomes.length + (d.challengeCustom ? 1 : 0);
  if (d.stakeholders.length >= 6 || score >= 10) return "custom";
  if (score >= 5) return "advanced";
  return "standard";
}
