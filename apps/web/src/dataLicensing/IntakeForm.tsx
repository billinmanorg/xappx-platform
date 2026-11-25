import { useMemo, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { Area, Checks, Field, Radios, Select, Text } from "./fields";
import {
  SYSTEMS, DATA_TYPES, COUNT_UNITS, COVERAGE, OWNERSHIP_TYPES, DECISION_ROLES, RIGHTS_KNOWN, RESTRICTIONS, RETENTION,
  SENSITIVE_FLAGS, REVENUE_RANGES, OPERATING_STATUS, US_STATES, NOTICE_VERSION,
} from "./data";
import { QUALIFY_INDUSTRIES } from "./calculator";
import { looksPersonalEmail, newSystem, unknownFields, validateStep1, validateStep2, validateSubmit, type Intake as Model, type SystemDetail } from "./intake";

/** 04 Intake: company & systems → per-system details → review & submit. */
export function IntakeForm({ intake, setIntake, step, setStep, onSubmit, sending, sendError, receipt, onBack, headingRef }: {
  intake: Model; setIntake: Dispatch<SetStateAction<Model>>; step: 1 | 2 | 3; setStep: (s: 1 | 2 | 3) => void;
  onSubmit: () => Promise<Record<string, string>>; sending: boolean; sendError: string | null; receipt: { recordId: string } | null;
  onBack: () => void; headingRef: RefObject<HTMLHeadingElement>;
}) {
  const [tried, setTried] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Functional updates: rapid events (browser autofill fills many fields in one
  // tick) must never overwrite each other.
  const set = <K extends keyof Model>(k: K, v: Model[K]) => setIntake((prev) => ({ ...prev, [k]: v }));
  const err = (k: string) => (tried[step] ? errors[k] : undefined);

  function next() {
    const e = step === 1 ? validateStep1(intake) : step === 2 ? validateStep2(intake) : {};
    setErrors(e); setTried({ ...tried, [step]: true });
    if (Object.keys(e).length) { window.setTimeout(() => document.querySelector<HTMLElement>(".dl-field--err")?.scrollIntoView({ block: "center" }), 20); return; }
    setStep((step + 1) as 1 | 2 | 3);
    window.scrollTo({ top: 0 }); headingRef.current?.focus();
  }
  function back() {
    if (step === 1) { onBack(); return; }
    setStep((step - 1) as 1 | 2 | 3);
    window.scrollTo({ top: 0 }); headingRef.current?.focus();
  }
  async function submit() {
    setTried({ ...tried, 3: true });
    const e = await onSubmit();
    setErrors(e);
  }

  if (receipt) {
    return (
      <section className="dl-step section">
        <div className="container dl-step__in">
          <div className="dl-receipt" role="status">
            <span className="dl-receipt__badge">✓</span>
            <h1 ref={headingRef} tabIndex={-1} className="dl-step__title">Inquiry received.</h1>
            <p className="lede">Thank you, {intake.contactName.split(" ")[0]}. XAPPX will review your inquiry and reply to <b>{intake.email}</b>.</p>
            <p>Your reference: <code className="dl-ref">{receipt.recordId}</code>. Keep it for any follow-up.</p>
            <p className="dl-muted">This inquiry is not a license and does not authorize access to any records. Nothing was uploaded.</p>
            <a className="btn btn-ghost" href="/">Back to XAPPX</a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="dl-step section">
      <div className="container dl-step__in dl-step__in--wide">
        <p className="eyebrow">Step 3 of 3 · Full inquiry · Part {step} of 3</p>
        <h1 ref={headingRef} tabIndex={-1} className="dl-step__title">
          {step === 1 && "Tell us about the company and its systems."}
          {step === 2 && "A little detail on each system."}
          {step === 3 && "Review and submit."}
        </h1>
        <p className="lede">
          {step === 1 && "Describe the business and which systems hold its records. Nothing is uploaded and no login is requested."}
          {step === 2 && "Rough numbers are fine. Mark anything you don't know; it won't block the inquiry."}
          {step === 3 && "Check the summary. You can go back and edit anything before submitting."}
        </p>
        <ol className="dl-progress" aria-label="Inquiry progress">
          {["Company & systems", "System details", "Review"].map((l, i) => <li key={l} className={i + 1 === step ? "is-on" : i + 1 < step ? "is-done" : ""}>{l}</li>)}
        </ol>

        {step === 1 && <Step1 intake={intake} set={set} err={err} setIntake={setIntake} />}
        {step === 2 && <Step2 intake={intake} setIntake={setIntake} err={err} />}
        {step === 3 && <Step3 intake={intake} set={set} err={err} goto={(s) => { setStep(s); window.scrollTo({ top: 0 }); }} />}

        {sendError && <p className="dl-field__err dl-senderr" role="alert">{sendError}</p>}
        <div className="dl-form__nav">
          <button type="button" className="btn btn-ghost" onClick={back} disabled={sending}>← Back</button>
          {step < 3
            ? <button type="button" className="btn btn-primary" onClick={next}>Continue →</button>
            : <button type="button" className="btn btn-primary" onClick={submit} disabled={sending}>{sending ? "Submitting…" : "Submit inquiry"}</button>}
        </div>
      </div>
    </section>
  );
}

function Step1({ intake: i, set, err, setIntake }: { intake: Model; set: <K extends keyof Model>(k: K, v: Model[K]) => void; err: (k: string) => string | undefined; setIntake: Dispatch<SetStateAction<Model>> }) {
  const [search, setSearch] = useState("");
  const [custom, setCustom] = useState("");
  const selected = new Set(i.systems.map((s) => s.id));
  const results = useMemo(() => SYSTEMS.filter((s) => s.label.toLowerCase().includes(search.trim().toLowerCase())), [search]);
  const toggle = (sys: { id: string; label: string }) => {
    setIntake((prev) => ({ ...prev, systems: prev.systems.some((s) => s.id === sys.id) ? prev.systems.filter((s) => s.id !== sys.id) : [...prev.systems, newSystem(sys.label, false, sys.id)] }));
  };
  const addCustom = () => {
    const label = custom.trim();
    if (label.length < 2) return;
    setIntake((prev) => ({ ...prev, systems: [...prev.systems, newSystem(label, true)] }));
    setCustom("");
  };
  const today = new Date().toISOString().slice(0, 10);
  const personal = looksPersonalEmail(i.email);

  return (
    <div className="dl-form">
      <h2 className="dl-h2">Completed by</h2>
      <div className="dl-row2">
        <Field id="completedBy" label="Your name"><Text id="completedBy" value={i.completedBy} onChange={(v) => set("completedBy", v)} autoComplete="name" /></Field>
        <Field id="completedByRole" label="Your role"><Text id="completedByRole" value={i.completedByRole} onChange={(v) => set("completedByRole", v)} /></Field>
      </div>
      <p className="dl-muted">Date: {today}</p>

      <h2 className="dl-h2">Company</h2>
      <div className="dl-row2">
        <Field id="businessName" label="Business name" error={err("businessName")}><Text id="businessName" value={i.businessName} onChange={(v) => set("businessName", v)} autoComplete="organization" /></Field>
        <Field id="legalName" label="Legal name (if different)"><Text id="legalName" value={i.legalName} onChange={(v) => set("legalName", v)} /></Field>
      </div>
      <Field id="relatedEntities" label="Related entities (optional)" hint="Subsidiaries, DBAs or affiliates whose records are included."><Text id="relatedEntities" value={i.relatedEntities} onChange={(v) => set("relatedEntities", v)} /></Field>
      <div className="dl-row2">
        <Field id="hqState" label="Headquarters state" error={err("hqState")}><Select id="hqState" value={i.hqState} onChange={(v) => set("hqState", v)} options={US_STATES} /></Field>
        <Field label="US-domiciled business" error={err("usDomicile")}>
          <Radios name="usDomicile" value={i.usDomicile} onChange={(v) => set("usDomicile", v as Model["usDomicile"])} options={[{ id: "yes", label: "Yes" }, { id: "no", label: "No" }]} />
        </Field>
      </div>
      <div className="dl-row2">
        <Field id="ownershipType" label="Ownership type"><Select id="ownershipType" value={i.ownershipType} onChange={(v) => set("ownershipType", v)} options={OWNERSHIP_TYPES} /></Field>
        <Field id="industry" label="Industry" error={err("industry")}><Select id="industry" value={i.industry} onChange={(v) => set("industry", v)} options={QUALIFY_INDUSTRIES.map((x) => x.label)} /></Field>
      </div>
      <div className="dl-row2">
        <Field id="subVertical" label="Sub-vertical (optional)" hint="e.g. family law, commercial brokerage"><Text id="subVertical" value={i.subVertical} onChange={(v) => set("subVertical", v)} /></Field>
        <Field id="franchise" label="Franchise footprint (if applicable)" hint="Number of locations or franchisees."><Text id="franchise" value={i.franchise} onChange={(v) => set("franchise", v)} /></Field>
      </div>

      <h2 className="dl-h2">Contact</h2>
      <div className="dl-row2">
        <Field id="contactName" label="Contact name" error={err("contactName")}><Text id="contactName" value={i.contactName} onChange={(v) => set("contactName", v)} autoComplete="name" /></Field>
        <Field id="contactTitle" label="Title"><Text id="contactTitle" value={i.contactTitle} onChange={(v) => set("contactTitle", v)} autoComplete="organization-title" /></Field>
      </div>
      <div className="dl-row2">
        <Field id="email" label="Work email" error={err("email")} hint={personal ? "That looks like a personal address. A company address helps us verify the inquiry." : undefined}>
          <Text id="email" type="email" value={i.email} onChange={(v) => set("email", v)} autoComplete="email" inputMode="email" />
        </Field>
        <Field id="phone" label="Phone (optional)"><Text id="phone" type="tel" value={i.phone} onChange={(v) => set("phone", v)} autoComplete="tel" inputMode="tel" maxLength={30} /></Field>
      </div>
      <div className="dl-row2">
        <Field id="decisionRole" label="Decision-maker role"><Select id="decisionRole" value={i.decisionRole} onChange={(v) => set("decisionRole", v)} options={DECISION_ROLES} /></Field>
        <Field id="referral" label="How did you hear about this? (optional)"><Text id="referral" value={i.referral} onChange={(v) => set("referral", v)} /></Field>
      </div>

      <h2 className="dl-h2">Profile</h2>
      <div className="dl-row2">
        <Field id="website" label="Website"><Text id="website" type="url" value={i.website} onChange={(v) => set("website", v)} inputMode="url" placeholder="https://" /></Field>
        <Field id="linkedin" label="LinkedIn (optional)"><Text id="linkedin" type="url" value={i.linkedin} onChange={(v) => set("linkedin", v)} inputMode="url" /></Field>
      </div>
      <Field id="description" label="What the company does"><Area id="description" value={i.description} onChange={(v) => set("description", v)} maxLength={4000} /></Field>
      <div className="dl-row2">
        <Field id="customerTypes" label="Customer types" hint="Kinds of customers, never names."><Text id="customerTypes" value={i.customerTypes} onChange={(v) => set("customerTypes", v)} /></Field>
        <Field id="engagement" label="Typical engagement" hint="e.g. multi-year retainers, one-off projects"><Text id="engagement" value={i.engagement} onChange={(v) => set("engagement", v)} /></Field>
      </div>

      <h2 className="dl-h2">Scale and history</h2>
      <div className="dl-row4">
        <Field id="desk" label="Desk employees" error={err("desk")}><Text id="desk" value={i.desk} onChange={(v) => set("desk", v)} inputMode="numeric" maxLength={7} /></Field>
        <Field id="nonDesk" label="Non-desk employees" error={err("nonDesk")}><Text id="nonDesk" value={i.nonDesk} onChange={(v) => set("nonDesk", v)} inputMode="numeric" maxLength={7} /></Field>
        <Field id="totalHeadcount" label="Total headcount" error={err("totalHeadcount")}><Text id="totalHeadcount" value={i.totalHeadcount} onChange={(v) => set("totalHeadcount", v)} inputMode="numeric" maxLength={7} /></Field>
        <Field id="peakHeadcount" label="Peak headcount" error={err("peakHeadcount")}><Text id="peakHeadcount" value={i.peakHeadcount} onChange={(v) => set("peakHeadcount", v)} inputMode="numeric" maxLength={7} /></Field>
      </div>
      <div className="dl-row4">
        <Field id="operatingStatus" label="Operating status"><Select id="operatingStatus" value={i.operatingStatus} onChange={(v) => set("operatingStatus", v)} options={OPERATING_STATUS} /></Field>
        <Field id="foundedYear" label="Founded (year)" error={err("foundedYear")}><Text id="foundedYear" value={i.foundedYear} onChange={(v) => set("foundedYear", v)} inputMode="numeric" maxLength={4} /></Field>
        <Field id="earliestRecords" label="Earliest records (year)" error={err("earliestRecords")}><Text id="earliestRecords" value={i.earliestRecords} onChange={(v) => set("earliestRecords", v)} inputMode="numeric" maxLength={4} /></Field>
        <Field id="recordsFrom" label="Records date range" error={err("recordsFrom") || err("recordsTo")}>
          <div className="dl-inline">
            <Text id="recordsFrom" value={i.recordsFrom} onChange={(v) => set("recordsFrom", v)} inputMode="numeric" maxLength={4} placeholder="from" />
            <Text id="recordsTo" value={i.recordsTo} onChange={(v) => set("recordsTo", v)} inputMode="numeric" maxLength={4} placeholder="to" />
          </div>
        </Field>
      </div>
      <div className="dl-row2">
        <Field id="staffGeography" label="Where staff are based" hint="Separate from the company HQ."><Text id="staffGeography" value={i.staffGeography} onChange={(v) => set("staffGeography", v)} /></Field>
        <Field id="dataLanguage" label="Main language of the records"><Text id="dataLanguage" value={i.dataLanguage} onChange={(v) => set("dataLanguage", v)} placeholder="e.g. English" /></Field>
      </div>
      <Field label="Coverage of records that could be included">
        <div className="dl-coverage">
          {([["coverageEmail", "Email"], ["coverageChat", "Chat"], ["coverageFiles", "Files"]] as const).map(([k, l]) => (
            <div key={k} className="dl-coverage__row">
              <span>{l}</span>
              <Radios name={k} value={i[k]} onChange={(v) => set(k, v as Model["coverageEmail"])} options={COVERAGE.map((c) => ({ id: c, label: c }))} />
            </div>
          ))}
        </div>
      </Field>

      <h2 className="dl-h2">Rights and background</h2>
      <div className="dl-row2">
        <Field id="rightsKnown" label="Do you own these records?"><Select id="rightsKnown" value={i.rightsKnown} onChange={(v) => set("rightsKnown", v)} options={RIGHTS_KNOWN} /></Field>
        <Field id="restrictions" label="Third-party restrictions"><Select id="restrictions" value={i.restrictions} onChange={(v) => set("restrictions", v)} options={RESTRICTIONS} /></Field>
      </div>
      <Field label="Sensitive categories present" hint="Flags only. We never ask for the data itself.">
        <Checks value={i.sensitive} onChange={(v) => set("sensitive", v)} options={SENSITIVE_FLAGS} />
      </Field>
      <div className="dl-row2">
        <Field id="retention" label="Retention / auto-delete"><Select id="retention" value={i.retention} onChange={(v) => set("retention", v)} options={RETENTION} /></Field>
        <Field label="Prior licensing discussions">
          <Radios name="priorLicensing" value={i.priorLicensing} onChange={(v) => set("priorLicensing", v as Model["priorLicensing"])} options={[{ id: "yes", label: "Yes" }, { id: "no", label: "No" }]} />
        </Field>
      </div>
      <div className="dl-row2">
        <Field id="revenueRange" label="Annual revenue (optional)" hint="A rough range is enough."><Select id="revenueRange" value={i.revenueRange} onChange={(v) => set("revenueRange", v)} options={REVENUE_RANGES} /></Field>
        <Field id="fiscalYear" label="Fiscal year end (optional)"><Text id="fiscalYear" value={i.fiscalYear} onChange={(v) => set("fiscalYear", v)} placeholder="e.g. December" maxLength={30} /></Field>
      </div>

      <h2 className="dl-h2">Systems that hold the records</h2>
      <Field label="Select every system that applies" error={err("systems")}>
        <div className="dl-systems">
          {SYSTEMS.map((s) => (
            <button type="button" key={s.id} className={"dl-sys" + (selected.has(s.id) ? " is-on" : "")} aria-pressed={selected.has(s.id)} onClick={() => toggle(s)}>
              <b>{s.label}</b><span>{s.kind}</span>
            </button>
          ))}
        </div>
      </Field>
      <div className="dl-row2">
        <Field id="sysSearch" label="Search the list">
          <Text id="sysSearch" value={search} onChange={setSearch} placeholder="Type to filter…" />
          {search.trim() && (
            <div className="dl-sysresults">
              {results.length === 0 && <span className="dl-muted">No match. Add it below.</span>}
              {results.map((s) => <button type="button" key={s.id} className="dl-chip" onClick={() => toggle(s)}>{selected.has(s.id) ? "✓ " : "+ "}{s.label}</button>)}
            </div>
          )}
        </Field>
        <Field id="sysCustom" label="Add another system or archive">
          <div className="dl-inline">
            <Text id="sysCustom" value={custom} onChange={setCustom} placeholder="e.g. On-premise file server" />
            <button type="button" className="btn btn-ghost" onClick={addCustom}>Add</button>
          </div>
        </Field>
      </div>
      {i.systems.length > 0 && (
        <ul className="dl-selected">
          {i.systems.map((s) => <li key={s.id}>{s.label}{s.custom && <em> (custom)</em>} <button type="button" aria-label={`Remove ${s.label}`} onClick={() => setIntake((prev) => ({ ...prev, systems: prev.systems.filter((x) => x.id !== s.id) }))}>×</button></li>)}
        </ul>
      )}
      <label className="dl-check">
        <input type="checkbox" checked={i.needHelpIdentifying} onChange={(e) => set("needHelpIdentifying", e.target.checked)} />
        <span>I need help identifying our systems</span>
      </label>
    </div>
  );
}

function Step2({ intake: i, setIntake, err }: { intake: Model; setIntake: Dispatch<SetStateAction<Model>>; err: (k: string) => string | undefined }) {
  const update = (id: string, patch: Partial<SystemDetail>) => setIntake((prev) => ({ ...prev, systems: prev.systems.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  if (!i.systems.length) {
    return <p className="dl-notice">You asked for help identifying systems, so there is nothing to detail here yet. Continue to review.</p>;
  }
  return (
    <div className="dl-form">
      <p className="dl-muted">Shared systems stay separate rows; we won't double-count across them.</p>
      {i.systems.map((s) => (
        <fieldset className="dl-sysdetail" key={s.id}>
          <legend>{s.label}{s.custom && <em> (custom)</em>}</legend>
          <label className="dl-check">
            <input type="checkbox" checked={s.unknown} onChange={(e) => update(s.id, { unknown: e.target.checked })} />
            <span>We don't know the details for this system yet</span>
          </label>
          {!s.unknown && (
            <>
              <div className="dl-row4">
                <Field id={`${s.id}-type`} label="Data type"><Select id={`${s.id}-type`} value={s.dataType} onChange={(v) => update(s.id, { dataType: v })} options={DATA_TYPES} /></Field>
                <Field id={`${s.id}-count`} label="Approximate count" error={err(`${s.id}.count`)}><Text id={`${s.id}-count`} value={s.count} onChange={(v) => update(s.id, { count: v })} inputMode="numeric" maxLength={12} /></Field>
                <Field id={`${s.id}-unit`} label="Unit"><Select id={`${s.id}-unit`} value={s.unit} onChange={(v) => update(s.id, { unit: v })} options={COUNT_UNITS} /></Field>
                <Field id={`${s.id}-from`} label="History (years)" error={err(`${s.id}.historyFrom`) || err(`${s.id}.historyTo`)}>
                  <div className="dl-inline">
                    <Text id={`${s.id}-from`} value={s.historyFrom} onChange={(v) => update(s.id, { historyFrom: v })} inputMode="numeric" maxLength={4} placeholder="from" />
                    <Text id={`${s.id}-to`} value={s.historyTo} onChange={(v) => update(s.id, { historyTo: v })} inputMode="numeric" maxLength={4} placeholder="to" />
                  </div>
                </Field>
              </div>
              <div className="dl-row2">
                <Field id={`${s.id}-teams`} label="Teams included" hint="e.g. sales, support, all staff"><Text id={`${s.id}-teams`} value={s.teams} onChange={(v) => update(s.id, { teams: v })} /></Field>
                <Field id={`${s.id}-restr`} label="Restrictions" hint="Contracts, regulations or policies that limit sharing."><Text id={`${s.id}-restr`} value={s.restrictions} onChange={(v) => update(s.id, { restrictions: v })} /></Field>
              </div>
              <Field id={`${s.id}-notes`} label="Notes (optional)"><Area id={`${s.id}-notes`} value={s.notes} onChange={(v) => update(s.id, { notes: v })} rows={2} /></Field>
            </>
          )}
        </fieldset>
      ))}
    </div>
  );
}

function Step3({ intake: i, set, err, goto }: { intake: Model; set: <K extends keyof Model>(k: K, v: Model[K]) => void; err: (k: string) => string | undefined; goto: (s: 1 | 2) => void }) {
  const unknown = unknownFields(i);
  const row = (label: string, v: string) => <tr key={label}><th>{label}</th><td>{v.trim() ? v : <em className="dl-unknown">Unknown</em>}</td></tr>;
  const step1Errors = validateSubmit(i);
  const blocking = Object.keys(step1Errors).filter((k) => !["authority", "privacyAck"].includes(k));
  return (
    <div className="dl-form">
      {blocking.length > 0 && (
        <p className="dl-notice dl-notice--warn">Some required company or contact details are missing. <button type="button" className="dl-link" onClick={() => goto(1)}>Edit part 1</button></p>
      )}
      <div className="dl-review">
        <div className="dl-review__block">
          <div className="dl-review__head"><h2 className="dl-h2">Company</h2><button type="button" className="dl-link" onClick={() => goto(1)}>Edit</button></div>
          <table>
            <tbody>
              {row("Business name", i.businessName)}{row("Legal name", i.legalName)}{row("HQ state", i.hqState)}{row("US-domiciled", i.usDomicile)}
              {row("Ownership", i.ownershipType)}{row("Industry", [i.industry, i.subVertical].filter(Boolean).join(" · "))}
              {row("Contact", [i.contactName, i.contactTitle].filter(Boolean).join(", "))}{row("Work email", i.email)}{row("Phone", i.phone)}
              {row("Headcount (desk / non-desk / total / peak)", [i.desk, i.nonDesk, i.totalHeadcount, i.peakHeadcount].map((x) => x || "?").join(" / "))}
              {row("Founded", i.foundedYear)}{row("Earliest records", i.earliestRecords)}{row("Records date range", [i.recordsFrom, i.recordsTo].filter(Boolean).join(" to "))}
              {row("Coverage (email / chat / files)", [i.coverageEmail, i.coverageChat, i.coverageFiles].map((x) => x || "?").join(" / "))}
              {row("Rights", i.rightsKnown)}{row("Restrictions", i.restrictions)}{row("Sensitive categories", i.sensitive.join(", "))}{row("Retention", i.retention)}
              {row("Prior licensing talks", i.priorLicensing)}{row("Revenue", i.revenueRange)}
            </tbody>
          </table>
        </div>
        <div className="dl-review__block">
          <div className="dl-review__head"><h2 className="dl-h2">Systems ({i.systems.length})</h2><button type="button" className="dl-link" onClick={() => goto(i.systems.length ? 2 : 1)}>Edit</button></div>
          {i.systems.length === 0 && <p className="dl-muted">{i.needHelpIdentifying ? "You asked for help identifying systems." : "None selected."}</p>}
          <table>
            <tbody>
              {i.systems.map((s) => (
                <tr key={s.id}>
                  <th>{s.label}</th>
                  <td>{s.unknown ? <em className="dl-unknown">Details unknown</em> : [s.dataType, s.count && `${s.count} ${s.unit}`.trim(), (s.historyFrom || s.historyTo) && `${s.historyFrom || "?"}–${s.historyTo || "?"}`, s.teams, s.restrictions].filter(Boolean).join(" · ") || <em className="dl-unknown">No details</em>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {unknown.length > 0 && <p className="dl-muted">Marked unknown or left blank: {unknown.join(", ")}. That's fine; you can add them later.</p>}

      <div className="dl-submitbox">
        <p className="dl-notice">No records are collected with this inquiry. Do not include raw files, passwords, bank details or customer or employee identifiers in any field.</p>
        <label className={"dl-check" + (err("authority") ? " dl-check--err" : "")}>
          <input type="checkbox" checked={i.authority} onChange={(e) => set("authority", e.target.checked)} />
          <span>I am authorized to make this inquiry on behalf of the company. This is an inquiry only, not a license or approval to disclose records.</span>
        </label>
        {err("authority") && <span className="dl-field__err" role="alert">{err("authority")}</span>}
        <label className={"dl-check" + (err("privacyAck") ? " dl-check--err" : "")}>
          <input type="checkbox" checked={i.privacyAck} onChange={(e) => set("privacyAck", e.target.checked)} />
          <span>I have read the <a href="/privacy.html" target="_blank" rel="noreferrer">XAPPX privacy notice</a> (v{NOTICE_VERSION}). XAPPX reviews this inquiry first; any onward sharing requires separate approval.</span>
        </label>
        {err("privacyAck") && <span className="dl-field__err" role="alert">{err("privacyAck")}</span>}
      </div>
    </div>
  );
}
