import type { AppEntity, AppSpec } from "../build/appSpec";
import { buildAppSpec } from "../build/discoveryService";
import type { SolutionDiscovery } from "../build/types";
import type { WorkflowId } from "./types";

const definitions: Record<WorkflowId, { name: string; entities: AppEntity[]; prompts: string[] }> = {
  sponsor: {
    name: "Sponsor Lead Desk",
    entities: [{
      name: "lead", label: "Lead", labelPlural: "Leads", statusField: "stage",
      fields: [
        { name: "company", label: "Company", type: "text", samples: ["Sample Cloudberry Studio", "Sample Lantern Works", "Sample Pebble Labs", "Sample Kitehouse", "Sample Paperboat Co", "Sample Moonflower Design"] },
        { name: "interest", label: "Interest", type: "select", options: ["High", "Normal", "Low"], samples: ["High", "Normal", "High", "Low", "Normal", "High"] },
        { name: "owner", label: "Owner", type: "text", samples: ["Sample sponsor team", "Sample follow-up team"] },
        { name: "stage", label: "Stage", type: "status", options: ["New", "Contacted", "Qualified"], samples: ["New", "New", "New", "Contacted", "New", "Qualified"] },
      ],
    }],
    prompts: ["Filter sample leads to High interest", "Open Sample Cloudberry Studio", "Mark the prompted sample lead Qualified"],
  },
  speaker: {
    name: "Speaker Submission Review",
    entities: [{
      name: "submission", label: "Submission", labelPlural: "Submissions", statusField: "status",
      fields: [
        { name: "title", label: "Title", type: "text", samples: ["Sample: Welcoming every attendee", "Sample: Designing clear schedules", "Sample: Making space for conversation", "Sample: Measuring useful feedback", "Sample: Accessible room layouts", "Sample: Memorable event moments"] },
        { name: "topic", label: "Topic", type: "select", options: ["Experience", "Planning", "Feedback"], samples: ["Experience", "Planning", "Experience", "Feedback", "Planning", "Experience"] },
        { name: "format", label: "Format", type: "select", options: ["Talk", "Workshop", "Panel"], samples: ["Talk", "Workshop", "Panel"] },
        { name: "abstract", label: "Abstract", type: "text", samples: ["Fictional proposal exploring welcoming event experiences.", "Fictional proposal with practical event planning exercises.", "Fictional proposal about creating room for useful conversations."] },
        { name: "status", label: "Status", type: "status", options: ["Submitted", "Under review", "Shortlisted"], samples: ["Submitted", "Under review", "Submitted", "Shortlisted", "Submitted", "Submitted"] },
      ],
    }],
    prompts: ["Filter sample submissions to Experience", "Open Sample: Welcoming every attendee", "Mark the prompted sample submission Shortlisted"],
  },
  operations: {
    name: "Event Operations Board",
    entities: [
      {
        name: "incident", label: "Incident", labelPlural: "Incidents", statusField: "status",
        fields: [
          { name: "incident", label: "Incident", type: "text", samples: ["Sample: Hall A microphone check", "Sample: Entry sign missing", "Sample: Projector brightness", "Sample: Room seating reset", "Sample: Water station refill", "Sample: Information desk queue"] },
          { name: "severity", label: "Severity", type: "select", options: ["High", "Normal", "Low"], samples: ["High", "Normal", "Normal", "Low", "Normal", "Low"] },
          { name: "location", label: "Location", type: "text", samples: ["Sample Hall A", "Sample entry", "Sample Room B", "Sample Room C", "Sample foyer", "Sample information desk"] },
          { name: "team", label: "Sample team", type: "select", options: ["Unassigned", "Sample AV team", "Sample venue team", "Sample steward team"], samples: ["Unassigned", "Sample venue team", "Sample AV team", "Sample venue team", "Unassigned", "Sample steward team"] },
          { name: "status", label: "Status", type: "status", options: ["Open", "In progress", "Resolved"], samples: ["Open", "Open", "In progress", "Resolved", "Open", "Open"] },
        ],
      },
      {
        name: "task", label: "Task", labelPlural: "Tasks", statusField: "status",
        fields: [
          { name: "task", label: "Task", type: "text", samples: ["Sample: Check spare microphones", "Sample: Prepare welcome signs", "Sample: Set up workshop tables", "Sample: Check room lighting", "Sample: Refill supplies", "Sample: Review closing checklist"] },
          { name: "severity", label: "Severity", type: "select", options: ["High", "Normal", "Low"], samples: ["Normal", "Normal", "High", "Low", "Normal", "Low"] },
          { name: "location", label: "Location", type: "text", samples: ["Sample Hall A", "Sample entry", "Sample Room B", "Sample Room C", "Sample foyer", "Sample office"] },
          { name: "team", label: "Sample team", type: "select", options: ["Sample AV team", "Sample venue team", "Sample steward team"], samples: ["Sample AV team", "Sample venue team", "Sample steward team"] },
          { name: "status", label: "Status", type: "status", options: ["To do", "In progress", "Done"], samples: ["To do", "In progress", "To do", "Done", "To do", "To do"] },
        ],
      },
    ],
    prompts: ["Open Sample: Hall A microphone check", "Assign the prompted sample incident to Sample AV team", "Set the prompted sample incident to In progress"],
  },
};

/** Compatible AppSpec overlay; discovery is context, never a source of sample records or live controls. */
export function buildPreviewAppSpec(workflow: WorkflowId, discovery: SolutionDiscovery): AppSpec {
  const base = buildAppSpec(discovery);
  const definition = definitions[workflow];
  const entities = definition.entities.map((entity) => ({
    ...entity,
    fields: entity.fields.map((field) => ({ ...field, ...(field.samples ? { samples: [...field.samples] } : {}), ...(field.options ? { options: [...field.options] } : {}) })),
  }));
  return {
    ...base,
    name: definition.name,
    summary: "Sample data · Preview. All records and teams are fictional; guidance is predefined.",
    foundation: "Vault: Not connected",
    entities,
    roles: [{ name: "sample_team", label: "Sample event team", access: "staff" }],
    views: [
      { id: "dashboard", label: "Sample overview", kind: "dashboard", locked: false },
      ...entities.map((entity) => ({ id: entity.labelPlural.toLowerCase(), label: entity.labelPlural, kind: "list" as const, entity: entity.name, locked: false })),
    ],
    workflow: definition.prompts.map((label) => ({ label })),
    aiActions: [],
    primaryAIAction: "",
    vaultBindings: [],
    aiResult: { summary: "", recommendation: "", flags: [] },
  };
}
