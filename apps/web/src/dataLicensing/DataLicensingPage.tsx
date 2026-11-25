import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Nav } from "../components/Nav";
import { Logo } from "../components/Logo";
import {
  estimate, formatUsd, clampInt, RULES, HOME_LIMITS, QUALIFY_LIMITS, HOME_INDUSTRIES, QUALIFY_INDUSTRIES,
  type EstimateInputs, type HomeIndustry, type QualifyIndustry,
} from "./calculator";
import { BENEFITS, PROCESS, CATEGORIES, FAQ, CONTACT_EMAIL, NOTICE_VERSION } from "./data";
import { Field, NumberSlider, Radios, Text } from "./fields";
import { IntakeForm } from "./IntakeForm";
import { emptyIntake, toPayload, validateSubmit, type Intake as IntakeModel } from "./intake";
import "./DataLicensingPage.css";

/**
 * /data-licensing: one page, four in-page states (landing, qualify, estimate,
 * intake) addressed by the URL hash. Anonymous estimator answers live in
 * session storage; everything with contact details lives in memory only.
 */
type View = "landing" | "qualify" | "estimate" | "intake";
const VIEW_HASH: Record<View, string> = { landing: "", qualify: "#qualify", estimate: "#estimate", intake: "#intake" };

interface Calc extends EstimateInputs {}
interface Qualify { industry: QualifyIndustry | ""; us: "" | "yes" | "no"; desk: string; years: string; rights: "" | "yes" | "partly" | "no"; done: boolean }

const CALC_KEY = "xappx_dl_calc", QUAL_KEY = "xappx_dl_qualify", EST_KEY = "xappx_dl_estimate";
const DEFAULT_CALC: Calc = { industry: "small_business", desk: HOME_LIMITS.desk.default, nonDesk: HOME_LIMITS.nonDesk.default, years: HOME_LIMITS.years.default };
const DEFAULT_QUALIFY: Qualify = { industry: "", us: "", desk: "", years: "", rights: "", done: false };

function loadSession<T>(key: string, fallback: T): T {
  try { const s = sessionStorage.getItem(key); return s ? { ...fallback, ...JSON.parse(s) } : fallback; } catch { return fallback; }
}
function saveSession(key: string, v: unknown) { try { sessionStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } }
function viewFromHash(h: string): View | "calc" {
  const x = h.replace(/^#/, "");
  if (x === "qualify" || x === "estimate" || x === "intake") return x;
  if (x === "calc") return "calc";
  return "landing";
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

export function DataLicensingPage({ preview = false }: { preview?: boolean }) {
  const [calc, setCalc] = useState<Calc>(() => loadSession(CALC_KEY, DEFAULT_CALC));
  const [qualify, setQualify] = useState<Qualify>(() => loadSession(QUAL_KEY, DEFAULT_QUALIFY));
  const [est, setEst] = useState<(EstimateInputs & { seen: boolean }) | null>(() => loadSession(EST_KEY, null as (EstimateInputs & { seen: boolean }) | null));
  const [intake, setIntake] = useState<IntakeModel>(emptyIntake);
  const [intakeStep, setIntakeStep] = useState<1 | 2 | 3>(1);
  const [submissionId] = useState(uid);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ recordId: string } | null>(null);
  const [view, setView] = useState<View>(() => "landing");
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => saveSession(CALC_KEY, calc), [calc]);
  useEffect(() => saveSession(QUAL_KEY, qualify), [qualify]);
  useEffect(() => { if (est) saveSession(EST_KEY, est); }, [est]);

  // Prerequisites: estimate needs a completed qualifier; intake needs a seen estimate.
  const allowed = useCallback((v: View | "calc"): View => {
    if (v === "calc") return "landing";
    if (v === "estimate" && !qualify.done) return "qualify";
    if (v === "intake" && !(qualify.done && est?.seen)) return qualify.done ? "estimate" : "qualify";
    return v;
  }, [qualify.done, est?.seen]);

  // Hash ↔ view. Direct entry without prerequisites is redirected to the step before.
  useEffect(() => {
    const apply = () => {
      const wanted = viewFromHash(window.location.hash);
      const ok = allowed(wanted);
      if (ok !== wanted && wanted !== "calc") window.history.replaceState(null, "", window.location.pathname + VIEW_HASH[ok]);
      setView(ok);
      if (wanted === "calc") window.setTimeout(() => document.getElementById("calc")?.scrollIntoView({ block: "start" }), 30);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [allowed]);

  useEffect(() => {
    document.title = "XAPPX · Data Licensing";
    if (preview) {
      const m = document.createElement("meta"); m.name = "robots"; m.content = "noindex, nofollow"; document.head.appendChild(m);
      return () => { m.remove(); };
    }
    return undefined;
  }, [preview]);

  // Move keyboard focus to the new view's heading and scroll to top.
  useEffect(() => {
    if (view === "landing") return;
    window.scrollTo({ top: 0 });
    headingRef.current?.focus();
  }, [view]);

  const go = (v: View) => { window.location.hash = VIEW_HASH[v] || "#"; if (v === "landing") window.history.replaceState(null, "", window.location.pathname); setView(allowed(v)); };

  function finishQualify() {
    const q = QUALIFY_INDUSTRIES.find((x) => x.id === qualify.industry);
    const next = { ...qualify, done: true };
    setQualify(next);
    saveSession(QUAL_KEY, next);
    // Carry industry, desk count and years forward; non-desk starts at 0 (as audited).
    setEst({
      industry: q?.home ?? "other",
      desk: clampInt(Number(qualify.desk), HOME_LIMITS.desk.min, HOME_LIMITS.desk.max),
      nonDesk: 0,
      years: clampInt(Number(qualify.years), HOME_LIMITS.years.min, HOME_LIMITS.years.max),
      seen: true,
    });
    window.location.hash = "#estimate";
  }

  async function submitIntake() {
    const errors = validateSubmit(intake);
    if (Object.keys(errors).length) return errors;
    setSending(true); setSendError(null);
    try {
      const payload = toPayload(intake, submissionId, {
        estimateIndustry: est?.industry ?? "", estimateDesk: est?.desk ?? 0, estimateNonDesk: est?.nonDesk ?? 0, estimateYears: est?.years ?? 0,
        rightsAnswer: qualify.rights, noticeVersion: NOTICE_VERSION,
      });
      const ctrl = new AbortController();
      const t = window.setTimeout(() => ctrl.abort(), 20000);
      const r = await fetch("/.netlify/functions/data-licensing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: ctrl.signal });
      window.clearTimeout(t);
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; recordId?: string; error?: string; retry?: boolean };
      if (r.ok && j.ok && j.recordId) { setReceipt({ recordId: j.recordId }); }
      else setSendError(j.retry === false ? "We couldn't accept this inquiry. Please check the highlighted fields." : "We couldn't save your inquiry just now. Nothing was lost; please try again in a moment.");
    } catch {
      setSendError("We couldn't reach XAPPX just now. Nothing was lost; please try again in a moment.");
    } finally {
      setSending(false);
    }
    return {};
  }

  const homeRange = useMemo(() => estimate(calc), [calc]);

  return (
    <>
      <Nav />
      {preview && (
        <div className="dl-preview" role="status">
          Private preview for XAPPX review. The estimate rules are pending owner approval, so dollar ranges are not shown yet.
        </div>
      )}
      <main className="dl">
        {view === "landing" && (
          <Landing calc={calc} setCalc={setCalc} range={homeRange} onStart={() => go("qualify")} />
        )}
        {view === "qualify" && (
          <QualifyView q={qualify} setQ={setQualify} onBack={() => go("landing")} onNext={finishQualify} headingRef={headingRef} />
        )}
        {view === "estimate" && est && (
          <EstimateView est={est} setEst={(e) => setEst({ ...e, seen: true })} rights={qualify.rights} onBack={() => go("qualify")} onNext={() => go("intake")} headingRef={headingRef} />
        )}
        {view === "intake" && (
          <IntakeForm
            intake={intake} setIntake={setIntake} step={intakeStep} setStep={setIntakeStep}
            onSubmit={submitIntake} sending={sending} sendError={sendError} receipt={receipt}
            onBack={() => go("estimate")} headingRef={headingRef}
          />
        )}
      </main>
      <footer className="dl-footer">
        <div className="container dl-footer__in">
          <a href="/" aria-label="XAPPX home"><Logo height={44} /></a>
          <nav className="dl-footer__links" aria-label="Footer">
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            <a href="/privacy.html">Privacy</a>
            <a href="/terms.html">Terms</a>
          </nav>
          <p className="dl-footer__note">The initial inquiry does not collect raw records, passwords or customer identifiers. US businesses only. Nonbinding.</p>
          <p className="dl-footer__legal">© {new Date().getFullYear()} XAPPX Inc. · Las Vegas, Nevada · Notice v{NOTICE_VERSION}</p>
        </div>
      </footer>
    </>
  );
}

/* ---------------- 01 Landing ---------------- */

function Landing({ calc, setCalc, range, onStart }: { calc: Calc; setCalc: (c: Calc) => void; range: ReturnType<typeof estimate>; onStart: () => void }) {
  const [open, setOpen] = useState(0);
  return (
    <>
      <section className="dl-hero">
        <div className="container dl-hero__in">
          <div>
            <p className="eyebrow">Why business data matters.</p>
            <h1 className="dl-hero__title">Your business already creates data AI can learn from.</h1>
            <p className="lede dl-hero__lede">
              Historical business records show how real teams communicate, make decisions and serve customers. XAPPX helps businesses explore whether a qualifying copy of those records could be licensed.
            </p>
            <div className="dl-hero__cta">
              <button className="btn btn-primary" onClick={onStart}>See what my data could be worth</button>
              <a className="btn btn-ghost" href="#calc">Explore the estimate</a>
            </div>
          </div>
          <div className="dl-benefits">
            {BENEFITS.map((b) => (
              <div className="dl-card" key={b.title}><h3>{b.title}</h3><p>{b.body}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="dl-calc section" id="calc">
        <div className="container dl-calc__in">
          <div className="dl-calc__copy">
            <h2>What could your business data be worth?</h2>
            <p className="lede">Answer a few questions about your company to see an illustrative range. No files, account access or commitment required.</p>
            <p className="dl-trust">For US businesses • No raw data at this stage • Nonbinding.</p>
          </div>
          <div className="dl-estimator" aria-label="Illustrative estimate">
            <span className="dl-badge">Illustrative estimate</span>
            <h3>Estimate for your business</h3>
            <Radios name="home-industry" value={calc.industry} onChange={(v) => setCalc({ ...calc, industry: v as HomeIndustry })} options={HOME_INDUSTRIES} />
            <NumberSlider id="home-desk" label="Full-time desk employees" value={calc.desk} min={HOME_LIMITS.desk.min} max={HOME_LIMITS.desk.max} onChange={(v) => setCalc({ ...calc, desk: v })} />
            <NumberSlider id="home-nondesk" label="Non-desk employees" value={calc.nonDesk} min={HOME_LIMITS.nonDesk.min} max={HOME_LIMITS.nonDesk.max} onChange={(v) => setCalc({ ...calc, nonDesk: v })} />
            <NumberSlider id="home-years" label="Years of operating history" value={calc.years} min={HOME_LIMITS.years.min} max={HOME_LIMITS.years.max} onChange={(v) => setCalc({ ...calc, years: v })} suffix="yrs" />
            <RangeResult range={range} />
            <button className="btn btn-primary dl-estimator__cta" onClick={onStart}>Check your fit →</button>
            <p className="dl-estimator__note">No files. No logins. Nothing is sent until you choose to submit an inquiry.</p>
          </div>
        </div>
      </section>

      <section className="dl-process section">
        <div className="container">
          <h2>How it works</h2>
          <div className="dl-grid3">
            {PROCESS.map((p, i) => (
              <div className="dl-card" key={p.title}><span className="dl-card__n">0{i + 1}</span><h3>{p.title}</h3><p>{p.body}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="dl-categories section">
        <div className="container">
          <h2>What kinds of records might qualify?</h2>
          <div className="dl-tiles">{CATEGORIES.map((c) => <div className="dl-tile" key={c}>{c}</div>)}</div>
          <p className="dl-muted">You describe what exists. Nothing is uploaded and no account access is requested.</p>
        </div>
      </section>

      <section className="dl-faq section">
        <div className="container dl-faq__in">
          <h2>Questions, answered.</h2>
          <div className="dl-acc">
            {FAQ.map((f, i) => (
              <div className={"dl-acc__item" + (open === i ? " is-open" : "")} key={f.q}>
                <button className="dl-acc__q" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                  <span>{f.q}</span><span className="dl-acc__chev" aria-hidden="true">⌄</span>
                </button>
                {open === i && <p className="dl-acc__a">{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dl-close section">
        <div className="container dl-close__in">
          <h2>Ready to check your business's fit?</h2>
          <button className="btn btn-primary" onClick={onStart}>Get started</button>
        </div>
      </section>
    </>
  );
}

function RangeResult({ range }: { range: ReturnType<typeof estimate> }) {
  if (!RULES || !range) {
    return (
      <div className="dl-result dl-result--pending" aria-live="polite">
        <span className="dl-result__label">Illustrative range</span>
        <span className="dl-result__val">Pending</span>
        <span className="dl-result__note">The estimate rules are being finalized. Your answers are kept for this visit and the range appears here as soon as the rules are approved.</span>
      </div>
    );
  }
  return (
    <div className="dl-result" aria-live="polite">
      <span className="dl-result__label">Illustrative range</span>
      <span className="dl-result__val">{formatUsd(range.low)} – {formatUsd(range.high)}</span>
      <span className="dl-result__note">Rounded to the nearest $10K. Illustrative only; not an offer.</span>
    </div>
  );
}

/* ---------------- 02 Qualify ---------------- */

function QualifyView({ q, setQ, onBack, onNext, headingRef }: { q: Qualify; setQ: (q: Qualify) => void; onBack: () => void; onNext: () => void; headingRef: React.RefObject<HTMLHeadingElement> }) {
  const [tried, setTried] = useState(false);
  const errors: Record<string, string> = {};
  if (!q.industry) errors.industry = "Choose your primary industry.";
  if (q.us !== "yes") errors.us = q.us === "no" ? "This program is currently open to US businesses only." : "Confirm the business operates in the United States.";
  const desk = Number(q.desk), years = Number(q.years);
  if (!/^\d+$/.test(q.desk.trim())) errors.desk = "Enter a whole number.";
  else if (desk > QUALIFY_LIMITS.desk.max) errors.desk = `Up to ${QUALIFY_LIMITS.desk.max.toLocaleString()}.`;
  if (!/^\d+$/.test(q.years.trim())) errors.years = "Enter a whole number.";
  else if (years > QUALIFY_LIMITS.years.max) errors.years = `Up to ${QUALIFY_LIMITS.years.max}.`;
  if (!q.rights) errors.rights = "Choose the option that fits best.";
  const ok = Object.keys(errors).length === 0;
  const show = (k: string) => (tried ? errors[k] : undefined);

  return (
    <section className="dl-step section">
      <div className="container dl-step__in">
        <p className="eyebrow">Step 1 of 3 · Check initial fit</p>
        <h1 ref={headingRef} tabIndex={-1} className="dl-step__title">Five quick questions.</h1>
        <p className="lede">No contact details or account needed. Your answers stay on this device for this visit.</p>

        <form className="dl-form" onSubmit={(e) => { e.preventDefault(); setTried(true); if (ok) onNext(); }} noValidate>
          <Field label="Primary industry" error={show("industry")}>
            <Radios name="q-industry" value={q.industry} onChange={(v) => setQ({ ...q, industry: v as QualifyIndustry })} options={QUALIFY_INDUSTRIES} />
          </Field>
          <Field label="Country" error={show("us")} hint="United States only at launch.">
            <div className="dl-inline">
              <input className="dl-input dl-input--fixed" value="United States" readOnly aria-label="Country (fixed)" />
              <Radios name="q-us" value={q.us} onChange={(v) => setQ({ ...q, us: v as Qualify["us"] })} options={[{ id: "yes", label: "Yes, we operate in the US" }, { id: "no", label: "No" }]} />
            </div>
          </Field>
          <div className="dl-row2">
            <Field id="q-desk" label="Current full-time desk employees" error={show("desk")}>
              <Text id="q-desk" value={q.desk} onChange={(v) => setQ({ ...q, desk: v })} inputMode="numeric" placeholder="e.g. 30" maxLength={7} />
            </Field>
            <Field id="q-years" label="Years of operating history" error={show("years")}>
              <Text id="q-years" value={q.years} onChange={(v) => setQ({ ...q, years: v })} inputMode="numeric" placeholder="e.g. 5" maxLength={3} />
            </Field>
          </div>
          <Field label="Rights to license the business records" error={show("rights")} hint="Used to route the review, not as proof of authority.">
            <Radios name="q-rights" value={q.rights} onChange={(v) => setQ({ ...q, rights: v as Qualify["rights"] })} options={[
              { id: "yes", label: "Yes" },
              { id: "partly", label: "Partly or unsure" },
              { id: "no", label: "No, or held for clients / licensed from others" },
            ]} />
          </Field>
          <div className="dl-form__nav">
            <button type="button" className="btn btn-ghost" onClick={onBack}>← Back</button>
            <button type="submit" className="btn btn-primary">See my estimate →</button>
          </div>
        </form>
      </div>
    </section>
  );
}

/* ---------------- 03 Estimate ---------------- */

function EstimateView({ est, setEst, rights, onBack, onNext, headingRef }: { est: EstimateInputs; setEst: (e: EstimateInputs) => void; rights: Qualify["rights"]; onBack: () => void; onNext: () => void; headingRef: React.RefObject<HTMLHeadingElement> }) {
  const range = useMemo(() => estimate(est), [est]);
  const industryLabel = HOME_INDUSTRIES.find((i) => i.id === est.industry)?.label ?? "Other";
  return (
    <section className="dl-step section">
      <div className="container dl-step__in dl-step__in--wide">
        <p className="eyebrow">Step 2 of 3 · Your estimate</p>
        <h1 ref={headingRef} tabIndex={-1} className="dl-step__title">An illustrative range for a {industryLabel.toLowerCase()} business like yours.</h1>
        <p className="lede">Adjust the inputs to see how the range moves. Nothing here is an offer.</p>

        <div className="dl-estimate">
          <div className="dl-estimator dl-estimator--plain">
            <Radios name="est-industry" value={est.industry} onChange={(v) => setEst({ ...est, industry: v as HomeIndustry })} options={HOME_INDUSTRIES} />
            <NumberSlider id="est-desk" label="Full-time desk employees" value={est.desk} min={HOME_LIMITS.desk.min} max={HOME_LIMITS.desk.max} onChange={(v) => setEst({ ...est, desk: v })} />
            <NumberSlider id="est-nondesk" label="Non-desk employees" value={est.nonDesk} min={HOME_LIMITS.nonDesk.min} max={HOME_LIMITS.nonDesk.max} onChange={(v) => setEst({ ...est, nonDesk: v })} />
            <NumberSlider id="est-years" label="Years of operating history" value={est.years} min={HOME_LIMITS.years.min} max={HOME_LIMITS.years.max} onChange={(v) => setEst({ ...est, years: v })} suffix="yrs" />
          </div>
          <div className="dl-estimate__side">
            <RangeResult range={range} />
            <div className="dl-drivers">
              <h3>What moves the range</h3>
              <ul>
                <li><b>Industry.</b> Some record types are in higher demand than others.</li>
                <li><b>Desk headcount.</b> More people writing, emailing and documenting means more records.</li>
                <li><b>Non-desk headcount.</b> Field teams add calls, scheduling and service history.</li>
                <li><b>Operating history.</b> Longer histories show how work changed over time.</li>
              </ul>
            </div>
            {rights === "no" && (
              <p className="dl-notice">You said the records are held for clients or licensed from others. Those usually can't be licensed by you directly. You can still submit an inquiry and we'll review what, if anything, applies.</p>
            )}
            {rights === "partly" && (
              <p className="dl-notice">Unsure about rights is common. The inquiry asks a few questions that help us route the review; it does not require proof.</p>
            )}
          </div>
        </div>
        <div className="dl-form__nav">
          <button type="button" className="btn btn-ghost" onClick={onBack}>← Back</button>
          <button type="button" className="btn btn-primary" onClick={onNext}>Start the full inquiry →</button>
        </div>
      </div>
    </section>
  );
}
