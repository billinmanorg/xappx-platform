import { CATALOG } from "./catalog";
import { ANOTHER_GOAL, PRIORITIES, PROBLEMS, SCALES } from "./problems";
import type { CatalogSolution, DiscoveryContext, Recommendation } from "./types";

const nonemptyText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const uniqueList = (value: unknown, valid: (item: unknown) => boolean): value is string[] =>
  Array.isArray(value) && value.every(valid) && new Set(value).size === value.length;

/** Runtime defense for supplied catalog data; never promote an unknown concept to a working app. */
function isCatalogSolution(value: unknown): value is CatalogSolution {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id)) return false;
  if (![item.title, item.benefit, item.concept].every(nonemptyText)) return false;
  if (!uniqueList(item.problemIds, (id) => PROBLEMS.some((problem) => problem.id === id)) || item.problemIds.length === 0) return false;
  const problemIds = item.problemIds;
  const goals = PROBLEMS.filter((problem) => problemIds.includes(problem.id))
    .flatMap((problem) => problem.goals).filter((goal) => goal.id !== ANOTHER_GOAL);
  if (!uniqueList(item.goalIds, (id) => goals.some((goal) => goal.id === id))) return false;
  if (!uniqueList(item.priorities, (id) => PRIORITIES.some((choice) => choice.id === id))) return false;
  if (!uniqueList(item.scales, (id) => SCALES.some((choice) => choice.id === id))) return false;
  if (!uniqueList(item.functions, nonemptyText) || item.functions.length === 0) return false;
  if (item.buildStatus === "recommended-solution") return !("workflowId" in item)
    && !CATALOG.some((approved) => approved.id === item.id && approved.buildStatus === "working-preview");
  if (item.buildStatus !== "working-preview") return false;
  return CATALOG.some((approved) => approved.buildStatus === "working-preview"
    && approved.id === item.id && approved.title === item.title && approved.workflowId === item.workflowId
    && approved.problemIds.length === problemIds.length
    && approved.problemIds.every((id) => problemIds.includes(id)));
}

function distinctSolutions(catalog: readonly CatalogSolution[]): CatalogSolution[] {
  const seen = new Set<string>();
  return catalog.filter((solution) => {
    if (!isCatalogSolution(solution) || seen.has(solution.id)) return false;
    seen.add(solution.id);
    return true;
  });
}

export function recommend(context: DiscoveryContext, catalog: readonly CatalogSolution[]): Recommendation[] {
  const problem = PROBLEMS.find((item) => item.id === context.problemId);
  if (!problem || !Array.isArray(catalog)) return [];
  const goal = problem.goals.find((item) => item.id === context.goalId);
  if (context.goalId !== null && (!goal || goal.id === ANOTHER_GOAL)) return [];
  const priority = PRIORITIES.find((item) => item.id === context.priority);
  const scale = SCALES.find((item) => item.id === context.scale);
  const scored = distinctSolutions(catalog).filter((solution) => solution.problemIds.includes(problem.id)).map((solution) => {
    const goalMatch = !!goal && solution.goalIds.includes(goal.id);
    const priorityMatch = !!priority && solution.priorities.includes(priority.id);
    const scaleMatch = !!scale && solution.scales.includes(scale.id);
    const parts = [`An option for ${problem.label}.`];
    if (goalMatch) parts.push(`Supports your selected goal: ${goal.label}.`);
    else if (goal) parts.push(`A broader option to consider alongside your goal: ${goal.label}.`);
    if (priorityMatch) parts.push(`Fits your ${priority.label} priority.`);
    if (scaleMatch) parts.push(`Relevant to ${scale.label}.`);
    return { solution, reason: parts.join(" "), score: (goalMatch ? 4 : 0) + (priorityMatch ? 2 : 0) + (scaleMatch ? 1 : 0) };
  });
  scored.sort((a, b) => b.score - a.score || (a.solution.id < b.solution.id ? -1 : a.solution.id > b.solution.id ? 1 : 0));
  return scored.map(({ solution, reason }) => ({ solution, reason }));
}

export function visibleRecommendations(items: readonly Recommendation[], batch: number): readonly Recommendation[] {
  const count = Number.isSafeInteger(batch) && batch >= 1 ? batch : 1;
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item || !isCatalogSolution(item.solution) || !nonemptyText(item.reason) || seen.has(item.solution.id)) return false;
    seen.add(item.solution.id);
    return true;
  }).slice(0, count * 3);
}
