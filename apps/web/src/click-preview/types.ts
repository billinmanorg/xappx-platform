import type { SolutionDiscovery } from "../build/types";
import type { AppSpec } from "../build/appSpec";

export type ProblemId =
  | "registration" | "engagement" | "networking" | "sponsor-leads"
  | "speaker-submissions" | "agendas" | "budgets-vendors"
  | "event-operations" | "follow-up";

export type WorkflowId = "sponsor" | "speaker" | "operations";

export interface DiscoveryContext {
  problemId: ProblemId | null;
  goalId: string | null;
  scale: "under-100" | "100-500" | "501-2000" | "over-2000" | "unsure" | null;
  priority: "speed" | "visibility" | "accuracy" | "coordination" | null;
  note: string;
  uncoveredNeed: string;
  legacy: SolutionDiscovery;
}

export type CatalogSolution = {
  id: string;
  title: string;
  problemIds: ProblemId[];
  goalIds: string[];
  priorities: NonNullable<DiscoveryContext["priority"]>[];
  scales: NonNullable<DiscoveryContext["scale"]>[];
  benefit: string;
  functions: string[];
  concept: string;
} & (
  | { buildStatus: "working-preview"; workflowId: WorkflowId }
  | { buildStatus: "recommended-solution"; workflowId?: never }
);

export interface Recommendation {
  solution: CatalogSolution;
  reason: string;
}

export interface SampleRecord {
  id: string;
  entity: "lead" | "submission" | "incident" | "task";
  values: Record<string, string>;
}

export interface PreviewSession {
  workflow: WorkflowId;
  spec: AppSpec;
  records: SampleRecord[];
  completed: string[];
  selectedId: string | null;
  filter: string;
  view: string;
  gate: "open" | "result" | "plans" | "readonly";
  error: string | null;
}

export type PreviewEvent =
  | { type: "filter"; value: string }
  | { type: "open" | "qualify" | "shortlist" | "start"; recordId: string }
  | { type: "assign"; recordId: string; team: string }
  | { type: "view"; view: string }
  | { type: "showPlans" | "returnToPreview" };
