import { useEffect, useRef, useState } from "react";
import type { AppSpec } from "../build/appSpec";
import type { SolutionDiscovery } from "../build/types";
import { AGENT_ORDER, type AgentRole } from "../agents/agentOrg";
import { useAgentRun, type ApprovalItem } from "../agents/useAgentRun";
import { speak, speechOutputSupported, stopSpeaking } from "../lib/useSpeech";
import "./CommandCenter.css";

/**
 * The XAPPY Command Center: the screen after the guided flow where the client's
 * Agent Organization works in the open. Left: live stats. Centre: the core and
 * the roster. Right: the activity log and the approval queue. Everything on
 * screen is driven by the agent event stream (useAgentRun); when nothing runs,
 * the core is dim and the log says so.
 */
export function CommandCenter({ d, spec, onOpenPrototype, onMakeReal, onBack, onRestart }: {
  d: SolutionDiscovery; spec: AppSpec;
  onOpenPrototype: () => void; onMakeReal: (draft: string) => void; onBack: () => void; onRestart: () => void;
}) {
  const [voice, setVoice] = useState(false);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const run = useAgentRun(d, spec, { speak: (t) => { if (voiceRef.current) speak(t); } });
  const logRef = useRef<HTMLOListElement>(null);

  useEffect(() => { void run.start(); }, [run.start]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [run.events.length]);
  useEffect(() => () => stopSpeaking(), []);

  const pending = run.approvals.filter((a) => a.status === "pending");
  const status = run.running ? "Agents working" : pending.length ? `${pending.length} awaiting your approval` : run.finished ? "Idle. All decisions made." : "Idle";

  function approve(item: ApprovalItem, body?: string) {
    run.decide(item.id, "approved", body);
    if (item.kind === "request") onMakeReal(body ?? item.body);
  }

  return (
    <div className={"cc" + (run.running ? " cc--running" : "")}>
      <header className="cc__head">
        <div>
          <p className="eyebrow">XAPPY Command Center</p>
          <h1 className="cc__title">{run.copy?.headline ?? spec.name}</h1>
          <p className="cc__sub">{run.copy?.subhead ?? `${spec.industry} · ${spec.challenge}`}</p>
        </div>
        <div className="cc__status">
          <span className={"cc__pill" + (run.running ? " cc__pill--live" : pending.length ? " cc__pill--wait" : "")}>{status}</span>
          {speechOutputSupported() && (
            <button type="button" className={"cc__voice" + (voice ? " is-on" : "")} onClick={() => { setVoice((v) => !v); if (voice) stopSpeaking(); }} aria-pressed={voice}>
              {voice ? "Voice on" : "Read aloud"}
            </button>
          )}
        </div>
      </header>

      <div className="cc__grid">
        <aside className="cc__stats" aria-label="Live stats">
          <Stat label="Problems analysed" value={run.stats.problems} />
          <Stat label="Blueprints produced" value={run.stats.blueprints} />
          <Stat label="Prototypes published" value={run.stats.prototypes} />
          <Stat label="Hours a week automated" value={run.stats.hoursSaved} hint="estimate" />
          <Stat label="Build requests sent" value={run.stats.leads} />
          <p className="cc__statnote">Counted on this device from real agent runs. Client-wide totals arrive with sign-in.</p>
        </aside>

        <section className="cc__core" aria-label="Agent organization">
          <div className="cc__orb" aria-hidden="true"><i /><i /><i /></div>
          <p className="cc__corestate">{run.running ? "The organization is working." : run.finished ? "Standing by. Decisions are yours." : "No agents running."}</p>
          <ul className="cc__roster">
            {AGENT_ORDER.map((role) => {
              const a = run.org.agents.find((x) => x.role === role)!;
              const s = run.states[role];
              return (
                <li key={role} className={`cc__agent cc__agent--${s}`}>
                  <span className="cc__agentdot" aria-hidden="true" />
                  <div>
                    <div className="cc__agentname">{a.name} <small>{s === "working" ? "working" : s === "done" ? "done" : s === "error" ? "error" : "idle"}</small></div>
                    <div className="cc__agentjob">{a.job}</div>
                    <div className="cc__agentmeta">Tools: {a.tools.join(", ")} · Budget: {a.budget.steps} steps · {a.approval === "human" ? "Needs your approval" : "No approval needed"}</div>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="cc__vault">Memory folder in the Twin Vault: <code>{run.org.vaultFolder}</code> <span className="text-dim">(created when client sign-in ships)</span></p>
        </section>

        <section className="cc__right">
          <div className="cc__log">
            <h2>Activity</h2>
            <ol ref={logRef} aria-live="polite">
              {run.events.length === 0 && <li className="cc__ev cc__ev--idle"><span className="cc__t">--:--:--</span><span>No agents running yet.</span></li>}
              {run.events.map((e) => (
                <li key={e.id} className={`cc__ev cc__ev--${e.kind}`}>
                  <span className="cc__t">{new Date(e.at).toLocaleTimeString([], { hour12: false })}</span>
                  <span className={`cc__who cc__who--${e.agent}`}>{agentLabel(e.agent)}</span>
                  <span className="cc__msg">{e.text}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="cc__queue">
            <h2>Approval queue <span className="cc__count">{pending.length}</span></h2>
            {run.approvals.length === 0 && <p className="cc__empty">Nothing waiting. Anything that leaves the system shows up here first.</p>}
            {run.approvals.map((item) => (
              <Approval key={item.id} item={item} onApprove={(body) => approve(item, body)} onReject={() => run.decide(item.id, "rejected")} onOpen={item.kind === "prototype" && run.published ? onOpenPrototype : undefined} />
            ))}
          </div>
        </section>
      </div>

      <footer className="cc__foot">
        <button className="btn btn-primary" onClick={() => onMakeReal(run.approvals.find((a) => a.kind === "request")?.body ?? "")}>{run.copy?.cta ?? "Make it real"} →</button>
        <button className="btn btn-ghost" onClick={onOpenPrototype}>Open the prototype</button>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn btn-ghost" onClick={onRestart}>Start over</button>
      </footer>
    </div>
  );
}

function agentLabel(a: AgentRole | "xappy") {
  return { director: "Director", research: "Research", build: "Build", content: "Content", outreach: "Outreach", xappy: "You" }[a];
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="cc__stat">
      <div className="cc__statval">{value.toLocaleString()}</div>
      <div className="cc__statlbl">{label}{hint && <span> · {hint}</span>}</div>
    </div>
  );
}

function Approval({ item, onApprove, onReject, onOpen }: { item: ApprovalItem; onApprove: (body?: string) => void; onReject: () => void; onOpen?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(item.body);
  const decided = item.status !== "pending";
  return (
    <article className={`cc__item cc__item--${item.status}`}>
      <div className="cc__itemhead">
        <span className={`cc__who cc__who--${item.agent}`}>{agentLabel(item.agent)}</span>
        <strong>{item.title}</strong>
        <span className="cc__itemstate">{item.status === "pending" ? "waiting" : item.status}</span>
      </div>
      {editing ? (
        <textarea className="cc__edit" value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
      ) : (
        <pre className="cc__body">{item.body}</pre>
      )}
      {!decided && (
        <div className="cc__actions">
          <button className="btn btn-primary cc__btn" onClick={() => { onApprove(editing ? body : undefined); setEditing(false); }}>{editing ? "Approve edits" : "Approve"}</button>
          <button className="btn btn-ghost cc__btn" onClick={() => setEditing((v) => !v)}>{editing ? "Cancel edit" : "Edit"}</button>
          <button className="btn btn-ghost cc__btn cc__btn--reject" onClick={onReject}>Reject</button>
        </div>
      )}
      {decided && onOpen && <button className="btn btn-ghost cc__btn" onClick={onOpen}>Open the published prototype →</button>}
    </article>
  );
}
