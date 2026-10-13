import type { Blueprint, SolutionDiscovery } from "../build/types";
import { ANOTHER_GOAL, EVENTS_INDUSTRY, LEGACY_CHALLENGES, MAX_NOTE_LENGTH, PRIORITIES, PROBLEMS, SCALES } from "./problems";
import type { DiscoveryContext, ProblemId } from "./types";

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): string => typeof value === "string" ? value.slice(0, MAX_NOTE_LENGTH) : "";
const strings = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map(text))] : [];

function blueprint(value: unknown): Blueprint | undefined {
  if (!object(value) || typeof value.understood !== "string" || typeof value.solutionName !== "string"
    || ![value.users, value.workflow, value.aiOpportunities].every((items) => Array.isArray(items) && items.every((item) => typeof item === "string"))) return undefined;
  return {
    understood: text(value.understood), solutionName: text(value.solutionName),
    users: strings(value.users), workflow: strings(value.workflow), aiOpportunities: strings(value.aiOpportunities),
    ...(typeof value.foundation === "string" ? { foundation: text(value.foundation) } : {}),
  };
}

function safeLegacy(value: unknown): SolutionDiscovery {
  const saved = object(value) ? value : {};
  const savedIndustry = object(saved.industry) ? saved.industry : {};
  const slug = text(savedIndustry.slug);
  const label = text(savedIndustry.label);
  // Industry provenance survives a missing/corrupt display label; it still controls Events entry.
  const industry = slug.trim() ? {
    slug, label: label.trim() ? label : slug === EVENTS_INDUSTRY.slug ? EVENTS_INDUSTRY.label : slug,
  } : null;
  const savedBlueprint = blueprint(saved.blueprint);
  return {
    industry, challenge: typeof saved.challenge === "string" && saved.challenge.trim() ? text(saved.challenge) : null,
    challengeCustom: saved.challengeCustom === true,
    stakeholders: strings(saved.stakeholders), outcomes: strings(saved.outcomes),
    ...(savedBlueprint ? { blueprint: savedBlueprint } : {}),
  };
}

function emptyContext(): DiscoveryContext {
  return { problemId: null, goalId: null, scale: null, priority: null, note: "", uncoveredNeed: "", legacy: safeLegacy(null) };
}

const directLegacyProblems: Partial<Record<keyof typeof LEGACY_CHALLENGES, ProblemId>> = {
  registration: "registration", engagement: "engagement", agenda: "agendas", followup: "follow-up",
};

function legacyKey(challenge: string | null): keyof typeof LEGACY_CHALLENGES | undefined {
  return (Object.keys(LEGACY_CHALLENGES) as (keyof typeof LEGACY_CHALLENGES)[])
    .find((key) => challenge === key || challenge === LEGACY_CHALLENGES[key]);
}

/** Parse only: the entry reads legacy storage once in try/catch; this module never accesses or changes storage. */
export function restoreDiscovery(raw: string | null): { context: DiscoveryContext; needsProblemChoice: boolean; message: string | null } {
  const context = emptyContext();
  if (raw === null) return { context, needsProblemChoice: true, message: null };
  let saved: unknown;
  try { saved = JSON.parse(raw); } catch {
    return { context, needsProblemChoice: true, message: "We couldn't restore saved choices. Choose an event problem to continue." };
  }
  if (!object(saved)) return { context, needsProblemChoice: true, message: "Saved choices were incomplete. Choose an event problem to continue." };

  const modern = "problemId" in saved || "legacy" in saved;
  context.legacy = safeLegacy(modern ? saved.legacy : saved);
  context.note = text(saved.note);
  context.uncoveredNeed = text(saved.uncoveredNeed);
  context.scale = SCALES.find((choice) => choice.id === saved.scale)?.id ?? null;
  context.priority = PRIORITIES.find((choice) => choice.id === saved.priority)?.id ?? null;
  if (!modern && context.legacy.challengeCustom) context.note = text(context.legacy.challenge);

  if (context.legacy.industry && context.legacy.industry.slug !== EVENTS_INDUSTRY.slug) {
    return { context, needsProblemChoice: true,
      message: `Your saved industry is ${context.legacy.industry.label}. Choose an Events & Conferences problem if you'd like to explore this preview.` };
  }

  if (modern) {
    const problem = PROBLEMS.find((item) => item.id === saved.problemId);
    context.problemId = problem?.id ?? null;
    context.goalId = problem?.goals.find((goal) => goal.id === saved.goalId)?.id ?? null;
    const invalid = saved.problemId != null && !problem
      || saved.goalId != null && context.goalId === null
      || saved.scale != null && context.scale === null
      || saved.priority != null && context.priority === null;
    return { context, needsProblemChoice: !problem,
      message: invalid ? "Some saved choices no longer fit. Review your problem and goal choices to continue." : null };
  }

  if (!context.legacy.industry || !context.legacy.challenge || context.legacy.challengeCustom) {
    return { context, needsProblemChoice: true, message: "Choose an Events & Conferences problem. Your saved context is available to review." };
  }
  const key = legacyKey(context.legacy.challenge);
  if (key === "matchmaking") return { context, needsProblemChoice: true,
    message: "Your saved matchmaking problem could mean Networking and matchmaking or Sponsor leads. Choose which to explore; your original context is retained." };
  if (key === "logistics") return { context, needsProblemChoice: true,
    message: "Your saved logistics problem covers event operations, agendas and scheduling, or budgets and vendors. Choose which to explore; your original context is retained." };
  context.problemId = key ? directLegacyProblems[key] ?? null : null;
  const problem = PROBLEMS.find((item) => item.id === context.problemId);
  if (!problem) return { context, needsProblemChoice: true,
    message: "Choose an Events & Conferences problem. Your original challenge is retained for review." };
  const goals = problem.goals.filter((goal) => goal.id !== ANOTHER_GOAL
    && context.legacy.outcomes.some((outcome) => outcome === goal.label || outcome === goal.id));
  const goal = goals.length === 1 ? goals[0] : undefined;
  context.goalId = goal && context.legacy.outcomes.every((outcome) => outcome === goal.label || outcome === goal.id) ? goal.id : null;
  return { context, needsProblemChoice: false,
    message: context.goalId ? null : "Your event problem is restored. Choose a goal to continue; your saved outcomes are retained." };
}

/** Compatible structured selections only. Optional text never becomes an AppSpec instruction. */
export function toLegacyDiscovery(context: DiscoveryContext): SolutionDiscovery {
  const legacy = safeLegacy(context.legacy);
  const problem = PROBLEMS.find((item) => item.id === context.problemId);
  if (!problem) return legacy;
  const goal = problem.goals.find((item) => item.id === context.goalId && item.id !== ANOTHER_GOAL);
  return {
    industry: { ...EVENTS_INDUSTRY }, challenge: problem.legacyChallenge, challengeCustom: false,
    stakeholders: [...legacy.stakeholders], outcomes: goal ? [goal.label] : [],
  };
}
