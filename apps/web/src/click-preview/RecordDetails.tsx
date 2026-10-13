import { useEffect, useRef } from "react";
import { previewReducer } from "./previewSession";
import { recordTitle } from "./RecordList";
import type { PreviewEvent, PreviewSession, SampleRecord } from "./types";

export function RecordDetails({ record, session, dispatch, onBack }: {
  record: SampleRecord;
  session: PreviewSession;
  dispatch: (event: PreviewEvent) => void;
  onBack: () => void;
}): JSX.Element {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [record.id]);
  const entity = session.spec.entities.find((item) => item.name === record.entity);
  const locked = session.gate !== "open";
  const actions: { label: string; event: PreviewEvent }[] = record.entity === "task" ? [] : session.workflow === "sponsor" ? [
    { label: "Mark Qualified", event: { type: "qualify", recordId: record.id } },
  ] : session.workflow === "speaker" ? [
    { label: "Mark Shortlisted", event: { type: "shortlist", recordId: record.id } },
  ] : [
    { label: "Assign Sample AV team", event: { type: "assign", recordId: record.id, team: "Sample AV team" } },
    { label: "Set In progress", event: { type: "start", recordId: record.id } },
  ];
  // The reducer is the authority for eligibility as well as execution. This pure
  // preflight avoids a second, subtly different set of UI ordering/target rules.
  const available = actions.map((action) => ({ ...action, enabled: previewReducer(session, action.event).completed.length > session.completed.length }));
  return <section className="record-details" aria-label="Record details">
    <button className="button button-quiet back-link" type="button" onClick={onBack}>Back to records</button>
    <p className="record-kicker">{entity?.label ?? "Sample record"} <span aria-hidden="true">/</span> {record.id}</p>
    <h2 ref={heading} tabIndex={-1}>{recordTitle(record)}</h2>
    <dl className="record-fields">{entity?.fields.map((field) => <div key={field.name}><dt>{field.label}</dt><dd className={field.name === entity.statusField ? "detail-status" : undefined}>{record.values[field.name] ?? "Unavailable"}</dd></div>)}</dl>
    <div className="record-actions">
      <h3>{actions.length ? "Guided sample actions" : "Sample task inspection"}</h3>
      <p id="record-action-help" className="small-note">{locked ? "Edits are locked after three guided actions. You can still inspect every record." : actions.length ? "Only the current guided action on the prompted record is available. Other records are here to inspect." : "Tasks are read-only in this sample. The guided changes happen in Incidents."}</p>
      {available.length ? <div className="button-row">{available.map((action) => <button key={action.label} className="button button-primary" type="button" disabled={!action.enabled} aria-describedby="record-action-help" onClick={() => dispatch(action.event)}>{action.label}</button>)}</div> : null}
    </div>
  </section>;
}
