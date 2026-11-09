// The Agent Organization: the set of agents a client gets, each with a job,
// the tools it may use, a budget and an approval rule. Plain data on purpose,
// so the same definition can be stored in the client's Twin Vault folder once
// write access through the Vault proxy is wired (today the proxy is read-only).
import type { SolutionDiscovery } from "../build/types";

export type AgentRole = "director" | "research" | "build" | "content" | "outreach";

export interface AgentDef {
  role: AgentRole;
  name: string;
  /** One-sentence job description shown in the Command Center roster. */
  job: string;
  /** Tools the agent is allowed to call. */
  tools: string[];
  /** Hard cap on actions per run; the Director stops an agent that exceeds it. */
  budget: { steps: number };
  /** "human": anything this agent produces for the outside world waits in the approval queue. */
  approval: "none" | "human";
}

export interface AgentOrganization {
  clientId: string;
  vertical: string;
  /** Where this client's agent memory will live in the Twin Vault. */
  vaultFolder: string;
  agents: AgentDef[];
}

export const AGENT_ORDER: AgentRole[] = ["director", "research", "build", "content", "outreach"];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/** A stable per-browser client id so a returning visitor sees the same organization. */
export function clientId(d: SolutionDiscovery): string {
  const key = "xappx_client_id";
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
  } catch { /* ignore */ }
  const id = `${slugify(d.industry?.label ?? "client")}-${Math.random().toString(36).slice(2, 7)}`;
  try { sessionStorage.setItem(key, id); } catch { /* ignore */ }
  return id;
}

export function defaultOrganization(d: SolutionDiscovery): AgentOrganization {
  const id = clientId(d);
  const vertical = d.industry?.label ?? "General";
  return {
    clientId: id,
    vertical,
    vaultFolder: `/clients/${id}`,
    agents: [
      { role: "director", name: "Director", job: "Reads the blueprint, assigns work to the team and reports progress here.", tools: ["blueprint", "task-board"], budget: { steps: 12 }, approval: "none" },
      { role: "research", name: "Research agent", job: `Checks the Twin Vault and XAPPX knowledge for what already exists about this ${vertical.toLowerCase()} problem.`, tools: ["twin-vault:read", "xappx-knowledge"], budget: { steps: 6 }, approval: "none" },
      { role: "build", name: "Build agent", job: "Turns the blueprint into an App Spec and a clickable prototype.", tools: ["app-spec", "prototype"], budget: { steps: 8 }, approval: "human" },
      { role: "content", name: "Content agent", job: "Writes the launch copy for the solution: headline, promise, call to action.", tools: ["copywriter"], budget: { steps: 4 }, approval: "human" },
      { role: "outreach", name: "Outreach agent", job: "Drafts the build request to the XAPPX team so a human expert takes over.", tools: ["lead-form"], budget: { steps: 3 }, approval: "human" },
    ],
  };
}
