import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { getDiscoveryService } from "./discoveryService";
import type { Challenge, Industry, PrototypeSpec, SolutionDiscovery } from "./types";
import { emptyDiscovery } from "./types";
import { PrototypeShell } from "./PrototypeShell";
import { PlanComparison } from "./PlanComparison";
import { LeadForm } from "./LeadForm";
import type { PlanId } from "./plans";
import "./BuildPage.css";

type Stage = "industry" | "challenge" | "stakeholders" | "outcomes" | "processing" | "blueprint" | "prototype" | "plans" | "lead";
const svc = getDiscoveryService();
const KEY = "xappx_discovery";
const PROC = ["Understanding your challenge", "Mapping the workflow", "Identifying automation", "Designing the solution", "Creating your blueprint"];
const PROTO_PROC = ["Reading your blueprint", "Assembling the interface", "Wiring the sample workflow", "Loading representative data", "Preparing your prototype"];

function load(): SolutionDiscovery {
  try { const s = sessionStorage.getItem(KEY); if (s) return { ...emptyDiscovery, ...JSON.parse(s) }; } catch { /* ignore */ }
  return emptyDiscovery;
}
function validText(s: string) {
  const t = s.trim();
  return t.length >= 10 && /[a-zA-Z]/.test(t) && /\s/.test(t) && !/(.)\1{5,}/.test(t);
}

export function BuildPage() {
  const reduce = useReducedMotion();
  const [d, setD] = useState<SolutionDiscovery>(load);
  const [stage, setStage] = useState<Stage>(() => (load().industry ? "challenge" : "industry"));
  const [industries] = useState<Industry[]>(() => svc.getIndustries());
  const [search, setSearch] = useState("");
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [roles, setRoles] = useState<string[] | null>(null);
  const [outcomeOpts, setOutcomeOpts] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [customOn, setCustomOn] = useState(false);
  const [proc, setProc] = useState(0);
  const [procLabels, setProcLabels] = useState<readonly string[]>(PROC);
  const [proto, setProto] = useState<PrototypeSpec | null>(null);
  const [chosenPlan, setChosenPlan] = useState<PlanId>("standard");
  const started = useRef(false);

  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ } }, [d]);

  // deep link ?industry=slug (brief §49)
  useEffect(() => {
    if (started.current) return; started.current = true;
    const slug = new URLSearchParams(window.location.search).get("industry");
    if (slug && !d.industry) {
      const found = svc.getIndustries().find((i) => i.slug === slug);
      if (found) pickIndustry(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run<T>(p: Promise<T>, set: (v: T) => void) {
    setLoading(true); setErr(null);
    try { set(await p); } catch { setErr("We couldn't generate recommendations right now."); }
    finally { setLoading(false); }
  }

  function pickIndustry(i: Industry) {
    setD({ ...emptyDiscovery, industry: i });
    setChallenges(null); setRoles(null); setOutcomeOpts(null); setCustom(""); setCustomOn(false);
    setStage("challenge");
    void run(svc.getChallenges(i.slug), setChallenges);
  }
  function pickChallenge(label: string, isCustom: boolean) {
    setD((p) => ({ ...p, challenge: label, challengeCustom: isCustom, stakeholders: [], outcomes: [] }));
    setRoles(null);
    setStage("stakeholders");
    void run(svc.getStakeholders(d.industry!.slug, label), setRoles);
  }
  function toggle(list: string[], v: string) { return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]; }
  function confirmStakeholders() {
    setOutcomeOpts(null);
    setStage("outcomes");
    void run(svc.getOutcomes(d.industry!.slug, d.challenge!), setOutcomeOpts);
  }
  function confirmOutcomes() {
    setProcLabels(PROC); setStage("processing"); setProc(0);
    const iv = window.setInterval(() => setProc((n) => Math.min(n + 1, PROC.length - 1)), reduce ? 200 : 850);
    svc.generateBlueprint({ ...d }).then((bp) => {
      window.clearInterval(iv);
      setD((p) => ({ ...p, blueprint: bp }));
      window.setTimeout(() => setStage("blueprint"), reduce ? 0 : 400);
    }).catch(() => { window.clearInterval(iv); setErr("Generation failed. Please try again."); setStage("outcomes"); });
  }
  function generatePrototype() {
    setProcLabels(PROTO_PROC); setStage("processing"); setProc(0);
    const iv = window.setInterval(() => setProc((n) => Math.min(n + 1, PROTO_PROC.length - 1)), reduce ? 200 : 850);
    svc.generatePrototype({ ...d }).then((sp) => {
      window.clearInterval(iv); setProto(sp);
      window.setTimeout(() => setStage("prototype"), reduce ? 0 : 400);
    }).catch(() => { window.clearInterval(iv); setErr("Prototype generation failed."); setStage("blueprint"); });
  }
  function restart() {
    setD(emptyDiscovery); setStage("industry"); setSearch(""); setCustom(""); setCustomOn(false);
    setChallenges(null); setRoles(null); setOutcomeOpts(null); setErr(null); setProto(null);
  }

  const filtered = useMemo(
    () => industries.filter((i) => i.label.toLowerCase().includes(search.trim().toLowerCase())),
    [industries, search],
  );
  const stepNo = { industry: 1, challenge: 2, stakeholders: 3, outcomes: 4, processing: 4, blueprint: 5, prototype: 5, plans: 5, lead: 5 }[stage];

  return (
    <div className="build">
      <header className="build__top">
        <a className="build__logo" href="/">X<span>APP</span>X</a>
        <span className="build__step">Step {stepNo} of 5</span>
        <a className="build__exit" href="/">Exit</a>
      </header>

      <div className="build__wrap">
        {/* accumulating context (brief §35) */}
        <aside className="build__ctx" aria-label="Your answers so far">
          <CtxRow n="01" label="Industry" value={d.industry?.label} onEdit={() => setStage("industry")} active={stage === "industry"} />
          <CtxRow n="02" label="Challenge" value={d.challenge} onEdit={d.industry ? () => setStage("challenge") : undefined} active={stage === "challenge"} />
          <CtxRow n="03" label="Users" value={d.stakeholders.join(", ")} onEdit={d.challenge ? () => setStage("stakeholders") : undefined} active={stage === "stakeholders"} />
          <CtxRow n="04" label="Outcomes" value={d.outcomes.join(", ")} onEdit={d.stakeholders.length ? () => setStage("outcomes") : undefined} active={stage === "outcomes"} />
          <CtxRow n="05" label="Blueprint" value={proto ? "Prototype ready" : d.blueprint ? "Ready" : undefined} active={stage === "blueprint" || stage === "processing" || stage === "prototype"} />
        </aside>

        <main className="build__main">
          <AnimatePresence mode="wait">
            <motion.section
              key={stage}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: reduce ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }}
              className={"build__panel" + (stage === "prototype" || stage === "plans" || stage === "lead" ? " build__panel--wide" : "")}
            >
              {stage === "industry" && (
                <>
                  <h1 className="build__q">What industry are you in?</h1>
                  <p className="build__sub">XAPPX loads what it already knows about your world.</p>
                  <input className="build__search" placeholder="Search industries…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
                  <div className="build__grid">
                    {filtered.map((i) => (
                      <button key={i.slug} className={"opt" + (d.industry?.slug === i.slug ? " opt--on" : "")} onClick={() => pickIndustry(i)}>
                        {i.label}
                      </button>
                    ))}
                    {filtered.length === 0 && <p className="build__empty text-dim">No match — describe your business to XAPPY instead.</p>}
                  </div>
                </>
              )}

              {stage === "challenge" && (
                <>
                  <h1 className="build__q">What's the main challenge?</h1>
                  <p className="build__sub">Common problems in <b>{d.industry?.label}</b> — pick one, or describe your own.</p>
                  {loading && <Skeleton label={`Finding the top problems in ${d.industry?.label}…`} />}
                  {err && <Retry msg={err} onRetry={() => run(svc.getChallenges(d.industry!.slug), setChallenges)} />}
                  {!loading && challenges && (
                    <div className="build__chips">
                      {challenges.map((c) => (
                        <button key={c.id} className="chip" onClick={() => pickChallenge(c.label, false)}>{c.label}</button>
                      ))}
                      <button className={"chip chip--other" + (customOn ? " chip--on" : "")} onClick={() => setCustomOn((v) => !v)}>Something else</button>
                    </div>
                  )}
                  {customOn && (
                    <div className="build__custom">
                      <textarea placeholder="In a sentence, what isn't working?" value={custom} onChange={(e) => setCustom(e.target.value)} />
                      {custom.length > 0 && !validText(custom) && (
                        <p className="build__warn">That doesn't look like enough for XAPPX to work with. Try a short sentence describing the issue.</p>
                      )}
                      <button className="btn btn-primary" disabled={!validText(custom)} onClick={() => pickChallenge(custom.trim(), true)}>Continue</button>
                    </div>
                  )}
                </>
              )}

              {stage === "stakeholders" && (
                <>
                  <h1 className="build__q">Who does this affect?</h1>
                  <p className="build__sub">Based on your industry and challenge, we identified these likely users. Select the ones that fit.</p>
                  {loading && <Skeleton label="Finding the people involved in this workflow…" />}
                  {!loading && roles && (
                    <>
                      <div className="build__chips">
                        {roles.map((r) => (
                          <button key={r} className={"chip" + (d.stakeholders.includes(r) ? " chip--on" : "")} onClick={() => setD((p) => ({ ...p, stakeholders: toggle(p.stakeholders, r) }))}>{r}</button>
                        ))}
                      </div>
                      <div className="build__nav">
                        <button className="btn btn-ghost" onClick={() => setStage("challenge")}>← Back</button>
                        <button className="btn btn-primary" disabled={!d.stakeholders.length} onClick={confirmStakeholders}>Continue →</button>
                      </div>
                    </>
                  )}
                </>
              )}

              {stage === "outcomes" && (
                <>
                  <h1 className="build__q">What should success look like?</h1>
                  <p className="build__sub">The outcomes that matter most for <b>{d.challenge}</b>. Pick any.</p>
                  {loading && <Skeleton label="Mapping the outcomes that matter…" />}
                  {!loading && outcomeOpts && (
                    <>
                      <div className="build__chips">
                        {outcomeOpts.map((o) => (
                          <button key={o} className={"chip" + (d.outcomes.includes(o) ? " chip--on" : "")} onClick={() => setD((p) => ({ ...p, outcomes: toggle(p.outcomes, o) }))}>{o}</button>
                        ))}
                      </div>
                      <div className="build__nav">
                        <button className="btn btn-ghost" onClick={() => setStage("stakeholders")}>← Back</button>
                        <button className="btn btn-primary" disabled={!d.outcomes.length} onClick={confirmOutcomes}>Design my solution →</button>
                      </div>
                    </>
                  )}
                </>
              )}

              {stage === "processing" && (
                <div className="build__proc" role="status" aria-live="polite">
                  <div className="build__spinner" aria-hidden="true"><span /><span /><span /></div>
                  <ol className="build__proclist">
                    {procLabels.map((s, i) => (
                      <li key={s} className={i === proc ? "on" : i < proc ? "done" : ""}><span className="build__pdot" />{s}</li>
                    ))}
                  </ol>
                </div>
              )}

              {stage === "blueprint" && d.blueprint && (
                <Blueprint d={d} onRestart={restart} onGenerate={generatePrototype} />
              )}

              {stage === "prototype" && proto && (
                <PrototypeShell spec={proto} onBack={() => setStage("blueprint")} onRestart={restart} onUnlock={() => setStage("plans")} />
              )}

              {stage === "plans" && (
                <PlanComparison d={d} onBack={() => setStage(proto ? "prototype" : "blueprint")} onChoose={(id) => { setChosenPlan(id); setStage("lead"); }} />
              )}

              {stage === "lead" && (
                <LeadForm d={d} plan={chosenPlan} onBack={() => setStage("plans")} onRestart={restart} />
              )}
            </motion.section>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function CtxRow({ n, label, value, onEdit, active }: { n: string; label: string; value?: string | null; onEdit?: () => void; active?: boolean }) {
  return (
    <div className={"ctx" + (active ? " ctx--active" : "") + (value ? " ctx--done" : "")}>
      <span className="ctx__n">{n}</span>
      <div className="ctx__body">
        <div className="ctx__label">{label}</div>
        <div className="ctx__value">{value || <span className="ctx__pending">—</span>}</div>
      </div>
      {onEdit && value && <button className="ctx__edit" onClick={onEdit} aria-label={`Edit ${label}`}>edit</button>}
    </div>
  );
}

function Skeleton({ label }: { label: string }) {
  return (
    <div className="build__skel" role="status" aria-live="polite">
      <p className="build__skel-label">{label}</p>
      <div className="build__skel-row"><i /><i /><i /></div>
      <div className="build__skel-row"><i /><i /></div>
    </div>
  );
}
function Retry({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="build__retry">
      <p>{msg}</p>
      <button className="btn btn-ghost" onClick={onRetry}>Try again</button>
    </div>
  );
}

function Blueprint({ d, onRestart, onGenerate }: { d: SolutionDiscovery; onRestart: () => void; onGenerate: () => void }) {
  const bp = d.blueprint!;
  return (
    <div className="bp">
      <p className="eyebrow">Your solution blueprint</p>
      <h1 className="build__q">{bp.solutionName}</h1>
      <p className="bp__understood">{bp.understood}</p>

      <div className="bp__cols">
        <div className="bp__card">
          <h3>Who it's for</h3>
          <ul>{bp.users.map((u) => <li key={u}>{u}</li>)}</ul>
        </div>
        <div className="bp__card">
          <h3>Core workflow</h3>
          <ol className="bp__flow">{bp.workflow.map((w) => <li key={w}>{w}</li>)}</ol>
        </div>
        <div className="bp__card">
          <h3>Where AI helps</h3>
          <ul>{bp.aiOpportunities.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      </div>

      {d.outcomes.length > 0 && (
        <div className="bp__outcomes">
          <span className="bp__outcomes-label">Success looks like</span>
          {d.outcomes.map((o) => <span className="chip chip--static" key={o}>{o}</span>)}
        </div>
      )}

      <div className="bp__cta">
        <button className="btn btn-primary" onClick={onGenerate}>Generate my prototype →</button>
        <button className="btn btn-ghost" onClick={onRestart}>Start over</button>
      </div>
      <p className="bp__note">Next: XAPPX generates an interactive prototype from this blueprint — a working preview you can click through. Our experts then take it to production.</p>
    </div>
  );
}
