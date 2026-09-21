// Discovery domain model (brief §22). One persistent object accumulates the
// answers; every AI call gets the structured context of prior steps.

export interface Industry { slug: string; label: string }
export interface Challenge { id: string; label: string; blurb?: string }

export interface Blueprint {
  understood: string;
  solutionName: string;
  users: string[];
  workflow: string[];
  aiOpportunities: string[];
}

export interface SolutionDiscovery {
  industry: Industry | null;
  /** The chosen challenge label, or the client's own words. */
  challenge: string | null;
  challengeCustom: boolean;
  stakeholders: string[];
  outcomes: string[];
  blueprint?: Blueprint;
}

// A basic, interactive prototype generated from the blueprint (brief §25-27).
// Deliberately a demo shell: enough to prove understanding, not a production app.
export interface PrototypeNav { id: string; label: string; locked: boolean }
export interface PrototypeStat { label: string; value: string; hint?: string }
export interface PrototypeItem { id: string; title: string; assignee: string; status: string; priority: "High" | "Normal" | "Low" }
export interface PrototypeAIResult { summary: string; recommendation: string; flags: string[] }
export interface PrototypeSpec {
  appName: string;
  workflowLabel: string;
  nav: PrototypeNav[];
  stats: PrototypeStat[];
  items: PrototypeItem[];
  aiActionLabel: string;
  aiResult: PrototypeAIResult;
}

export const emptyDiscovery: SolutionDiscovery = {
  industry: null,
  challenge: null,
  challengeCustom: false,
  stakeholders: [],
  outcomes: [],
};

/**
 * The AI service the flow depends on. Today a curated mock (see mockService);
 * a real adapter (Anthropic via a gateway, or the XAPPY chat server) can
 * implement the same interface later with no UI changes (brief §38).
 */
export interface DiscoveryAIService {
  getIndustries(): Industry[];
  getChallenges(industrySlug: string): Promise<Challenge[]>;
  getStakeholders(industrySlug: string, challenge: string): Promise<string[]>;
  getOutcomes(industrySlug: string, challenge: string): Promise<string[]>;
  generateBlueprint(d: SolutionDiscovery): Promise<Blueprint>;
  generatePrototype(d: SolutionDiscovery): Promise<PrototypeSpec>;
}
