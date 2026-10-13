import { describe, expect, it, vi } from "vitest";
import { PROBLEMS } from "../../src/click-preview/problems";
import { recommend } from "../../src/click-preview/recommendations";
import { CATALOG } from "../../src/click-preview/catalog";
import { restoreDiscovery, toLegacyDiscovery } from "../../src/click-preview/restore";
import { contextFor, EVENTS, legacyDiscovery, LEGACY_FIXTURES } from "./fixtures";

// Trusting incomplete or arbitrary JSON as a DiscoveryContext fails these recovery checks.
describe("safe discovery restoration", () => {
  it("starts with unselected chips and empty text when no saved discovery exists", () => {
    const result = restoreDiscovery(null);
    expect(result.context).toEqual({ problemId: null, goalId: null, scale: null, priority: null, note: "", uncoveredNeed: "", legacy: {
      industry: null, challenge: null, challengeCustom: false, stakeholders: [], outcomes: [],
    } });
    expect(result.needsProblemChoice).toBe(true);
    expect(result.message).toBeNull();
  });

  it.each(["{broken private-text", "null", "[]", "42", '"text"', "true"])("recovers from malformed or non-object JSON %s", (raw) => {
    const result = restoreDiscovery(raw);
    expect(result.context).toEqual(restoreDiscovery(null).context);
    expect(result.needsProblemChoice).toBe(true);
    expect(result.message).toMatch(/saved|restore|choose/i);
    expect(result.message).not.toContain("private-text");
  });

  it("sanitizes wrong field types without losing independent valid choices", () => {
    const result = restoreDiscovery(JSON.stringify({
      problemId: "registration", goalId: { id: "cut-check-in-lines" }, scale: "100-500", priority: true,
      note: ["not text"], uncoveredNeed: 123,
      legacy: { industry: EVENTS, challenge: 2, challengeCustom: "true", stakeholders: ["Event organizer", 4, "", "Event organizer"], outcomes: {} },
    }));
    expect(result.context).toMatchObject({ problemId: "registration", goalId: null, scale: "100-500", priority: null, note: "", uncoveredNeed: "" });
    expect(result.context.legacy).toEqual({ industry: EVENTS, challenge: null, challengeCustom: false, stakeholders: ["Event organizer"], outcomes: [] });
    expect(result.needsProblemChoice).toBe(false);
  });

  it("clears invalid dependent goal chips while preserving valid text and global context", () => {
    const context = contextFor("registration");
    const result = restoreDiscovery(JSON.stringify({ ...context, goalId: "capture-qualified-leads", note: "Keep this need", uncoveredNeed: "No suitable option" }));
    expect(result.context).toEqual({ ...context, goalId: null, note: "Keep this need", uncoveredNeed: "No suitable option" });
    expect(result.message).toMatch(/goal|choice|review/i);
  });

  it("rebuilds an industry-only legacy selection without inventing a problem", () => {
    const result = restoreDiscovery(JSON.stringify(legacyDiscovery()));
    expect(result.context.problemId).toBeNull();
    expect(result.context.goalId).toBeNull();
    expect(result.context.legacy.industry).toEqual(EVENTS);
    expect(result.needsProblemChoice).toBe(true);
    expect(result.message).toMatch(/choose|problem/i);
  });

  it.each(["healthcare", "unknown_industry"])("asks before entering Events from %s and preserves original context", (slug) => {
    const original = { ...legacyDiscovery("registration", ["Original goal"]), industry: { slug, label: "Original industry" } };
    const result = restoreDiscovery(JSON.stringify(original));
    expect(result.context.problemId).toBeNull();
    expect(result.context.goalId).toBeNull();
    expect(result.context.legacy).toEqual(original);
    expect(result.needsProblemChoice).toBe(true);
    expect(result.message).toMatch(/Original industry/);
    expect(result.message).toMatch(/Events|choose|confirm/i);
  });

  it("does not trust an Events label when the saved industry slug differs", () => {
    const result = restoreDiscovery(JSON.stringify({ ...contextFor("registration"), legacy: { ...legacyDiscovery("registration"), industry: { slug: "healthcare", label: EVENTS.label } } }));
    expect(result.context.problemId).toBeNull();
    expect(result.needsProblemChoice).toBe(true);
  });

  // Losing a valid industry slug because its label is corrupt must not admit conflicting Events chips.
  it.each([undefined, 42, null, "", "   "])("requires explicit choice for an unusable non-Events industry label %s", (label) => {
    for (const slug of ["healthcare", "unknown_industry"]) {
      const original = { ...legacyDiscovery("registration", ["Cut check-in lines"]), industry: { slug, label } };
      for (const modern of [true, false]) {
        const saved = modern ? { ...contextFor("registration"), note: "Preserve this context", legacy: original } : original;
        const result = restoreDiscovery(JSON.stringify(saved));
        expect(result.needsProblemChoice).toBe(true);
        expect(result.context.legacy.industry?.slug).toBe(slug);
        expect(result.context.legacy.industry?.label.trim()).toBeTruthy();
        expect(result.context.legacy.challenge).toBe("registration");
        expect(result.context.legacy.outcomes).toEqual(["Cut check-in lines"]);
        expect(result.context.problemId).toBeNull();
        expect(result.context.goalId).toBeNull();
        expect(result.needsProblemChoice).toBe(true);
        expect(result.message).toMatch(/Events.*choose|choose.*Events/i);
        if (modern) expect(result.context).toMatchObject({ note: "Preserve this context", scale: "100-500", priority: "visibility" });
      }
    }
  });

  it("rebuilds the canonical Events display label from an independently valid slug", () => {
    const original = { ...legacyDiscovery("registration", ["Cut check-in lines"]), industry: { slug: EVENTS.slug } };
    const result = restoreDiscovery(JSON.stringify(original));
    expect(result.context.legacy.industry).toEqual(EVENTS);
    expect(result.context.problemId).toBe("registration");
    expect(result.context.goalId).toBe("cut-check-in-lines");
    expect(result.needsProblemChoice).toBe(false);
  });

  it.each(LEGACY_FIXTURES)("restores legacy $id without silently narrowing the original problem", (fixture) => {
    const original = legacyDiscovery(fixture.challenge, [fixture.outcome]);
    const result = restoreDiscovery(JSON.stringify(original));
    expect(result.context.problemId).toBe(fixture.problem);
    expect(result.context.legacy).toEqual(original);
    expect(result.needsProblemChoice).toBe(fixture.problem === null);
    if (fixture.problem) {
      const selected = PROBLEMS.find((item) => item.id === fixture.problem)!;
      expect(selected.goals.find((item) => item.id === result.context.goalId)?.label).toBe(fixture.outcome);
    } else {
      expect(result.context.goalId).toBeNull();
      expect(result.message).toMatch(fixture.id === "matchmaking" ? /Networking.*Sponsor|Sponsor.*Networking/ : /operations.*agendas.*budgets/i);
    }
  });

  it.each(LEGACY_FIXTURES)("accepts the legacy $id identifier as well as its label", (fixture) => {
    expect(restoreDiscovery(JSON.stringify(legacyDiscovery(fixture.id))).context.problemId).toBe(fixture.problem);
  });

  it("preserves multiple legacy outcomes without silently choosing a single goal", () => {
    const original = legacyDiscovery(LEGACY_FIXTURES[0].challenge, ["Cut check-in lines", "Auto-issue badges & QR passes"]);
    const result = restoreDiscovery(JSON.stringify(original));
    expect(result.context.problemId).toBe("registration");
    expect(result.context.goalId).toBeNull();
    expect(result.context.legacy).toEqual(original);
    expect(result.message).toMatch(/goal|choose/i);
  });

  // Selecting one recognized outcome while ignoring unresolved saved intent fails these regressions.
  it.each(["Keep an original custom goal", "Nurture leads after the event", "another-goal"])("requires goal clarification when a recognized goal accompanies unresolved outcome %s", (unresolved) => {
    const original = legacyDiscovery(LEGACY_FIXTURES[0].challenge, ["Cut check-in lines", unresolved]);
    const result = restoreDiscovery(JSON.stringify(original));
    expect(result.context.problemId).toBe("registration");
    expect(result.context.goalId).toBeNull();
    expect(result.context.legacy).toEqual(original);
    expect(result.needsProblemChoice).toBe(false);
    expect(result.message).toMatch(/goal|choose|review/i);
  });

  it("resolves a legacy label and id only when both identify the same semantic goal", () => {
    const original = legacyDiscovery(LEGACY_FIXTURES[0].challenge, ["Cut check-in lines", "cut-check-in-lines"]);
    const result = restoreDiscovery(JSON.stringify(original));
    expect(result.context.goalId).toBe("cut-check-in-lines");
    expect(result.context.legacy).toEqual(original);
    expect(result.message).toBeNull();
  });

  it("retains unknown and custom challenges as inert optional context until the user chooses", () => {
    for (const challenge of ["An unlisted need", "<img onerror=alert(1)>"]) {
      const original = { ...legacyDiscovery(challenge), challengeCustom: true };
      const result = restoreDiscovery(JSON.stringify(original));
      expect(result.context.problemId).toBeNull();
      expect(result.context.note).toBe(challenge);
      expect(result.context.legacy.challenge).toBe(challenge);
      expect(result.needsProblemChoice).toBe(true);
      expect(result.message).not.toContain(challenge);
    }
    expect(restoreDiscovery(JSON.stringify({ ...legacyDiscovery(LEGACY_FIXTURES[0].challenge), challengeCustom: true })).context.problemId).toBeNull();
  });

  it("clips optional text to 500 without interpreting markup or changing ranking", () => {
    const context = contextFor("registration");
    const note = `<img onerror=alert(1)>${"x".repeat(600)}`;
    const result = restoreDiscovery(JSON.stringify({ ...context, note, uncoveredNeed: "y".repeat(501) }));
    expect(result.context.note).toBe(note.slice(0, 500));
    expect(result.context.uncoveredNeed).toBe("y".repeat(500));
    expect(recommend(result.context, CATALOG)).toEqual(recommend(context, CATALOG));
  });

  it("round trips valid choices for all nine problems, including Another goal", () => {
    for (const problem of PROBLEMS) {
      for (const goal of problem.goals) {
        const context = { ...contextFor(problem.id), goalId: goal.id, note: "Optional need", uncoveredNeed: "Keep unmet need" };
        const restored = restoreDiscovery(JSON.stringify(context));
        expect(restored.context).toEqual(context);
        expect(restored.needsProblemChoice).toBe(false);
        expect(restored.message).toBeNull();
      }
    }
  });

  it("drops goals for unknown problems and invalid scale/priority values", () => {
    const result = restoreDiscovery(JSON.stringify({ ...contextFor("registration"), problemId: "unknown", scale: "large", priority: "AI" }));
    expect(result.context).toMatchObject({ problemId: null, goalId: null, scale: null, priority: null });
    expect(result.needsProblemChoice).toBe(true);
  });

  it("sanitizes blueprint shape while preserving valid legacy blueprint data", () => {
    const valid = { understood: "Saved context", solutionName: "Saved concept", users: ["Event organizer"], workflow: ["Review"], aiOpportunities: ["Possible use"], foundation: "Saved foundation" };
    expect(restoreDiscovery(JSON.stringify({ ...legacyDiscovery(), blueprint: valid })).context.legacy.blueprint).toEqual(valid);
    expect(restoreDiscovery(JSON.stringify({ ...legacyDiscovery(), blueprint: { ...valid, workflow: 12 } })).context.legacy).not.toHaveProperty("blueprint");
  });

  it("has no storage reads, writes, removals or network calls", () => {
    const get = vi.spyOn(Storage.prototype, "getItem");
    const set = vi.spyOn(Storage.prototype, "setItem");
    const remove = vi.spyOn(Storage.prototype, "removeItem");
    const fetch = vi.spyOn(globalThis, "fetch");
    restoreDiscovery(JSON.stringify(contextFor("registration")));
    toLegacyDiscovery(contextFor("registration"));
    expect(get).not.toHaveBeenCalled(); expect(set).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
});

// Discarding original ambiguous context before choice, leaking notes into legacy prompts, or mapping labels incompatibly fails these adapter checks.
describe("legacy discovery adapter", () => {
  it("preserves the original context until a problem has actually been selected", () => {
    const original = legacyDiscovery(LEGACY_FIXTURES[2].challenge, [LEGACY_FIXTURES[2].outcome]);
    const context = restoreDiscovery(JSON.stringify(original)).context;
    expect(toLegacyDiscovery(context)).toEqual(original);
  });

  it.each([LEGACY_FIXTURES[0], LEGACY_FIXTURES[1], LEGACY_FIXTURES[3], LEGACY_FIXTURES[4]])("keeps the compatible original $id challenge label", (fixture) => {
    const context = contextFor(fixture.problem);
    const result = toLegacyDiscovery(context);
    expect(result.industry).toEqual(EVENTS);
    expect(result.challenge).toBe(fixture.challenge);
    expect(result.challengeCustom).toBe(false);
    expect(result.outcomes).toEqual([PROBLEMS.find((item) => item.id === context.problemId)!.goals[0]!.label]);
  });

  it("converts explicit new selections without letting optional text override them", () => {
    for (const problem of PROBLEMS) {
      const context = { ...contextFor(problem.id), note: "<img onerror=alert(1)>", uncoveredNeed: "private need" };
      const result = toLegacyDiscovery(context);
      expect(result.industry).toEqual(EVENTS);
      expect(result.challenge).toBeTruthy();
      expect(result.challenge).not.toContain("img");
      expect(result.outcomes).not.toContain("private need");
      expect(result).not.toHaveProperty("note");
      expect(result).not.toHaveProperty("uncoveredNeed");
    }
  });

  it("does not carry stale blueprint or outcomes into a changed problem", () => {
    const context = contextFor("speaker-submissions");
    context.legacy = { ...legacyDiscovery(LEGACY_FIXTURES[0].challenge, ["Cut check-in lines"]), blueprint: { understood: "Old", solutionName: "Old", users: [], workflow: [], aiOpportunities: [] } };
    const result = toLegacyDiscovery(context);
    expect(result).not.toHaveProperty("blueprint");
    expect(result.outcomes).toEqual([PROBLEMS.find((item) => item.id === "speaker-submissions")!.goals[0]!.label]);
    expect(context.legacy.blueprint?.solutionName).toBe("Old");
  });

  it("keeps Another goal unmet without fabricating legacy outcomes", () => {
    const context = { ...contextFor("registration"), goalId: "another-goal" };
    expect(toLegacyDiscovery(context).outcomes).toEqual([]);
  });
});
