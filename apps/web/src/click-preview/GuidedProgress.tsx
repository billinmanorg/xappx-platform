import type { PreviewSession } from "./types";

export function GuidedProgress({ session }: { session: PreviewSession }): JSX.Element {
  const completed = session.completed.length;
  const prompt = session.spec.workflow[completed]?.label;
  return <section className="guided-progress" aria-labelledby="guided-progress-title">
    <div className="guided-progress-heading"><h2 id="guided-progress-title">Your guided sample</h2><span>Three small steps. A real sample result.</span></div>
    <p className="guided-announcement" role="status" aria-label="Guided progress" aria-live="polite" aria-atomic="true">
      <strong>{completed} of 3</strong> guided actions complete. {prompt ? `Next: ${prompt}.` : "You can keep inspecting your sample records."}
    </p>
    <ol>{session.spec.workflow.map((step, index) => <li key={step.label} className={index < completed ? "step-complete" : index === completed ? "step-current" : ""} aria-current={index === completed ? "step" : undefined}>
      <span className="guided-step-number" aria-hidden="true">{index < completed ? "✓" : index + 1}</span>
      <span><span className="sr-only">{index < completed ? "Complete: " : index === completed ? "Current step: " : "Upcoming: "}</span>{step.label}</span>
    </li>)}</ol>
  </section>;
}
