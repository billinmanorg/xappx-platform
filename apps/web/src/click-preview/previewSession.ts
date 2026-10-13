import type { SolutionDiscovery } from "../build/types";
import { seedRecords } from "./sampleRecords";
import type { PreviewEvent, PreviewSession, SampleRecord, WorkflowId } from "./types";
import { buildPreviewAppSpec } from "./workflowSpecs";

const guided = {
  sponsor: { entity: "lead", filter: "High", steps: ["sponsor.filter", "sponsor.open", "sponsor.qualify"] },
  speaker: { entity: "submission", filter: "Experience", steps: ["speaker.filter", "speaker.open", "speaker.shortlist"] },
  operations: { entity: "incident", filter: "", steps: ["operations.open", "operations.assign", "operations.start"] },
} as const;

const recoveryError = "The sample record is unavailable or has changed. Use Back or Reset demo to try again.";
const orderError = "Follow the prompted guided step before changing this sample record.";

export function createPreviewSession(workflow: WorkflowId, discovery: SolutionDiscovery): PreviewSession {
  const spec = buildPreviewAppSpec(workflow, discovery);
  const session: PreviewSession = {
    workflow, spec, records: [], completed: [], selectedId: null, filter: "",
    view: spec.views.find((view) => view.kind === "list")?.id ?? "dashboard",
    gate: "open", error: null,
  };
  try { return { ...session, records: seedRecords(spec) }; }
  catch { return { ...session, error: "Sample records could not be prepared. Use Back or Reset demo to try again." }; }
}

function fail(state: PreviewSession, error: string): PreviewSession { return { ...state, error }; }

function validProgress(state: PreviewSession): boolean {
  const steps = guided[state.workflow].steps;
  return state.completed.length <= steps.length && state.completed.every((id, index) => id === steps[index]);
}

function recordById(state: PreviewSession, id: string): SampleRecord | null {
  const matches = state.records.filter((record) => record.id === id);
  if (matches.length !== 1) return null;
  const record = matches[0]!;
  const entity = state.spec.entities.find((item) => item.name === record.entity);
  if (!entity || entity.fields.some((field) => typeof record.values[field.name] !== "string")) return null;
  return record;
}

function promptedRecord(state: PreviewSession): SampleRecord | null {
  try {
    const expected = seedRecords(state.spec).find((record) => record.entity === guided[state.workflow].entity);
    if (!expected) return null;
    const actual = recordById(state, expected.id);
    if (actual?.entity !== expected.entity) return null;
    // A stale/reused id must not authorize editing a different sample record.
    const mutableFields = state.workflow === "sponsor" ? ["stage"] : state.workflow === "speaker" ? ["status"] : ["team", "status"];
    return Object.entries(expected.values).every(([field, value]) => mutableFields.includes(field) || actual.values[field] === value) ? actual : null;
  } catch { return null; }
}

function initialTarget(state: PreviewSession, record: SampleRecord): boolean {
  if (state.workflow === "sponsor") return record.values.interest === "High" && record.values.stage === "New";
  if (state.workflow === "speaker") return record.values.topic === "Experience" && record.values.status === "Submitted";
  return record.values.status === "Open";
}

function complete(state: PreviewSession, id: string, records = state.records): PreviewSession {
  const completed = [...state.completed, id];
  return { ...state, records, completed, gate: completed.length === 3 ? "result" : "open", error: null };
}

/** The only sample mutation boundary. Navigation remains usable even after the three-action gate. */
export function previewReducer(state: PreviewSession, event: PreviewEvent): PreviewSession {
  const definition = guided[state.workflow];
  switch (event.type) {
    case "view":
      return state.spec.views.some((view) => view.id === event.view && !view.locked)
        ? { ...state, view: event.view, error: null }
        : fail(state, "That sample view is unavailable. Use Back to choose another view.");
    case "filter": {
      const next = { ...state, filter: event.value, selectedId: event.value === state.filter ? state.selectedId : null, error: null };
      if (state.workflow === "operations" || state.gate !== "open" || state.completed.length !== 0 || event.value !== definition.filter) return next;
      const record = promptedRecord(state);
      if (!record || !initialTarget(state, record)) return fail(next, recoveryError);
      return complete(next, definition.steps[0]);
    }
    case "open": {
      const record = recordById(state, event.recordId);
      if (!record) return fail(state, recoveryError);
      const next = { ...state, selectedId: record.id, error: null };
      if (state.gate !== "open" || state.completed.includes(`${state.workflow}.open`)) return next;
      if (!validProgress(state)) return fail(next, recoveryError);
      const target = promptedRecord(state);
      if (!target) return fail(next, recoveryError);
      if (record.id !== target.id) return next;
      if (!initialTarget(state, target)) return fail(next, recoveryError);
      const id = `${state.workflow}.open`;
      if (definition.steps[state.completed.length] !== id || (state.workflow !== "operations" && state.filter !== definition.filter)) return fail(next, orderError);
      if (state.selectedId === record.id) return fail(next, "This sample record is already open. Open another sample record, then reopen the prompted record to continue.");
      return complete(next, id);
    }
    case "showPlans":
      return validProgress(state) && state.completed.length === 3 && ["result", "readonly", "plans"].includes(state.gate)
        ? { ...state, gate: "plans", error: null }
        : fail(state, "Complete the three guided sample actions before viewing proposed plans.");
    case "returnToPreview":
      return state.gate === "plans" ? { ...state, gate: "readonly", error: null } : state;
    case "qualify":
    case "shortlist":
    case "assign":
    case "start": {
      if (state.gate !== "open" || state.completed.length >= 3) return fail(state, "Three sample actions are complete. Edits are locked; you can keep inspecting records.");
      if (!validProgress(state)) return fail(state, recoveryError);
      const record = recordById(state, event.recordId);
      const target = promptedRecord(state);
      if (!record || !target || record.entity !== definition.entity) return fail(state, recoveryError);
      if (record.id !== target.id || state.selectedId !== target.id) return fail(state, orderError);
      const id = `${state.workflow}.${event.type}`;
      if (state.completed.includes(id)) return { ...state, error: null };
      if (definition.steps[state.completed.length] !== id) return fail(state, orderError);
      if (!initialTarget(state, record)) return fail(state, recoveryError);
      let patch: Record<string, string>;
      switch (event.type) {
        case "qualify": patch = { stage: "Qualified" }; break;
        case "shortlist": patch = { status: "Shortlisted" }; break;
        case "assign":
          if (event.team !== "Sample AV team") return fail(state, "Choose the prompted Sample AV team for this sample incident.");
          if (record.values.team !== "Unassigned") return fail(state, recoveryError);
          patch = { team: "Sample AV team" }; break;
        case "start":
          if (record.values.team !== "Sample AV team") return fail(state, recoveryError);
          patch = { status: "In progress" }; break;
      }
      const records = state.records.map((item) => item.id === record.id ? { ...item, values: { ...item.values, ...patch } } : item);
      return complete(state, id, records);
    }
    default: return state;
  }
}

/** All figures count current fictional records; the legacy projection's stock metrics are unused. */
export function deriveSummary(state: PreviewSession): { label: string; value: number }[] {
  const records = state.records.filter((record) => record.entity === guided[state.workflow].entity);
  const count = (field: string, value: string) => records.filter((record) => record.values[field] === value).length;
  if (state.workflow === "sponsor") return [
    { label: "Sample leads", value: records.length },
    { label: "High-interest leads", value: count("interest", "High") },
    { label: "Qualified leads", value: count("stage", "Qualified") },
  ];
  if (state.workflow === "speaker") return [
    { label: "Sample submissions", value: records.length },
    { label: "Experience submissions", value: count("topic", "Experience") },
    { label: "Shortlisted submissions", value: count("status", "Shortlisted") },
  ];
  return [
    { label: "Open incidents", value: count("status", "Open") },
    { label: "Assigned incidents", value: records.filter((record) => Boolean(record.values.team) && record.values.team !== "Unassigned").length },
    { label: "In-progress incidents", value: count("status", "In progress") },
    { label: "Sample tasks", value: state.records.filter((record) => record.entity === "task").length },
  ];
}
