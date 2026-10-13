import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CATALOG } from "./catalog";
import { GuidedProgress } from "./GuidedProgress";
import { deriveSummary } from "./previewSession";
import { RecordDetails } from "./RecordDetails";
import { RecordList, recordTitle } from "./RecordList";
import { seedRecords } from "./sampleRecords";
import type { PreviewEvent, PreviewSession, WorkflowId } from "./types";
import { XappyGuide } from "./XappyGuide";
import "./workflows.css";

export interface WorkingPreviewProps {
  session: PreviewSession;
  dispatch: (event: PreviewEvent) => void;
  onBack: () => void;
  onReset: () => void;
  onChangeWorkflow: (workflow: WorkflowId) => void;
}

export function WorkingPreview({ session, dispatch, onBack, onReset, onChangeWorkflow }: WorkingPreviewProps): JSX.Element {
  const [showDetails, setShowDetails] = useState(true);
  const recordsHeading = useRef<HTMLHeadingElement>(null);
  const pendingListFocus = useRef(false);
  useEffect(() => {
    if (pendingListFocus.current) { recordsHeading.current?.focus(); pendingListFocus.current = false; }
  });
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const previousGate = useRef(session.gate);
  useEffect(() => {
    if (session.gate === "result" && previousGate.current !== "result") resultHeading.current?.focus();
    previousGate.current = session.gate;
  }, [session.gate]);
  const view = session.spec.views.find((item) => item.id === session.view && !item.locked);
  const entity = session.spec.entities.find((item) => item.name === view?.entity);
  const entityRecords = session.records.filter((record) => record.entity === entity?.name);
  const filterField = session.workflow === "sponsor" ? "interest" : session.workflow === "speaker" ? "topic" : null;
  const filterDefinition = entity?.fields.find((field) => field.name === filterField);
  const records = entityRecords.filter((record) => !filterField || !session.filter || record.values[filterField] === session.filter);
  const selectedMatches = session.records.filter((record) => record.id === session.selectedId);
  const selected = selectedMatches.length === 1 ? selectedMatches[0] : undefined;
  const unavailable = session.selectedId !== null && (!selected || !session.spec.entities.some((item) => item.name === selected.entity && item.fields.every((field) => typeof selected.values[field.name] === "string")));
  const errorSpace = useRef<HTMLDivElement>(null);
  const [reservedErrorHeight, setReservedErrorHeight] = useState(0);
  useLayoutEffect(() => {
    // Clearing feedback must not move a filter/record under a rapid second click.
    // Keep only its measured space; stale alerts and recovery controls are removed.
    if (!(session.error || unavailable) || !errorSpace.current) return;
    const space = errorSpace.current;
    let active = true;
    const retainHeight = () => {
      if (!active) return;
      const height = space.getBoundingClientRect().height;
      setReservedErrorHeight((previous) => Math.max(previous, height));
    };
    retainHeight();
    // Reflow can grow the same alert without changing its message. Observe the
    // margin-containing wrapper; equal/smaller measurements never update state.
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(retainHeight) : null;
    observer?.observe(space);
    window.addEventListener("resize", retainHeight);
    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener("resize", retainHeight);
    };
  }, [session.error, unavailable]);
  const displayDetails = showDetails && !unavailable && selected?.entity === entity?.name && selected !== undefined;
  const summary = deriveSummary(session);
  const targetId = useMemo(() => { try { return seedRecords(session.spec)[0]?.id; } catch { return undefined; } }, [session.spec]);
  const target = session.records.find((record) => record.id === targetId);
  const result = target ? `${recordTitle(target)} is now ${target.values.stage ?? target.values.status}.${session.workflow === "operations" ? ` Assigned to ${target.values.team}.` : ""}` : "Your three guided sample actions are complete.";
  const backToRecords = () => {
    if (showDetails) { pendingListFocus.current = true; setShowDetails(false); }
    else recordsHeading.current?.focus();
  };
  const changeView = (id: string, focusList = false) => {
    // Overview shortcuts unmount; persistent navigation buttons keep their focus.
    pendingListFocus.current = focusList;
    setShowDetails(false); dispatch({ type: "view", view: id });
  };
  const filter = (value: string) => {
    if (value !== session.filter) setShowDetails(false);
    dispatch({ type: "filter", value });
  };
  return <section className="working-preview" aria-labelledby="working-title">
    <div className="working-toolbar"><button className="button button-quiet back-link" type="button" onClick={onBack}>Back to recommendations</button><button className="button button-secondary" type="button" onClick={onReset}>Reset demo</button></div>
    <div className="question-row working-intro">
      <div className="question-copy"><span className="build-status build-working">Working preview</span><h1 id="working-title" tabIndex={-1}>{session.spec.name}</h1><p className="question-description">A small working space for your event team. Explore fictional records and try three guided actions.</p></div>
      <XappyGuide text={session.spec.workflow[session.completed.length]?.label ?? "You've completed the guided sample. Your result is ready below, and the records remain open for inspection."} />
    </div>
    <GuidedProgress session={session} />
    <section className="sample-summary" aria-label="Current sample summary">{summary.map(({ label, value }) => <div className="summary-stat" key={label} role="group" aria-label={label}><span>{label}</span><strong>{value}</strong></div>)}</section>
    {session.gate !== "open" ? <section className="sample-result" aria-labelledby="sample-result-title">
      <div><span className="result-check" aria-hidden="true">✓</span><h2 id="sample-result-title" ref={resultHeading} tabIndex={-1}>Your sample result</h2><p role="status" aria-label="Sample result" aria-live="polite" aria-atomic="true">{result}</p><p className="small-note">Three guided actions complete. Your changes stay in this session. Keep exploring the records, or see the proposed plans when you're ready.</p></div>
      <button className="button button-primary" type="button" data-plans-trigger="" onClick={() => dispatch({ type: "showPlans" })}>View proposed plans</button>
    </section> : null}
    <div className="sample-error-space" ref={errorSpace} style={{ minHeight: reservedErrorHeight || undefined }}>
      {session.error || unavailable ? <div className="sample-error" role="alert"><strong>Let's get back on track</strong><p>{session.error ?? "The sample record is unavailable or has changed. Use Back or Reset demo to try again."}</p>{unavailable ? <button className="button button-secondary" type="button" onClick={backToRecords}>Back to records</button> : null}</div> : null}
    </div>
    <div className={`working-workspace${displayDetails ? " has-record-detail" : ""}`}>
      <nav className="workspace-nav" aria-label="Sample views"><p className="workspace-label">Your workspace</p>{session.spec.views.filter((item) => !item.locked).map((item) => <button key={item.id} className="workspace-nav-button" type="button" aria-current={view?.id === item.id ? "page" : undefined} onClick={() => changeView(item.id)}><span>{item.label}</span><span aria-hidden="true">↗</span></button>)}<p className="workspace-note">Fictional records.<br />Changes stay in this session.</p></nav>
      {!view ? <div className="empty-state workspace-overview"><h2>This sample view is unavailable</h2><p>Choose a sample view from the navigation, go Back, or use Reset demo.</p></div> : view.kind === "dashboard" ? <section className="workspace-overview"><p className="record-kicker">Sample overview</p><h2>A snapshot of your sample</h2><p>The figures above count your current fictional records, including any guided changes. Open a list to inspect the details behind them.</p><div className="button-row">{session.spec.views.filter((item) => item.kind === "list" && !item.locked).map((item) => <button key={item.id} className="button button-secondary" type="button" onClick={() => changeView(item.id, true)}>Browse {item.label.toLowerCase()}</button>)}</div><p className="small-note">No live event data, messages or automated decisions are connected.</p></section> : <>
        <section className="workspace-records" aria-label={`${entity?.labelPlural ?? "Sample"} list`}>
          <div className="records-header"><h2 ref={recordsHeading} tabIndex={-1}>{entity?.labelPlural ?? "Sample records"}</h2><span>{records.length} of {entityRecords.length} records</span></div>
          {filterDefinition ? <fieldset className="record-filters"><legend>Filter by {filterDefinition.label.toLowerCase()}</legend><div><button type="button" aria-pressed={!session.filter} onClick={() => filter("")}>All</button>{filterDefinition.options?.map((value) => <button type="button" key={value} aria-pressed={session.filter === value} onClick={() => filter(value)}>{value}</button>)}</div></fieldset> : null}
          {records.length ? <RecordList records={records} selectedId={session.selectedId} onOpen={(recordId) => { setShowDetails(true); dispatch({ type: "open", recordId }); }} /> : <div className="records-empty"><h3>{entityRecords.length ? "No sample records match this filter." : "No sample records are available."}</h3><p>{entityRecords.length ? "Try another filter to inspect the fictional records." : "Use Back or Reset demo to recover the sample."}</p>{session.filter ? <button className="button button-secondary" type="button" onClick={() => filter("")}>Clear filter</button> : null}</div>}
        </section>
        <div className="workspace-detail">{displayDetails ? <RecordDetails record={selected} session={session} dispatch={dispatch} onBack={backToRecords} /> : <div className="detail-placeholder"><span aria-hidden="true">↗</span><h2>A closer look</h2><p>Open a record to inspect its sample details. Follow the guidance above when you're ready to try an action.</p></div>}</div>
      </>}
    </div>
    <section className="other-workflows" aria-label="Other working previews"><div><h2>Explore another sample</h2><p>Changing workflow resets its records and guided progress after confirmation.</p></div><div className="button-row">{CATALOG.filter((item) => item.buildStatus === "working-preview" && item.workflowId !== session.workflow).map((item) => item.buildStatus === "working-preview" ? <button key={item.id} className="button button-secondary" type="button" onClick={() => onChangeWorkflow(item.workflowId)}>{item.title}</button> : null)}</div></section>
  </section>;
}
