import { useState } from "react";
import type { PrototypeItem, PrototypeSpec } from "./types";
import "./PrototypeShell.css";

/* Interactive prototype (brief §25-27): a real-feeling product shell with
   clearly-labeled sample data. Dashboard + the primary workflow are usable;
   advanced features are locked — the natural bridge to the commercial step. */

export function PrototypeShell({ spec, onBack, onRestart }: { spec: PrototypeSpec; onBack: () => void; onRestart: () => void }) {
  const [active, setActive] = useState("dashboard");
  const [selected, setSelected] = useState<PrototypeItem | null>(null);
  const [aiState, setAiState] = useState<"idle" | "running" | "done">("idle");
  const activeNav = spec.nav.find((n) => n.id === active);

  function openItem(it: PrototypeItem) { setSelected(it); setAiState("idle"); }
  function runAI() { setAiState("running"); window.setTimeout(() => setAiState("done"), 1100); }

  return (
    <div className="ps">
      <div className="ps__bar">
        <span className="ps__dots"><i /><i /><i /></span>
        <span className="ps__url">app.xappx.io/{spec.appName.toLowerCase().replace(/\s+/g, "-")}</span>
        <span className="ps__badge">Prototype · sample data</span>
      </div>

      <div className="ps__body">
        <nav className="ps__side">
          <div className="ps__app">{spec.appName}</div>
          {spec.nav.map((n) => (
            <button
              key={n.id}
              className={"ps__nav" + (n.id === active ? " ps__nav--on" : "") + (n.locked ? " ps__nav--locked" : "")}
              onClick={() => { setActive(n.id); setSelected(null); }}
            >
              {n.label}{n.locked && <span className="ps__lock" aria-label="locked">🔒</span>}
            </button>
          ))}
        </nav>

        <main className="ps__main">
          {activeNav?.locked ? (
            <LockedView label={activeNav.label} />
          ) : active === "dashboard" ? (
            <Dashboard spec={spec} onOpen={(it) => { setActive("queue"); openItem(it); }} />
          ) : (
            <Queue spec={spec} selected={selected} onOpen={openItem} aiState={aiState} onRunAI={runAI} onClose={() => setSelected(null)} />
          )}
        </main>
      </div>

      <div className="ps__foot">
        <p>This is a working preview built from your blueprint — real screens, sample data. The full solution is engineered and deployed by XAPPX experts.</p>
        <div className="ps__foot-cta">
          <button className="btn btn-ghost" onClick={onBack}>← Blueprint</button>
          <button className="btn btn-ghost" onClick={onRestart}>Start over</button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ spec, onOpen }: { spec: PrototypeSpec; onOpen: (it: PrototypeItem) => void }) {
  const bars = [42, 58, 51, 67, 73, 61, 80];
  return (
    <div className="ps__view">
      <h2 className="ps__h2">Dashboard</h2>
      <div className="ps__stats">
        {spec.stats.map((s) => (
          <div className="ps__stat" key={s.label}>
            <div className="ps__stat-v">{s.value}</div>
            <div className="ps__stat-l">{s.label}</div>
            {s.hint && <div className="ps__stat-h">{s.hint}</div>}
          </div>
        ))}
      </div>
      <div className="ps__panels">
        <div className="ps__panel">
          <div className="ps__panel-h">Throughput · last 7 days</div>
          <div className="ps__chart" role="img" aria-label="Sample throughput chart">
            {bars.map((b, i) => <span key={i} style={{ height: `${b}%` }} />)}
          </div>
        </div>
        <div className="ps__panel">
          <div className="ps__panel-h">Needs your review</div>
          <ul className="ps__recent">
            {spec.items.slice(0, 4).map((it) => (
              <li key={it.id}><button onClick={() => onOpen(it)}><span>{it.title}</span><em className={"ps__st ps__st--" + it.status.replace(/\s+/g, "").toLowerCase()}>{it.status}</em></button></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Queue({ spec, selected, onOpen, aiState, onRunAI, onClose }: {
  spec: PrototypeSpec; selected: PrototypeItem | null; onOpen: (it: PrototypeItem) => void;
  aiState: "idle" | "running" | "done"; onRunAI: () => void; onClose: () => void;
}) {
  return (
    <div className="ps__view">
      <h2 className="ps__h2">{spec.workflowLabel}</h2>
      <div className="ps__table" role="table">
        <div className="ps__tr ps__tr--head" role="row"><span>Item</span><span>Assignee</span><span>Priority</span><span>Status</span></div>
        {spec.items.map((it) => (
          <button className={"ps__tr" + (selected?.id === it.id ? " ps__tr--on" : "")} key={it.id} onClick={() => onOpen(it)} role="row">
            <span className="ps__cell-title">{it.title}</span>
            <span>{it.assignee}</span>
            <span className={"ps__prio ps__prio--" + it.priority.toLowerCase()}>{it.priority}</span>
            <span><em className={"ps__st ps__st--" + it.status.replace(/\s+/g, "").toLowerCase()}>{it.status}</em></span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="ps__drawer">
          <div className="ps__drawer-h">
            <div><div className="ps__drawer-t">{selected.title}</div><div className="ps__drawer-m">Assigned to {selected.assignee} · {selected.priority} priority</div></div>
            <button className="ps__x" onClick={onClose} aria-label="Close">✕</button>
          </div>
          {aiState === "idle" && (
            <button className="btn btn-primary" onClick={onRunAI}>{spec.aiActionLabel} →</button>
          )}
          {aiState === "running" && <div className="ps__thinking"><span /><span /><span /> XAPPY is reviewing…</div>}
          {aiState === "done" && (
            <div className="ps__ai">
              <p className="ps__ai-sum">{spec.aiResult.summary}</p>
              <ul className="ps__ai-flags">
                {spec.aiResult.flags.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <p className="ps__ai-rec"><b>{spec.aiResult.recommendation}</b></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LockedView({ label }: { label: string }) {
  return (
    <div className="ps__locked">
      <div className="ps__locked-badge">🔒</div>
      <h2 className="ps__h2">{label} is part of your full build</h2>
      <p className="ps__locked-p">
        This preview shows the core experience. {label}, deeper integrations, automation and production
        controls are engineered with you in the full XAPPX solution.
      </p>
      <a className="btn btn-primary" href="#pricing" onClick={(e) => e.preventDefault()}>See what the full build includes →</a>
      <p className="ps__locked-note">Pricing &amp; packages are coming online next.</p>
    </div>
  );
}
