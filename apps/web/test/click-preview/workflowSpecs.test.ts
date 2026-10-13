import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prototypeFromSpec, type AppSpec } from "../../src/build/appSpec";
import { buildAppSpec } from "../../src/build/discoveryService";
import { buildPreviewAppSpec } from "../../src/click-preview/workflowSpecs";
import { seedRecords } from "../../src/click-preview/sampleRecords";
import type { WorkflowId } from "../../src/click-preview/types";
import { legacyDiscovery, LEGACY_FIXTURES } from "./fixtures";

const workflows: WorkflowId[] = ["sponsor", "speaker", "operations"];

// Leaking legacy AI/Vault controls or replacing the compatible schema fails these checks.
describe("compatible sample-only specifications", () => {
  it.each(workflows)("overlays %s without mutating discovery or the legacy AppSpec", (workflow) => {
    const discovery = legacyDiscovery(LEGACY_FIXTURES[2].challenge);
    const before = structuredClone(discovery);
    const legacy = buildAppSpec(discovery);
    const legacyBefore = structuredClone(legacy);
    const spec: AppSpec = buildPreviewAppSpec(workflow, discovery);
    expect(discovery).toEqual(before);
    expect(legacy).toEqual(legacyBefore);
    expect(Object.keys(spec).sort()).toEqual(Object.keys(legacy).sort());
    expect(spec.industry).toBe(legacy.industry);
    expect(spec.challenge).toBe(legacy.challenge);
    expect(spec.foundation).toBe("Vault: Not connected");
    expect(spec.summary).toMatch(/sample|fictional/i);
    expect(spec.aiActions).toEqual([]);
    expect(spec.primaryAIAction).toBe("");
    expect(spec.aiResult).toEqual({ summary: "", recommendation: "", flags: [] });
    expect(spec.vaultBindings).toEqual([]);
    expect(spec.views.every((view) => ["dashboard", "list"].includes(view.kind) && !view.locked)).toBe(true);
    expect(spec.entities.flatMap((entity) => entity.fields).every((field) => !field.vaultOwned)).toBe(true);
    expect(spec.workflow).toHaveLength(3);
    expect(prototypeFromSpec(spec).items).toHaveLength(6);
  });

  it.each([
    ["sponsor", "Sponsor Lead Desk", ["lead"], ["company", "interest", "owner", "stage"]],
    ["speaker", "Speaker Submission Review", ["submission"], ["title", "topic", "format", "abstract", "status"]],
    ["operations", "Event Operations Board", ["incident", "task"], ["incident", "severity", "location", "team", "status"]],
  ] as const)("defines %s with the approved fields", (workflow, name, entities, fields) => {
    const spec = buildPreviewAppSpec(workflow, legacyDiscovery());
    expect(spec.name).toBe(name);
    expect(spec.entities.map((entity) => entity.name)).toEqual(entities);
    expect(spec.entities[0]!.fields.map((field) => field.name)).toEqual(fields);
    expect(spec.entities[0]!.statusField).toBe(workflow === "sponsor" ? "stage" : "status");
    if (workflow === "operations") {
      expect(spec.entities[1]!.fields.map((field) => field.name)).toEqual(["task", "severity", "location", "team", "status"]);
      expect(spec.views.filter((view) => view.kind === "list").map((view) => view.entity)).toEqual(["incident", "task"]);
    }
  });

  it.each(workflows)("returns independent %s specifications and seeds", (workflow) => {
    const first = buildPreviewAppSpec(workflow, legacyDiscovery());
    const before = structuredClone(first);
    const records = seedRecords(first);
    records[0]!.values[Object.keys(records[0]!.values)[0]!] = "changed locally";
    first.entities[0]!.fields[0]!.samples![0] = "changed specification";
    first.views[0]!.label = "changed view";
    first.workflow[0]!.label = "changed prompt";
    expect(buildPreviewAppSpec(workflow, legacyDiscovery())).toEqual(before);
    expect(Object.values(seedRecords(before)[0]!.values)).not.toContain("changed locally");
  });
});

// Dropping the second entity, copying stock stats/AI output or inventing field values fails these checks.
describe("entity-only prototype projection", () => {
  it.each(workflows)("projects every %s entity's ids and values through prototypeFromSpec", (workflow) => {
    const spec = buildPreviewAppSpec(workflow, legacyDiscovery());
    const expected = spec.entities.flatMap((entity) => prototypeFromSpec({ ...spec, entities: [entity] }).items.map((item) => ({
      id: item.id, entity: entity.name,
      values: Object.fromEntries(entity.fields.map((field, index) => [field.name, item.fields![index]!.value])),
    })));
    const records = seedRecords(spec);
    expect(records).toEqual(expected);
    expect(new Set(records.map((record) => record.id)).size).toBe(records.length);
    for (const record of records) expect(Object.keys(record).sort()).toEqual(["entity", "id", "values"]);
  });

  it("starts prompted records in the exact required states", () => {
    expect(seedRecords(buildPreviewAppSpec("sponsor", legacyDiscovery()))[0]).toMatchObject({ id: "LE-1040", entity: "lead", values: { interest: "High", stage: "New" } });
    expect(seedRecords(buildPreviewAppSpec("speaker", legacyDiscovery()))[0]).toMatchObject({ id: "SU-1040", entity: "submission", values: { topic: "Experience", status: "Submitted" } });
    expect(seedRecords(buildPreviewAppSpec("operations", legacyDiscovery()))[0]).toMatchObject({ id: "IN-1040", entity: "incident", values: { team: "Unassigned", status: "Open" } });
  });

  it("does not mutate or share records from deeply frozen specifications", () => {
    const spec = buildPreviewAppSpec("operations", legacyDiscovery());
    const freeze = (value: unknown): void => {
      if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
    };
    freeze(spec);
    const first = seedRecords(spec);
    const second = seedRecords(spec);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    first[0]!.values.team = "local edit";
    expect(second[0]!.values.team).toBe("Unassigned");
    expect(seedRecords(spec)).toEqual(second);
  });

  it.each(["empty entities", "unsupported entity", "empty fields", "duplicate fields", "duplicate labels", "bad sample", "duplicate ids"])("reports recoverable bad seeds: %s", (kind) => {
    const spec = buildPreviewAppSpec("operations", legacyDiscovery());
    if (kind === "empty entities") spec.entities = [];
    if (kind === "unsupported entity") spec.entities[0]!.name = "live-customer";
    if (kind === "empty fields") spec.entities[0]!.fields = [];
    if (kind === "duplicate fields") spec.entities[0]!.fields[1]!.name = spec.entities[0]!.fields[0]!.name;
    if (kind === "duplicate labels") spec.entities[0]!.fields[1]!.label = spec.entities[0]!.fields[0]!.label;
    if (kind === "bad sample") spec.entities[0]!.fields[0]!.samples = [42 as unknown as string];
    if (kind === "duplicate ids") spec.entities.push(structuredClone(spec.entities[0]!));
    expect(() => seedRecords(spec)).toThrow(/sample.*(?:back|reset)/i);
  });
});

// These hashes were captured from BASE f3d67a2 before production edits; any legacy output change fails.
describe("unchanged legacy buildAppSpec → prototypeFromSpec regression", () => {
  const hashes = [
    "ae4372058ab91e8e80c8baa4f5df0ad52ba045a13d6a4ae2414634281b4f270a",
    "600c02027d3e55e5fc990ca1b6528d81b7ba0b14c8ed2229fe0f9d7849f63eb1",
    "4c0575cde59ed379ea6e22df87de66000b61ea1ffeba32ff4c286171b75bb863",
    "c83a80a57d05866f0b06fa3e3779c88fdd970c9295943419c5269b7d10631eac",
    "ba20bd533953fd23705f86a50ecfe6996ea8195a7afaf7c9aecb26c150a3fab7",
    "221aece5c34eea8ae22921b8502970767f656d9bd3ab24ef393e243618b0bd91",
  ];
  it.each(LEGACY_FIXTURES.map((fixture, index) => ({ ...fixture, hash: hashes[index]! })))("keeps $id exact", ({ challenge, hash }) => {
    const spec = buildAppSpec(legacyDiscovery(challenge));
    expect(createHash("sha256").update(JSON.stringify({ spec, prototype: prototypeFromSpec(spec) })).digest("hex")).toBe(hash);
  });

  it("keeps an unrelated Healthcare output exact", () => {
    const spec = buildAppSpec({ ...legacyDiscovery("Patient intake is slow"), industry: { slug: "healthcare", label: "Healthcare" } });
    expect(createHash("sha256").update(JSON.stringify({ spec, prototype: prototypeFromSpec(spec) })).digest("hex")).toBe("5eb9a2ddb0075b693b8f1c89df5ac7719f3071afee1e0d4dcefe0ebf66e654a5");
  });
});
