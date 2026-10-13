import type { DiscoveryContext, ProblemId } from "./types";

export interface Choice<T extends string = string> { id: T; label: string }
export interface ProblemDefinition {
  id: ProblemId;
  label: string;
  goals: readonly Choice[];
  /** Compatible legacy label for the AppSpec adapter, never a live-service call. */
  legacyChallenge: string;
}

export const EVENTS_INDUSTRY = { slug: "events_conferences", label: "Events & Conferences" };
export const ANOTHER_GOAL = "another-goal";
export const MAX_NOTE_LENGTH = 500;

export const LEGACY_CHALLENGES = {
  registration: "Registration & check-in is slow and manual",
  engagement: "Attendees don't engage during the event",
  matchmaking: "Sponsors & exhibitors want better leads",
  agenda: "Attendees can't navigate a packed agenda",
  followup: "Post-event follow-up & ROI is weak",
  logistics: "Organizer comms & logistics are chaotic",
} as const;

const anotherGoal = { id: ANOTHER_GOAL, label: "Another goal" };

export const PROBLEMS: readonly ProblemDefinition[] = [
  {
    id: "registration", label: "Registration and check-in", legacyChallenge: LEGACY_CHALLENGES.registration,
    goals: [
      { id: "cut-check-in-lines", label: "Cut check-in lines" },
      { id: "issue-badges-qr", label: "Auto-issue badges & QR passes" },
      { id: "review-registration-exceptions", label: "Catch duplicate or unpaid registrations" },
      { id: "attendance-overview", label: "Give organizers a live headcount" }, anotherGoal,
    ],
  },
  {
    id: "engagement", label: "Attendee engagement", legacyChallenge: LEGACY_CHALLENGES.engagement,
    goals: [
      { id: "drive-session-attendance", label: "Drive session attendance" },
      { id: "answer-attendee-questions", label: "Answer attendee questions instantly" },
      { id: "capture-feedback-polls", label: "Capture live feedback & polls" },
      { id: "grow-participation", label: "Grow networking and activity participation" }, anotherGoal,
    ],
  },
  {
    id: "networking", label: "Networking and matchmaking", legacyChallenge: "Networking and matchmaking",
    goals: [
      { id: "match-relevant-attendees", label: "Meet people with shared interests" },
      { id: "schedule-networking-meetings", label: "Schedule networking meetings" },
      { id: "enable-warm-intros", label: "Enable warm intros, not cold badge scans" },
      { id: "networking-follow-up", label: "Keep new connections moving" }, anotherGoal,
    ],
  },
  {
    id: "sponsor-leads", label: "Sponsor leads", legacyChallenge: LEGACY_CHALLENGES.matchmaking,
    goals: [
      { id: "capture-qualified-leads", label: "Capture qualified leads" },
      { id: "match-attendees-sponsors", label: "Match attendees to the right sponsors" },
      { id: "prove-sponsor-roi", label: "Prove sponsor ROI" },
      { id: "enable-warm-intros", label: "Enable warm intros, not cold badge scans" }, anotherGoal,
    ],
  },
  {
    id: "speaker-submissions", label: "Speaker submissions", legacyChallenge: "Speaker submissions",
    goals: [
      { id: "review-speaker-submissions", label: "Review speaker submissions" },
      { id: "assign-reviewers", label: "Coordinate reviewer assignments" },
      { id: "balance-topic-coverage", label: "Balance topic coverage" },
      { id: "schedule-speakers", label: "Coordinate speaker schedules" }, anotherGoal,
    ],
  },
  {
    id: "agendas", label: "Agendas and scheduling", legacyChallenge: LEGACY_CHALLENGES.agenda,
    goals: [
      { id: "personalize-agendas", label: "Personalize each attendee's schedule" },
      { id: "balance-room-capacity", label: "Balance overcrowded sessions" },
      { id: "surface-must-see-sessions", label: "Surface must-see sessions" },
      { id: "keep-schedule-on-time", label: "Keep everyone on time" }, anotherGoal,
    ],
  },
  {
    id: "budgets-vendors", label: "Budgets and vendors", legacyChallenge: "Budgets and vendors",
    goals: [
      { id: "organize-vendors", label: "Organize vendor information" },
      { id: "track-event-budget", label: "Track the event budget" },
      { id: "compare-vendor-quotes", label: "Compare vendor quotes" },
      { id: "track-tasks-vendors-rooms", label: "Track tasks, vendors & rooms" }, anotherGoal,
    ],
  },
  {
    id: "event-operations", label: "Event operations", legacyChallenge: LEGACY_CHALLENGES.logistics,
    goals: [
      { id: "react-to-issues", label: "React to issues in real time" },
      { id: "centralize-schedule-changes", label: "Centralize schedules & changes" },
      { id: "coordinate-staff-changes", label: "Alert staff & attendees instantly" },
      { id: "track-tasks-vendors-rooms", label: "Track tasks, vendors & rooms" }, anotherGoal,
    ],
  },
  {
    id: "follow-up", label: "Post-event follow-up", legacyChallenge: LEGACY_CHALLENGES.followup,
    goals: [
      { id: "plan-recaps", label: "Automate thank-you & recap" },
      { id: "deliver-recordings", label: "Deliver session recordings & summaries" },
      { id: "nurture-event-leads", label: "Nurture leads after the event" },
      { id: "report-event-roi", label: "Report ROI to every stakeholder" }, anotherGoal,
    ],
  },
];

export const SCALES: readonly Choice<NonNullable<DiscoveryContext["scale"]>>[] = [
  { id: "under-100", label: "Under 100 attendees" },
  { id: "100-500", label: "100–500 attendees" },
  { id: "501-2000", label: "501–2,000 attendees" },
  { id: "over-2000", label: "Over 2,000 attendees" },
  { id: "unsure", label: "Not sure yet" },
];

export const PRIORITIES: readonly Choice<NonNullable<DiscoveryContext["priority"]>>[] = [
  { id: "speed", label: "Speed" }, { id: "visibility", label: "Visibility" },
  { id: "accuracy", label: "Accuracy" }, { id: "coordination", label: "Coordination" },
];
