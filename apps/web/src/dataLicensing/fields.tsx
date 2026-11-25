import type { ReactNode } from "react";

/** Small form primitives shared by the qualifier, estimator and intake. */

export function Field({ label, error, hint, children, id }: { label: ReactNode; error?: string; hint?: string; children: ReactNode; id?: string }) {
  return (
    <div className={"dl-field" + (error ? " dl-field--err" : "")}>
      <label htmlFor={id} className="dl-field__label">{label}</label>
      {children}
      {hint && !error && <span className="dl-field__hint">{hint}</span>}
      {error && <span className="dl-field__err" role="alert">{error}</span>}
    </div>
  );
}

export function Text({ id, value, onChange, type = "text", placeholder, autoComplete, inputMode, maxLength = 200 }: {
  id: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; autoComplete?: string; inputMode?: "numeric" | "text" | "email" | "tel" | "url"; maxLength?: number;
}) {
  return <input id={id} className="dl-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} inputMode={inputMode} maxLength={maxLength} />;
}

export function Area({ id, value, onChange, rows = 3, placeholder, maxLength = 2000 }: { id: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; maxLength?: number }) {
  return <textarea id={id} className="dl-input" value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} maxLength={maxLength} />;
}

export function Select({ id, value, onChange, options, placeholder = "Choose…" }: { id: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <select id={id} className="dl-input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export function Radios({ name, value, onChange, options }: { name: string; value: string; onChange: (v: string) => void; options: { id: string; label: string }[] }) {
  return (
    <div className="dl-radios" role="radiogroup">
      {options.map((o) => (
        <label key={o.id} className={"dl-radio" + (value === o.id ? " is-on" : "")}>
          <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

export function Checks({ value, onChange, options }: { value: string[]; onChange: (v: string[]) => void; options: string[] }) {
  return (
    <div className="dl-radios">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <label key={o} className={"dl-radio" + (on ? " is-on" : "")}>
            <input type="checkbox" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])} />
            <span>{o}</span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * A number field and a range slider bound to one integer value. Typing,
 * dragging and keyboard (arrows, Home/End) all update the same state, so the
 * estimate can never be stale. Out-of-range typed values are clamped on blur.
 */
export function NumberSlider({ id, label, value, min, max, onChange, suffix }: { id: string; label: string; value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string }) {
  const [draft, setDraft] = useDraft(String(value));
  const commit = (raw: string) => {
    const n = Number(raw);
    const next = Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : value;
    setDraft(String(next));
    onChange(next);
  };
  return (
    <div className="dl-slider">
      <div className="dl-slider__head">
        <label htmlFor={id}>{label}</label>
        <span className="dl-slider__val">
          <input
            id={id} className="dl-slider__num" type="number" inputMode="numeric" min={min} max={max} step={1}
            value={draft}
            onChange={(e) => { setDraft(e.target.value); const n = Number(e.target.value); if (e.target.value !== "" && Number.isFinite(n) && n >= min && n <= max && Number.isInteger(n)) onChange(n); }}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit((e.target as HTMLInputElement).value); }}
          />
          {suffix && <span className="dl-slider__suffix">{suffix}</span>}
        </span>
      </div>
      <input
        className="dl-slider__range" type="range" min={min} max={max} step={1} value={value}
        aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
        onChange={(e) => { const n = Number(e.target.value); setDraft(String(n)); onChange(n); }}
      />
      <div className="dl-slider__ticks"><span>{min.toLocaleString()}</span><span>{max.toLocaleString()}</span></div>
    </div>
  );
}

import { useEffect, useState } from "react";
/** Local text draft that follows the committed value when it changes elsewhere. */
function useDraft(initial: string): [string, (v: string) => void] {
  const [draft, setDraft] = useState(initial);
  useEffect(() => { setDraft(initial); }, [initial]);
  return [draft, setDraft];
}
