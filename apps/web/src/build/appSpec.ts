// The App Spec — the structured, backend-ready definition of a customer's app.
// It is the missing "functional" layer between discovery and a running app:
// where today's manifest carries only branding + module toggles, the App Spec
// adds the data model, roles, views, workflows, AI actions, and the Twin Vault
// bindings that say where each entity's data lives.
//
// This is plain, JSON-serializable data on purpose: the same spec that renders
// the /build preview (see prototypeFromSpec) is what clients-service will store
// and web-runtime will render as the real app, reading/writing through the
// external Twin Vault.

import type { PrototypeItem, PrototypeSpec } from "./types";

export type FieldType = "text" | "email" | "select" | "status" | "date" | "number";

export interface AppField {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
  /** Sample values used only to render the preview. */
  samples?: string[];
  /** True when this field's value is owned by the party's Twin Vault. */
  vaultOwned?: boolean;
}

export interface AppEntity {
  name: string;
  label: string;
  labelPlural: string;
  fields: AppField[];
  /** Name of the field that holds the record's status, if any. */
  statusField?: string;
}

export interface AppRole { name: string; label: string; access: "admin" | "staff" | "member" }
export interface AppView { id: string; label: string; kind: "dashboard" | "list" | "vault" | "reports" | "integrations" | "automation" | "settings"; entity?: string; locked: boolean }
export interface AppWorkflowStep { label: string }
export interface AppAIAction { label: string }
/** Which party's Twin Vault holds an entity, and under what scope. */
export interface VaultBinding { entity: string; owner: string; note: string }

export interface AppSpec {
  name: string;
  industry: string;
  challenge: string;
  summary: string;
  /** How the app is grounded on the Twin Vault. */
  foundation: string;
  entities: AppEntity[];
  roles: AppRole[];
  views: AppView[];
  workflow: AppWorkflowStep[];
  aiActions: AppAIAction[];
  /** The primary one-click AI action shown on a record. */
  primaryAIAction: string;
  vaultBindings: VaultBinding[];
  aiResult: { summary: string; recommendation: string; flags: string[] };
}

// ---- preview projection -------------------------------------------------
// Renders a spec into the existing PrototypeSpec the /build shell consumes, so
// the preview is literally a projection of the App Spec. The real web-runtime
// will render the same spec against live Twin Vault data instead of samples.

const PRIOS: Array<"High" | "Normal" | "Low"> = ["High", "Normal", "Normal", "Low", "Normal", "High"];

function sampleVal(f: AppField, i: number): string {
  if (f.samples && f.samples.length) return f.samples[i % f.samples.length]!;
  if (f.options && f.options.length) return f.options[i % f.options.length]!;
  switch (f.type) {
    case "email": return `person${i + 1}@example.com`;
    case "date": return ["May 14", "May 15", "May 16"][i % 3]!;
    case "number": return String(100 + i * 3);
    default: return `${f.label} ${i + 1}`;
  }
}

export function prototypeFromSpec(spec: AppSpec): PrototypeSpec {
  const entity = spec.entities[0]!;
  const titleField = entity.fields.find((f) => f.type === "text") ?? entity.fields[0]!;
  const statusField = entity.fields.find((f) => f.name === entity.statusField);
  const roleNames = spec.roles.map((r) => r.label);

  const items: PrototypeItem[] = Array.from({ length: 6 }, (_, i) => {
    const fields = entity.fields.map((f) => ({ label: f.label, value: sampleVal(f, i) }));
    const statusVal = statusField ? sampleVal(statusField, i) : ["New", "AI-reviewed", "Needs review", "In progress", "Approved"][i % 5]!;
    return {
      id: `${entity.name.slice(0, 2).toUpperCase()}-${1040 + i}`,
      title: sampleVal(titleField, i),
      assignee: roleNames[i % roleNames.length] ?? "Team",
      status: statusVal,
      priority: PRIOS[i % PRIOS.length]!,
      fields,
    };
  });

  const nav = spec.views.map((v) => ({
    // the primary list view maps to the shell's built-in "queue" renderer
    id: v.kind === "list" ? "queue" : v.id,
    label: v.label,
    locked: v.locked,
  }));

  const plural = entity.labelPlural;
  return {
    appName: spec.name,
    workflowLabel: plural,
    nav,
    stats: [
      { label: `Open ${plural.toLowerCase()}`, value: "42" },
      { label: "Auto-handled by AI", value: "68%", hint: "this week" },
      { label: "Avg. handling time", value: "2.4h", hint: "↓ this week" },
      { label: "Needs your review", value: "7" },
    ],
    items,
    aiActionLabel: spec.primaryAIAction,
    aiResult: spec.aiResult,
  };
}
