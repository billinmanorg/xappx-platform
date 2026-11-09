// Runs the Agent Organization for one client and exposes the event stream,
// approval queue and stats the Command Center renders. Every event is a real
// action (a Vault read, an AI call, a spec built, a draft written); the only
// waits are short pauses so people can follow the log.
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppSpec } from "../build/appSpec";
import type { SolutionDiscovery } from "../build/types";
import { AGENT_ORDER, defaultOrganization, type AgentOrganization, type AgentRole } from "./agentOrg";

export type EventKind = "start" | "action" | "finding" | "produced" | "approval" | "approved" | "rejected" | "done" | "error" | "idle";
export interface AgentEvent { id: string; at: number; agent: AgentRole | "xappy"; kind: EventKind; text: string }
export type ApprovalKind = "prototype" | "copy" | "request";
export interface ApprovalItem { id: string; kind: ApprovalKind; agent: AgentRole; title: string; body: string; status: "pending" | "approved" | "rejected"; createdAt: number }
export type AgentState = "idle" | "working" | "done" | "error";
export interface RunStats { problems: number; blueprints: number; prototypes: number; hoursSaved: number; leads: number }
export interface LaunchCopy { headline: string; subhead: string; cta: string }

const ENDPOINT = "/.netlify/functions/agents";
const STATS_KEY = "xappx_cc_stats";
const uid = () => Math.random().toString(36).slice(2, 10);
const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

interface ResearchData {
  vault: { configured: boolean; folders?: number; matches?: number; query?: string; error?: string };
  ai: { enabled: boolean; used: boolean };
  insights: string[];
}
interface ContentData extends LaunchCopy { ai: boolean }

async function callAgents<T>(payload: Record<string, unknown>): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: ctrl.signal });
    window.clearTimeout(t);
    if (!r.ok) return null;
    const j = (await r.json()) as { ok?: boolean; data?: T };
    return j.ok && j.data ? j.data : null;
  } catch {
    return null;
  }
}

function loadStats(): RunStats {
  const base: RunStats = { problems: 0, blueprints: 0, prototypes: 0, hoursSaved: 0, leads: 0 };
  try {
    const s = JSON.parse(localStorage.getItem(STATS_KEY) || "{}") as Partial<RunStats>;
    const leads = (JSON.parse(localStorage.getItem("xappx_leads") || "[]") as unknown[]).length;
    return { ...base, ...s, leads };
  } catch { return base; }
}
function saveStats(s: RunStats) { try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch { /* ignore */ } }

/** Rough weekly hours the workflow automates: steps × people involved × 1.5 h. */
export function estimateHoursSaved(spec: AppSpec, d: SolutionDiscovery): number {
  const people = Math.max(1, d.stakeholders.length);
  return Math.round(spec.workflow.length * people * 1.5);
}

export function useAgentRun(d: SolutionDiscovery, spec: AppSpec, opts: { speak?: (text: string) => void } = {}) {
  const [org] = useState<AgentOrganization>(() => defaultOrganization(d));
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [states, setStates] = useState<Record<AgentRole, AgentState>>(() =>
    Object.fromEntries(AGENT_ORDER.map((r) => [r, "idle"])) as Record<AgentRole, AgentState>);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [stats, setStats] = useState<RunStats>(loadStats);
  const [copy, setCopy] = useState<LaunchCopy | null>(null);
  const [published, setPublished] = useState(false);
  const startedRef = useRef(false);
  const speakRef = useRef(opts.speak);
  speakRef.current = opts.speak;

  const push = useCallback((agent: AgentEvent["agent"], kind: EventKind, text: string, say = false) => {
    setEvents((e) => [...e, { id: uid(), at: Date.now(), agent, kind, text }]);
    if (say) speakRef.current?.(text);
  }, []);
  const setState = useCallback((role: AgentRole, s: AgentState) => setStates((p) => ({ ...p, [role]: s })), []);
  const bump = useCallback((patch: Partial<RunStats>) => {
    setStats((s) => {
      const next = { ...s };
      for (const [k, v] of Object.entries(patch) as [keyof RunStats, number][]) next[k] = s[k] + v;
      saveStats(next);
      return next;
    });
  }, []);
  const queue = useCallback((item: Omit<ApprovalItem, "id" | "status" | "createdAt">) => {
    setApprovals((a) => [...a, { ...item, id: uid(), status: "pending", createdAt: Date.now() }]);
  }, []);

  const start = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setRunning(true);
    const industry = d.industry?.label ?? "your industry";
    const challenge = d.challenge ?? "the problem";
    const entity = spec.entities[0];

    // Director
    setState("director", "working");
    push("director", "start", `Director online for ${org.clientId}. Reading the blueprint for "${spec.name}".`, true);
    bump({ problems: 1, blueprints: d.blueprint ? 1 : 0 });
    await sleep(700);
    push("director", "action", `Assigned 4 tasks: research the problem, build the prototype, write the launch copy, draft the build request. Memory folder: ${org.vaultFolder}.`);
    await sleep(600);

    // Research agent (server: Twin Vault + AI, aggregate results only)
    setState("research", "working");
    push("research", "start", `Research agent: looking up "${challenge}" in ${industry}.`);
    const research = await callAgents<ResearchData>({ action: "research", industry, challenge, outcomes: d.outcomes, stakeholders: d.stakeholders });
    if (research) {
      const v = research.vault;
      if (v.configured && !v.error) {
        push("research", "finding", `Connected to the Twin Vault: ${v.folders ?? 0} folders; ${v.matches ?? 0} files match "${v.query ?? industry}".`);
      } else if (v.configured && v.error) {
        push("research", "error", `Twin Vault reachable but the read failed (${v.error}). Continuing without it.`);
      } else {
        push("research", "action", "Twin Vault is not connected on this site yet; skipping the vault read.");
      }
      if (!research.ai.enabled) push("research", "action", `Live AI is off on this site. Using XAPPX's curated ${industry} knowledge instead.`);
      const insights = research.insights.length ? research.insights : (d.blueprint?.aiOpportunities ?? []).slice(0, 3);
      for (const line of insights) { push("research", "finding", `Found: ${line}`); await sleep(450); }
    } else {
      push("research", "error", "Research service did not answer; using the blueprint's own findings.");
      for (const line of (d.blueprint?.aiOpportunities ?? []).slice(0, 3)) { push("research", "finding", `Found: ${line}`); await sleep(400); }
    }
    setState("research", "done");
    await sleep(500);

    // Build agent (local: the App Spec is the real artefact)
    setState("build", "working");
    push("build", "start", "Build agent: turning the blueprint into an App Spec.", true);
    await sleep(500);
    if (entity) push("build", "action", `Defined the ${entity.label} record with ${entity.fields.length} fields${entity.statusField ? ` and a status field` : ""}.`);
    await sleep(450);
    push("build", "action", `Set ${spec.roles.length} roles (${spec.roles.map((r) => r.label).join(", ")}) and ${spec.views.filter((v) => !v.locked).length} open screens of ${spec.views.length}.`);
    await sleep(450);
    push("build", "action", `Wired the ${spec.workflow.length}-step workflow and ${spec.aiActions.length} AI actions; primary action "${spec.primaryAIAction}".`);
    await sleep(450);
    const hours = estimateHoursSaved(spec, d);
    bump({ hoursSaved: hours });
    push("build", "produced", `Prototype ready for "${spec.name}". Estimated ${hours} hours a week automated.`, true);
    queue({ kind: "prototype", agent: "build", title: "Publish the prototype", body: `${spec.name}\n${spec.summary}\n\nRecords: ${spec.entities.map((e) => e.labelPlural).join(", ")}\nWorkflow: ${spec.workflow.map((w) => w.label).join(" → ")}` });
    push("build", "approval", "Waiting for your approval to publish the prototype.");
    setState("build", "done");
    await sleep(500);

    // Content agent (server: AI or template)
    setState("content", "working");
    push("content", "start", "Content agent: writing the launch copy.");
    const content = await callAgents<ContentData>({ action: "content", industry, challenge, appName: spec.name, summary: spec.summary, outcomes: d.outcomes });
    const draft: LaunchCopy = content
      ? { headline: content.headline, subhead: content.subhead, cta: content.cta }
      : { headline: spec.name, subhead: spec.summary, cta: "See it in action" };
    if (content && !content.ai) push("content", "action", "Live AI is off; drafted from the blueprint.");
    queue({ kind: "copy", agent: "content", title: "Approve the launch copy", body: `${draft.headline}\n\n${draft.subhead}\n\nButton: ${draft.cta}` });
    push("content", "approval", `Draft ready: "${draft.headline}". Waiting for approval.`);
    setState("content", "done");
    await sleep(500);

    // Outreach agent (local draft; sending happens only through the approved contact form)
    setState("outreach", "working");
    push("outreach", "start", "Outreach agent: drafting the build request for the XAPPX team.");
    await sleep(500);
    const request = `We want to build "${spec.name}" for ${industry}.\nProblem: ${challenge}.\nPeople involved: ${d.stakeholders.join(", ") || "to confirm"}.\nSuccess looks like: ${d.outcomes.join("; ") || "to confirm"}.\nThe prototype and blueprint are attached from the Command Center.`;
    queue({ kind: "request", agent: "outreach", title: "Send the build request to XAPPX", body: request });
    push("outreach", "approval", "Request drafted. Nothing is sent until you approve it.");
    setState("outreach", "done");

    push("director", "done", "All tasks complete. Three items are waiting for your decision in the approval queue.", true);
    setState("director", "done");
    setRunning(false);
    setFinished(true);
  }, [d, spec, org, push, setState, bump, queue]);

  const decide = useCallback((id: string, decision: "approved" | "rejected", editedBody?: string) => {
    setApprovals((a) => a.map((it) => (it.id === id ? { ...it, status: decision, body: editedBody ?? it.body } : it)));
    const item = approvals.find((it) => it.id === id);
    if (!item) return;
    const body = editedBody ?? item.body;
    if (decision === "rejected") { push("xappy", "rejected", `You rejected "${item.title}". Nothing left the system.`); return; }
    push("xappy", "approved", `You approved "${item.title}"${editedBody ? " with edits" : ""}.`);
    if (item.kind === "prototype") { setPublished(true); bump({ prototypes: 1 }); }
    if (item.kind === "copy") {
      const [headline = "", , subhead = "", , ctaLine = ""] = body.split("\n");
      setCopy({ headline, subhead, cta: ctaLine.replace(/^Button:\s*/i, "") || "See it in action" });
    }
  }, [approvals, push, bump]);

  // Refresh the leads counter when the tab regains focus (a submission may have happened).
  useEffect(() => {
    const onFocus = () => setStats((s) => ({ ...s, leads: loadStats().leads }));
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return { org, events, approvals, states, running, finished, stats, copy, published, start, decide };
}
