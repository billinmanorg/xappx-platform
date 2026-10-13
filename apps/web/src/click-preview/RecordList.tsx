import type { SampleRecord } from "./types";

export function recordTitle(record: SampleRecord): string {
  return record.values.company ?? record.values.title ?? record.values.incident ?? record.values.task ?? record.id;
}
const metadata = [
  ["interest", "Interest"], ["topic", "Topic"], ["format", "Format"], ["owner", "Owner"],
  ["severity", "Severity"], ["location", "Location"], ["team", "Sample team"],
] as const;

export function RecordList({ records, selectedId, onOpen }: {
  records: readonly SampleRecord[];
  selectedId: string | null;
  onOpen: (recordId: string) => void;
}): JSX.Element {
  return <ul className="sample-record-list" aria-label="Sample records">
    {records.map((record) => <li key={record.id}>
      <button className="sample-record-card" type="button" aria-label={`Open ${recordTitle(record)}`} aria-pressed={record.id === selectedId} data-record-id={record.id} onClick={() => onOpen(record.id)}>
        <span className="record-card-top"><span className="record-id">{record.id}</span><span className="record-status">{record.values.stage ?? record.values.status ?? "Sample record"}</span></span>
        <strong className="record-title">{recordTitle(record)}</strong>
        <span className="record-metadata">{metadata.filter(([field]) => record.values[field]).map(([field, label]) => <span key={field}><span>{label}: </span>{record.values[field]}</span>)}</span>
        <span className="record-open">{record.id === selectedId ? "Selected record" : "Inspect record"}<span aria-hidden="true"> ↗</span></span>
      </button>
    </li>)}
  </ul>;
}
