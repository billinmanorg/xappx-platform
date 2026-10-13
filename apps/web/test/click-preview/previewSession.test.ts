import { describe, expect, it, vi } from "vitest";
import { createPreviewSession, deriveSummary, previewReducer } from "../../src/click-preview/previewSession";
import type { PreviewEvent, PreviewSession, WorkflowId } from "../../src/click-preview/types";
import { legacyDiscovery } from "./fixtures";

const cases: { workflow: WorkflowId; target: string; other: string; filter: string; view: string; steps: PreviewEvent[]; ids: string[]; final: Record<string, string> }[] = [
  { workflow: "sponsor", target: "LE-1040", other: "LE-1042", filter: "High", view: "leads", steps: [{ type: "filter", value: "High" }, { type: "open", recordId: "LE-1040" }, { type: "qualify", recordId: "LE-1040" }], ids: ["sponsor.filter", "sponsor.open", "sponsor.qualify"], final: { stage: "Qualified" } },
  { workflow: "speaker", target: "SU-1040", other: "SU-1042", filter: "Experience", view: "submissions", steps: [{ type: "filter", value: "Experience" }, { type: "open", recordId: "SU-1040" }, { type: "shortlist", recordId: "SU-1040" }], ids: ["speaker.filter", "speaker.open", "speaker.shortlist"], final: { status: "Shortlisted" } },
  { workflow: "operations", target: "IN-1040", other: "IN-1041", filter: "", view: "incidents", steps: [{ type: "open", recordId: "IN-1040" }, { type: "assign", recordId: "IN-1040", team: "Sample AV team" }, { type: "start", recordId: "IN-1040" }], ids: ["operations.open", "operations.assign", "operations.start"], final: { status: "In progress", team: "Sample AV team" } },
];

function run(state: PreviewSession, events: readonly PreviewEvent[]): PreviewSession {
  return events.reduce(previewReducer, state);
}

function freeze(value: unknown): void {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
}

// Counting arbitrary navigation, accepting out-of-order writes or double counting a dispatch fails these checks.
describe.each(cases)("$workflow guided session", ({ workflow, target, other, filter, view, steps, ids, final }) => {
  it("starts fresh with independent records, empty progress and an open gate", () => {
    const first = createPreviewSession(workflow, legacyDiscovery());
    const second = createPreviewSession(workflow, legacyDiscovery());
    expect(first).toMatchObject({ workflow, completed: [], selectedId: null, filter: "", view, gate: "open", error: null });
    expect(first.records).toHaveLength(workflow === "operations" ? 12 : 6);
    expect(first).toEqual(second);
    first.records[0]!.values.local = "not persisted";
    expect(second.records[0]!.values).not.toHaveProperty("local");
    expect(createPreviewSession(workflow, legacyDiscovery())).toEqual(second);
  });

  it("counts ordered successful actions 1/2/3 and presents the changed third result before plans", () => {
    let state = createPreviewSession(workflow, legacyDiscovery());
    steps.forEach((event, index) => {
      state = previewReducer(state, event);
      expect(state.completed).toEqual(ids.slice(0, index + 1));
      expect(state.gate).toBe(index === 2 ? "result" : "open");
      expect(state.error).toBeNull();
    });
    expect(state.selectedId).toBe(target);
    expect(state.records.find((record) => record.id === target)!.values).toMatchObject(final);
    expect(state.records.find((record) => record.id === other)).toEqual(createPreviewSession(workflow, legacyDiscovery()).records.find((record) => record.id === other));
  });

  it("counts rapid duplicate dispatches exactly once at each step", () => {
    let state = createPreviewSession(workflow, legacyDiscovery());
    steps.forEach((event, index) => {
      state = previewReducer(state, event);
      const records = structuredClone(state.records);
      state = run(state, [event, event, event]);
      expect(state.completed).toEqual(ids.slice(0, index + 1));
      expect(state.records).toEqual(records);
    });
    expect(state.gate).toBe("result");
  });

  it("never advances or mutates on out-of-order actions", () => {
    const initial = createPreviewSession(workflow, legacyDiscovery());
    for (const event of steps.slice(1)) {
      const state = previewReducer(initial, event);
      expect(state.completed).toEqual([]);
      expect(state.records).toEqual(initial.records);
    }
    const afterFirst = previewReducer(initial, steps[0]!);
    const state = previewReducer(afterFirst, steps[2]!);
    expect(state.completed).toEqual([ids[0]]);
    expect(state.records).toEqual(initial.records);
  });

  it("rejects wrong-target mutation after successful prerequisites", () => {
    const state = run(createPreviewSession(workflow, legacyDiscovery()), steps.slice(0, 2));
    const event = { ...steps[2]!, recordId: other } as PreviewEvent;
    const next = previewReducer(state, event);
    expect(next.records).toEqual(state.records);
    expect(next.completed).toEqual(ids.slice(0, 2));
    expect(next.error).toMatch(/prompted|guided|record/i);
  });

  it("requires the prompted record to remain selected for a write", () => {
    let state = run(createPreviewSession(workflow, legacyDiscovery()), steps.slice(0, 2));
    state = previewReducer(state, { type: "open", recordId: other });
    expect(state.selectedId).toBe(other);
    const next = previewReducer(state, steps[2]!);
    expect(next.records).toEqual(state.records);
    expect(next.completed).toEqual(ids.slice(0, 2));
    expect(next.error).not.toBeNull();
  });

  it("allows non-guided inspection and navigation without spending actions", () => {
    let state = createPreviewSession(workflow, legacyDiscovery());
    state = run(state, [{ type: "view", view: "dashboard" }, { type: "filter", value: "No matching sample" }, { type: "open", recordId: other }]);
    expect(state).toMatchObject({ completed: [], view: "dashboard", filter: "No matching sample", selectedId: other, gate: "open" });
    expect(state.records).toEqual(createPreviewSession(workflow, legacyDiscovery()).records);
    if (workflow !== "operations") {
      state = previewReducer(state, { type: "filter", value: filter.toLowerCase() });
      expect(state.completed).toEqual([]);
      state = previewReducer(state, { type: "filter", value: filter });
      state = previewReducer(state, { type: "open", recordId: other });
      expect(state.completed).toEqual([ids[0]]);
    }
  });

  it("keeps inspection/filter/view usable after the third result and through plans/readonly", () => {
    const complete = run(createPreviewSession(workflow, legacyDiscovery()), steps);
    let state = run(complete, [{ type: "open", recordId: other }, { type: "filter", value: "Any" }]);
    expect(state.selectedId).toBeNull();
    state = run(state, [{ type: "open", recordId: other }, { type: "view", view: "dashboard" }]);
    expect(state).toMatchObject({ selectedId: other, filter: "Any", view: "dashboard", gate: "result", completed: ids });
    expect(state.records).toEqual(complete.records);
    state = previewReducer(state, { type: "showPlans" });
    expect(state.gate).toBe("plans");
    state = previewReducer(state, { type: "returnToPreview" });
    expect(state.gate).toBe("readonly");
    state = previewReducer(state, { type: "open", recordId: target });
    expect(state.selectedId).toBe(target);
    expect(state.records).toEqual(complete.records);
    expect(previewReducer(state, { type: "showPlans" }).gate).toBe("plans");
  });

  it.each(["result", "plans", "readonly"] as const)("blocks every fourth mutation in gate %s", (gate) => {
    const state = { ...run(createPreviewSession(workflow, legacyDiscovery()), steps), gate };
    const attempts: PreviewEvent[] = [
      { type: "qualify", recordId: target }, { type: "shortlist", recordId: target },
      { type: "assign", recordId: target, team: "Sample AV team" }, { type: "start", recordId: target },
      { type: "qualify", recordId: other }, { type: "shortlist", recordId: other },
      { type: "assign", recordId: other, team: "Another team" }, { type: "start", recordId: other },
    ];
    for (const event of attempts) {
      const next = previewReducer(state, event);
      expect(next.records).toEqual(state.records);
      expect(next.completed).toEqual(ids);
      expect(next.gate).toBe(gate);
    }
  });

  it("cannot open plans early or skip the third-result gate with returnToPreview", () => {
    for (let count = 0; count < 3; count++) {
      const state = run(createPreviewSession(workflow, legacyDiscovery()), steps.slice(0, count));
      expect(previewReducer(state, { type: "showPlans" }).gate).toBe("open");
      expect(previewReducer(state, { type: "returnToPreview" }).gate).toBe("open");
    }
    const complete = run(createPreviewSession(workflow, legacyDiscovery()), steps);
    expect(previewReducer(complete, { type: "returnToPreview" }).gate).toBe("result");
  });

  it("reports missing/stale ids without erasing the selected record or progress", () => {
    const state = run(createPreviewSession(workflow, legacyDiscovery()), steps.slice(0, 2));
    for (const recordId of ["missing", "", `${target}-stale`]) {
      for (const event of [{ type: "open", recordId }, { ...steps[2]!, recordId }] as PreviewEvent[]) {
        const next = previewReducer(state, event);
        expect(next.records).toEqual(state.records);
        expect(next.completed).toEqual(state.completed);
        expect(next.selectedId).toBe(state.selectedId);
        expect(next.error).toMatch(/record|sample/i);
        expect(next.error).toMatch(/back|reset/i);
      }
    }
    expect(previewReducer({ ...state, error: "Previous error" }, { type: "open", recordId: target }).error).toBeNull();
  });

  it.each(["missing target", "wrong entity", "duplicate target", "missing field", "stale status", "reused id"])("rejects corrupt session records: %s", (kind) => {
    const state = run(createPreviewSession(workflow, legacyDiscovery()), steps.slice(0, 2));
    const record = state.records.find((item) => item.id === target)!;
    if (kind === "missing target") state.records = state.records.filter((item) => item.id !== target);
    if (kind === "wrong entity") record.entity = workflow === "operations" ? "lead" : "task";
    if (kind === "duplicate target") state.records.push(structuredClone(record));
    if (kind === "missing field") delete record.values[workflow === "sponsor" ? "stage" : "status"];
    if (kind === "stale status") record.values[workflow === "sponsor" ? "stage" : "status"] = "Completed elsewhere";
    if (kind === "reused id") record.values[workflow === "sponsor" ? "company" : workflow === "speaker" ? "title" : "incident"] = "Different sample record reusing the prompted id";
    const before = structuredClone(state);
    const next = previewReducer(state, steps[2]!);
    expect(next.records).toEqual(before.records);
    expect(next.completed).toEqual(before.completed);
    expect(next.error).toMatch(/sample|record/i);
    expect(next.error).toMatch(/back|reset/i);
  });

  it("rejects forged or non-prefix progress rather than unlocking mutations/plans", () => {
    const state = createPreviewSession(workflow, legacyDiscovery());
    for (const completed of [[ids[1]!], [ids[0]!, ids[0]!], ["fake", "progress", "ids"]]) {
      const corrupt = { ...state, completed, selectedId: target };
      const next = previewReducer(corrupt, steps[2]!);
      expect(next.records).toEqual(state.records);
      expect(next.completed).toEqual(completed);
      expect(previewReducer(corrupt, { type: "showPlans" }).gate).toBe("open");
    }
  });

  it("is pure for frozen state/events including nested record values and specifications", () => {
    let state = createPreviewSession(workflow, legacyDiscovery());
    for (const event of [...steps, { type: "showPlans" }, { type: "returnToPreview" }] as PreviewEvent[]) {
      const before = structuredClone(state);
      freeze(state); freeze(event);
      const next = previewReducer(state, event);
      expect(state).toEqual(before);
      expect(next.spec).toBe(state.spec);
      state = next;
    }
  });

  it("derives summaries from current records, with no fixed production metrics", () => {
    const initial = createPreviewSession(workflow, legacyDiscovery());
    const state = run(initial, steps);
    const summary = deriveSummary(state);
    expect(summary.length).toBeGreaterThanOrEqual(3);
    expect(summary.every((item) => typeof item.label === "string" && Number.isInteger(item.value))).toBe(true);
    const label = workflow === "sponsor" ? "Qualified leads" : workflow === "speaker" ? "Shortlisted submissions" : "In-progress incidents";
    const entity = workflow === "sponsor" ? "lead" : workflow === "speaker" ? "submission" : "incident";
    const field = workflow === "sponsor" ? "stage" : "status";
    const status = workflow === "sponsor" ? "Qualified" : workflow === "speaker" ? "Shortlisted" : "In progress";
    const count = (session: PreviewSession) => session.records.filter((record) => record.entity === entity && record.values[field] === status).length;
    expect(summary.find((item) => item.label === label)?.value).toBe(count(state));
    expect(count(state)).toBe(count(initial) + 1);
    expect(deriveSummary({ ...state, records: [] }).every((item) => item.value === 0)).toBe(true);
    const edited = { ...state, records: state.records.filter((record) => record.id !== target) };
    expect(deriveSummary(edited).find((item) => item.label === label)?.value).toBe(count(state) - 1);
    expect(state).not.toHaveProperty("stats");
  });
});

describe("bounded workflow validation", () => {
  it.each(["sponsor", "speaker"] as const)("clears early %s inspection on its guided filter so reopening genuinely advances", (workflow) => {
    const definition = cases.find((item) => item.workflow === workflow)!;
    let state = previewReducer(createPreviewSession(workflow, legacyDiscovery()), definition.steps[1]!);
    expect(state.selectedId).toBe(definition.target);
    expect(state.completed).toEqual([]);
    const records = structuredClone(state.records);
    state = previewReducer(state, definition.steps[0]!);
    expect(state.selectedId).toBeNull();
    expect(state.completed).toEqual([definition.ids[0]]);
    expect(state.error).toBeNull();
    state = previewReducer(state, definition.steps[1]!);
    expect(state.selectedId).toBe(definition.target);
    expect(state.completed).toEqual(definition.ids.slice(0, 2));
    expect(state.records).toEqual(records);
    state = previewReducer(state, definition.steps[2]!);
    expect(state.completed).toEqual(definition.ids);
    expect(state.gate).toBe("result");
    expect(state.records.find((record) => record.id === definition.target)!.values).toMatchObject(definition.final);
  });

  it.each(cases)("clears selection only when a filter genuinely changes in $workflow", ({ workflow, other }) => {
    let state = previewReducer(createPreviewSession(workflow, legacyDiscovery()), { type: "open", recordId: other });
    expect(state.selectedId).toBe(other);
    const completed = [...state.completed];
    const records = structuredClone(state.records);
    state = previewReducer(state, { type: "filter", value: "" });
    expect(state.selectedId).toBe(other);
    state = previewReducer(state, { type: "filter", value: "No matching samples" });
    expect(state.selectedId).toBeNull();
    expect(state.completed).toEqual(completed);
    expect(state.records).toEqual(records);
    state = previewReducer(state, { type: "open", recordId: other });
    state = previewReducer(state, { type: "filter", value: "No matching samples" });
    expect(state.selectedId).toBe(other);
    expect(state.completed).toEqual(completed);
  });

  it.each(["sponsor", "speaker"] as const)("does not charge a first-count no-op open in %s and can recover by genuinely reopening", (workflow) => {
    const definition = cases.find((item) => item.workflow === workflow)!;
    let state = createPreviewSession(workflow, legacyDiscovery());
    state = previewReducer(state, definition.steps[1]!);
    expect(state.selectedId).toBe(definition.target);
    expect(state.completed).toEqual([]);
    expect(state.error).not.toBeNull();
    state = previewReducer(state, definition.steps[0]!);
    // Also defend against a retained detail selection supplied by the session adapter.
    state = { ...state, selectedId: definition.target };
    expect(state.selectedId).toBe(definition.target);
    expect(state.completed).toEqual([definition.ids[0]]);
    expect(state.error).toBeNull();
    const beforeRepeat = structuredClone(state);
    state = previewReducer(state, definition.steps[1]!);
    expect(state.selectedId).toBe(beforeRepeat.selectedId);
    expect(state.filter).toBe(beforeRepeat.filter);
    expect(state.view).toBe(beforeRepeat.view);
    expect(state.records).toEqual(beforeRepeat.records);
    expect(state.completed).toEqual([definition.ids[0]]);
    expect(state.error).toMatch(/already open.*another.*reopen/i);
    state = previewReducer(state, definition.steps[2]!);
    expect(state.records).toEqual(beforeRepeat.records);
    expect(state.completed).toEqual([definition.ids[0]]);
    state = previewReducer(state, { type: "open", recordId: definition.other });
    expect(state.selectedId).toBe(definition.other);
    expect(state.completed).toEqual([definition.ids[0]]);
    state = previewReducer(state, definition.steps[1]!);
    expect(state.selectedId).toBe(definition.target);
    expect(state.completed).toEqual(definition.ids.slice(0, 2));
    expect(state.error).toBeNull();
    state = previewReducer(state, definition.steps[2]!);
    expect(state.completed).toEqual(definition.ids);
    expect(state.gate).toBe("result");
    expect(state.records.find((record) => record.id === definition.target)!.values).toMatchObject(definition.final);
  });

  it.each(["sponsor", "speaker"] as const)("requires the current prompted %s filter when counting its open step", (workflow) => {
    const definition = cases.find((item) => item.workflow === workflow)!;
    const state = run(createPreviewSession(workflow, legacyDiscovery()), [definition.steps[0]!, { type: "filter", value: "No match" }]);
    const opened = previewReducer(state, definition.steps[1]!);
    expect(opened.selectedId).toBe(definition.target);
    expect(opened.completed).toEqual([definition.ids[0]]);
    expect(opened.error).not.toBeNull();
  });

  it("assigns only the prompted fictional AV team and never mutates task records", () => {
    const initial = createPreviewSession("operations", legacyDiscovery());
    const opened = previewReducer(initial, { type: "open", recordId: "IN-1040" });
    for (const team of ["", "AV team", "Sample venue team", "<script>live</script>"]) {
      const next = previewReducer(opened, { type: "assign", recordId: "IN-1040", team });
      expect(next.records).toEqual(opened.records);
      expect(next.completed).toEqual(["operations.open"]);
      expect(next.error).not.toBeNull();
    }
    const taskView = run(opened, [{ type: "view", view: "tasks" }, { type: "open", recordId: "TA-1040" }]);
    expect(taskView).toMatchObject({ view: "tasks", selectedId: "TA-1040", completed: ["operations.open"] });
    for (const event of [{ type: "assign", recordId: "TA-1040", team: "Sample AV team" }, { type: "start", recordId: "TA-1040" }] as PreviewEvent[]) {
      const next = previewReducer(taskView, event);
      expect(next.records).toEqual(taskView.records);
      expect(next.completed).toEqual(taskView.completed);
    }
  });

  it.each(cases)("ignores unsupported field-update events and invalid views in $workflow", ({ workflow }) => {
    const state = createPreviewSession(workflow, legacyDiscovery());
    const next = previewReducer(state, { type: "update", recordId: state.records[0]!.id, field: "status", value: "Paid" } as unknown as PreviewEvent);
    expect(next.records).toEqual(state.records);
    expect(next.completed).toEqual([]);
    expect(previewReducer(state, { type: "view", view: "vault" }).view).toBe(state.view);
  });

  it("makes no network calls, storage writes, notifications or scheduled work", () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const timers = vi.spyOn(globalThis, "setTimeout");
    for (const item of cases) {
      const state = run(createPreviewSession(item.workflow, legacyDiscovery()), item.steps);
      deriveSummary(state);
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(timers).not.toHaveBeenCalled();
  });
});
