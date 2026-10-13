import type { SolutionDiscovery } from "../../src/build/types";
import type { DiscoveryContext, ProblemId } from "../../src/click-preview/types";
import { PROBLEMS } from "../../src/click-preview/problems";

export const EVENTS = { slug: "events_conferences", label: "Events & Conferences" };

export const LEGACY_FIXTURES = [
  { id: "registration", challenge: "Registration & check-in is slow and manual", problem: "registration", outcome: "Cut check-in lines" },
  { id: "engagement", challenge: "Attendees don't engage during the event", problem: "engagement", outcome: "Capture live feedback & polls" },
  { id: "matchmaking", challenge: "Sponsors & exhibitors want better leads", problem: null, outcome: "Capture qualified leads" },
  { id: "agenda", challenge: "Attendees can't navigate a packed agenda", problem: "agendas", outcome: "Balance overcrowded sessions" },
  { id: "followup", challenge: "Post-event follow-up & ROI is weak", problem: "follow-up", outcome: "Nurture leads after the event" },
  { id: "logistics", challenge: "Organizer comms & logistics are chaotic", problem: null, outcome: "Track tasks, vendors & rooms" },
] as const;

export function legacyDiscovery(challenge: string | null = null, outcomes: string[] = []): SolutionDiscovery {
  return {
    industry: { ...EVENTS }, challenge, challengeCustom: false,
    stakeholders: ["Event organizer"], outcomes,
  };
}

export function contextFor(problemId: ProblemId): DiscoveryContext {
  const problem = PROBLEMS.find((item) => item.id === problemId)!;
  return {
    problemId, goalId: problem.goals[0]!.id, scale: "100-500", priority: "visibility",
    note: "", uncoveredNeed: "", legacy: legacyDiscovery(),
  };
}
