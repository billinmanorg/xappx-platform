import { describe, expect, it } from "vitest";
import { CATALOG } from "../../src/click-preview/catalog";
import { PROBLEMS, PRIORITIES, SCALES } from "../../src/click-preview/problems";
import { recommend, visibleRecommendations } from "../../src/click-preview/recommendations";
import type { CatalogSolution, Recommendation } from "../../src/click-preview/types";
import { contextFor } from "./fixtures";

const EXPECTED_COVERAGE = [
  ["registration", "Registration and check-in", ["Check-in Queue Planner", "Badge & QR Pass Concept", "Registration Exception Review", "Attendance Overview"]],
  ["engagement", "Attendee engagement", ["Session Polling", "Event Q&A", "Feedback Pulse", "Participation Overview"]],
  ["networking", "Networking and matchmaking", ["Matchmaking Board", "Meeting Scheduler", "Introduction Requests", "Networking Follow-up"]],
  ["sponsor-leads", "Sponsor leads", ["Sponsor Lead Desk", "Sponsor Matchmaking", "Sponsor ROI Overview", "Booth Follow-up"]],
  ["speaker-submissions", "Speaker submissions", ["Speaker Submission Review", "Reviewer Assignment", "Topic Coverage", "Speaker Scheduling"]],
  ["agendas", "Agendas and scheduling", ["Agenda Planner", "Room Capacity", "Conflict Review", "Schedule Changes"]],
  ["budgets-vendors", "Budgets and vendors", ["Vendor Register", "Budget Tracker", "Quote Comparison", "Vendor Tasks"]],
  ["event-operations", "Event operations", ["Event Operations Board", "Staff Changeboard", "Room Readiness", "Vendor Tasks"]],
  ["follow-up", "Post-event follow-up", ["Recap Planner", "Lead Follow-up", "Recording Delivery", "ROI Summary"]],
] as const;

// Removing a category, changing its approved label or hiding one of its options fails these checks.
describe("vetted event catalog", () => {
  it("has the nine exact problem labels and ids in the approved order", () => {
    expect(PROBLEMS.map(({ id, label }) => [id, label])).toEqual(EXPECTED_COVERAGE.map(([id, label]) => [id, label]));
  });

  it.each(EXPECTED_COVERAGE)("covers %s with all four approved options", (id, _label, titles) => {
    const entries = CATALOG.filter((item) => item.problemIds.includes(id));
    expect(entries.map((item) => item.title).sort()).toEqual([...titles].sort());
    expect(recommend(contextFor(id), CATALOG)).toHaveLength(4);
  });

  it("has exactly 35 unique entries and one shared Vendor Tasks id", () => {
    expect(CATALOG).toHaveLength(35);
    expect(new Set(CATALOG.map((item) => item.id)).size).toBe(35);
    const vendorTasks = CATALOG.filter((item) => item.title === "Vendor Tasks");
    expect(vendorTasks).toHaveLength(1);
    expect(vendorTasks[0]!.problemIds).toEqual(["budgets-vendors", "event-operations"]);
  });

  it("labels exactly the three implemented workflows as working", () => {
    expect(CATALOG.filter((item) => item.buildStatus === "working-preview").map((item) => [item.title, item.workflowId])).toEqual([
      ["Sponsor Lead Desk", "sponsor"], ["Speaker Submission Review", "speaker"], ["Event Operations Board", "operations"],
    ]);
    for (const item of CATALOG.filter((entry) => entry.buildStatus === "recommended-solution")) {
      expect(item).not.toHaveProperty("workflowId");
      expect(item.benefit).toMatch(/^Could /);
      expect(item.functions.every((value) => value.startsWith("Could "))).toBe(true);
      expect(item.concept).toMatch(/concept|possible/i);
    }
  });

  it("offers valid global chips and another goal for every problem", () => {
    expect(SCALES.map((item) => item.id)).toEqual(["under-100", "100-500", "501-2000", "over-2000", "unsure"]);
    expect(PRIORITIES.map((item) => item.id)).toEqual(["speed", "visibility", "accuracy", "coordination"]);
    for (const problem of PROBLEMS) {
      expect(new Set(problem.goals.map((goal) => goal.id)).size).toBe(problem.goals.length);
      expect(problem.goals.at(-1)).toEqual({ id: "another-goal", label: "Another goal" });
      expect(problem.goals.length).toBeGreaterThanOrEqual(5);
      expect(problem.goals.slice(0, -1).every((goal) => CATALOG.some((solution) => solution.problemIds.includes(problem.id) && solution.goalIds.includes(goal.id)))).toBe(true);
    }
  });
});

function option(id: string, extra: Partial<CatalogSolution> = {}): CatalogSolution {
  return {
    id, title: id, problemIds: ["registration"], goalIds: [], priorities: [], scales: [],
    benefit: "Could help plan check-in.", functions: ["Could organize sample queues."], concept: "Possible concept.",
    buildStatus: "recommended-solution", ...extra,
  } as CatalogSolution;
}

// Changing any of the 4/2/1 weights, including text in the score, or dropping the id tiebreaker fails these checks.
describe("deterministic contextual recommendations", () => {
  it("weights goal 4, priority 2, scale 1, then sorts tied ids", () => {
    const context = contextFor("registration");
    const entries = [
      option("scale", { scales: ["100-500"] }),
      option("priority-scale", { priorities: ["visibility"], scales: ["100-500"] }),
      option("goal", { goalIds: [context.goalId!] }),
      option("priority", { priorities: ["visibility"] }),
      option("all", { goalIds: [context.goalId!], priorities: ["visibility"], scales: ["100-500"] }),
      option("base-z"), option("base-a"),
    ];
    expect(recommend(context, entries).map((item) => item.solution.id)).toEqual(["all", "goal", "priority-scale", "priority", "scale", "base-a", "base-z"]);
    expect(recommend(context, entries.reverse()).map((item) => item.solution.id)).toEqual(["all", "goal", "priority-scale", "priority", "scale", "base-a", "base-z"]);
  });

  it("explains the chosen problem, goal and matching context without calling options proven top answers", () => {
    const context = contextFor("registration");
    const goal = PROBLEMS[0]!.goals[0]!;
    const result = recommend(context, [option("fit", { goalIds: [goal.id], priorities: ["visibility"], scales: ["100-500"] })])[0]!;
    expect(result.reason).toContain("Registration and check-in");
    expect(result.reason).toContain(goal.label);
    expect(result.reason).toContain(PRIORITIES.find((item) => item.id === context.priority)!.label);
    expect(result.reason).toContain(SCALES.find((item) => item.id === context.scale)!.label);
    expect(result.reason).not.toMatch(/best|proven|top|AI/i);
  });

  it("does not let notes or uncovered needs change ranking", () => {
    const context = contextFor("registration");
    expect(recommend({ ...context, note: "<img onerror=alert(1)> sponsor leads", uncoveredNeed: "speaker" }, CATALOG))
      .toEqual(recommend(context, CATALOG));
  });

  it("keeps unmet or invalid dependent goals empty until the user refines or browses broadly", () => {
    const context = contextFor("registration");
    expect(recommend({ ...context, goalId: "another-goal", uncoveredNeed: "A new need" }, CATALOG)).toEqual([]);
    expect(recommend({ ...context, goalId: "capture-qualified-leads" }, CATALOG)).toEqual([]);
    expect(recommend({ ...context, problemId: null }, CATALOG)).toEqual([]);
    expect(recommend({ ...context, goalId: null }, CATALOG)).toHaveLength(4);
    expect(recommend(context, [])).toEqual([]);
  });

  it("rejects demoted canonical working IDs before they can shadow the approved entry", () => {
    for (const working of CATALOG.filter((item) => item.buildStatus === "working-preview")) {
      const { workflowId: _workflowId, ...data } = working;
      const demoted = { ...data, buildStatus: "recommended-solution" as const };
      const context = contextFor(working.problemIds[0]!);
      expect(recommend(context, [demoted])).toEqual([]);
      expect(recommend(context, [demoted, working]).map((item) => item.solution)).toEqual([working]);
      expect(visibleRecommendations([{ solution: demoted, reason: "A supplied option." }], 1)).toEqual([]);
    }
  });

  it("filters unrelated, malformed, duplicate and falsely promoted entries", () => {
    const first = option("valid");
    const invalid = [null, {}, option(""), option("bad id"), option("missing-benefit", { benefit: "" }),
      option("wrong-goal", { goalIds: ["unknown-goal"] }), option("wrong-problem", { problemIds: ["unknown"] as never }),
      option("wrong-priority", { priorities: ["unknown"] as never }), option("wrong-scale", { scales: ["unknown"] as never }),
      option("wrong-status", { buildStatus: "live" as never }), option("bad-functions", { functions: [] }),
      option("false-working", { buildStatus: "working-preview", workflowId: "sponsor" }),
      option("concept-workflow", { workflowId: "operations" } as never)];
    const input = [first, { ...first, title: "Duplicate" }, ...invalid, option("unrelated", { problemIds: ["engagement"] })];
    expect(recommend(contextFor("registration"), input as CatalogSolution[]).map((item) => item.solution.title)).toEqual(["valid"]);
  });
});

// Replacing cumulative slicing with rotating pages, or counting duplicates as new options, fails these checks.
describe("cumulative distinct recommendation batches", () => {
  const items: Recommendation[] = Array.from({ length: 7 }, (_, i) => ({ solution: option(`item-${i}`), reason: "Possible option." }));

  it("retains three, then six, then seven distinct cards until exhaustion", () => {
    expect(visibleRecommendations(items, 1)).toEqual(items.slice(0, 3));
    expect(visibleRecommendations(items, 2)).toEqual(items.slice(0, 6));
    expect(visibleRecommendations(items, 3)).toEqual(items);
    expect(visibleRecommendations(items, 4)).toEqual(items);
  });

  it("skips invalid or duplicate cards before calculating the visible count", () => {
    const input = [items[0]!, items[0]!, { solution: null, reason: "invalid" }, { solution: option("no-reason"), reason: "" }, ...items.slice(1)];
    expect(visibleRecommendations(input as Recommendation[], 1)).toEqual(items.slice(0, 3));
    expect(visibleRecommendations(input as Recommendation[], 3)).toEqual(items);
    expect(visibleRecommendations([], 1)).toEqual([]);
    expect(items).toHaveLength(7);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5])("normalizes invalid batch %s to a safe first batch", (batch) => {
    expect(visibleRecommendations(items, batch)).toEqual(items.slice(0, 3));
  });
});
