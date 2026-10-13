import { useEffect, useRef, useState } from "react";
import { MAX_NOTE_LENGTH, PRIORITIES, PROBLEMS, SCALES } from "./problems";
import { guidanceFor } from "./guidance";
import type { DiscoveryContext } from "./types";
import { XappyGuide } from "./XappyGuide";

export type DiscoveryStep = "problem" | "goal" | "scale" | "priority";
interface DiscoveryFlowProps {
  context: DiscoveryContext;
  onChange: (context: DiscoveryContext) => void;
  onExplore: () => void;
  /** Optional controlled navigation lets PreviewApp retain the step across views. */
  step?: DiscoveryStep;
  onStepChange?: (step: DiscoveryStep) => void;
}
const questions = {
  problem: "What would you like to improve?",
  goal: "What would a better outcome look like?",
  scale: "How big is your event?",
  priority: "What matters most right now?",
};
const descriptions = {
  problem: "Choose a starting point for your Events & Conferences team.",
  goal: "Choose one goal. We'll use it to find relevant possibilities.",
  scale: "Choose the closest range. You can always come back and change it.",
  priority: "Choose one priority to help order your recommendations.",
};
const categoryHints = [
  "A smoother arrival", "More participation", "Better connections", "More valuable conversations",
  "A stronger program", "A clearer event day", "Costs and partners in view", "Keep teams in sync", "Keep the momentum",
];
export function initialDiscoveryStep(context: DiscoveryContext): DiscoveryStep {
  if (!context.problemId) return "problem";
  if (!context.goalId) return "goal";
  if (!context.scale) return "scale";
  return "priority";
}

export function DiscoveryFlow({ context, onChange, onExplore, step: controlledStep, onStepChange }: DiscoveryFlowProps): JSX.Element {
  const [ownStep, setOwnStep] = useState<DiscoveryStep>(() => initialDiscoveryStep(context));
  const [somethingElse, setSomethingElse] = useState(!context.problemId && !!context.note);
  const step = controlledStep ?? ownStep;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  const navigate = (next: DiscoveryStep) => { setOwnStep(next); onStepChange?.(next); };
  const problem = PROBLEMS.find((item) => item.id === context.problemId);
  const selected = step === "problem" ? context.problemId : step === "goal" ? context.goalId : context[step];
  const canContinue = !!selected || (step === "problem" && somethingElse);
  const choices = step === "problem" ? PROBLEMS : step === "goal" ? problem?.goals ?? [] : step === "scale" ? SCALES : PRIORITIES;
  const stepNumber = ["problem", "goal", "scale", "priority"].indexOf(step) + 1;
  const select = (id: string) => {
    if (step === "problem") {
      setSomethingElse(false);
      onChange({ ...context, problemId: PROBLEMS.find((item) => item.id === id)!.id,
        goalId: id === context.problemId ? context.goalId : null });
    } else if (step === "goal") onChange({ ...context, goalId: id });
    else if (step === "scale") onChange({ ...context, scale: SCALES.find((item) => item.id === id)!.id });
    else onChange({ ...context, priority: PRIORITIES.find((item) => item.id === id)!.id });
  };
  const next = () => {
    if (!canContinue) return;
    if (step === "problem") navigate(problem ? "goal" : "scale");
    else if (step === "goal") navigate("scale");
    else if (step === "scale") navigate("priority");
    else onExplore();
  };
  const back = () => navigate(step === "priority" ? "scale" : step === "scale" && problem ? "goal" : "problem");
  return <section className="discovery-flow" aria-labelledby="discovery-question">
    <div className="question-row">
      <div className="question-copy">
        <p className="question-position">Question {stepNumber} of 4{!problem && step !== "problem" ? " · Goal skipped for Something else" : ""}</p>
        <h1 id="discovery-question" ref={heading} tabIndex={-1}>{questions[step]}</h1>
        <p className="question-description">{descriptions[step]}</p>
      </div>
      <XappyGuide text={guidanceFor(context, step)} />
    </div>
    <div className="choice-panel">
      <fieldset className={`choice-grid ${step === "problem" ? "problem-grid" : "chip-grid"}`}>
        <legend className="sr-only">{questions[step]}</legend>
        {choices.map((choice, index) => <button key={choice.id} type="button" className="choice" aria-label={choice.label}
          aria-pressed={selected === choice.id} onClick={() => select(choice.id)}>
          {step === "problem" ? <span className="choice-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span> : null}
          <span className="choice-content"><span className="choice-title">{choice.label}</span>
            {step === "problem" ? <span className="choice-description" aria-hidden="true">{categoryHints[index]}</span> : null}
          </span>
          <span className="choice-check" aria-hidden="true">{selected === choice.id ? "✓" : "+"}</span>
        </button>)}
      </fieldset>
      {step === "problem" ? <div className="other-choice">
        <button className="button button-quiet" type="button" aria-pressed={somethingElse} onClick={() => {
          setSomethingElse(true); onChange({ ...context, problemId: null, goalId: null });
        }}>Something else</button>
        <p>Have a different challenge? You can keep it open.</p>
      </div> : null}
      {step === "problem" && somethingElse ? <div className="optional-note">
        <label htmlFor="discovery-note">Optional context</label>
        <p id="note-help">A few words are enough, or continue without typing. Don't include personal or confidential information.</p>
        <textarea id="discovery-note" rows={3} maxLength={MAX_NOTE_LENGTH} aria-describedby="note-help note-count" value={context.note}
          onChange={(event) => onChange({ ...context, note: event.target.value.slice(0, MAX_NOTE_LENGTH) })} />
        <span id="note-count" className="character-count">{context.note.length} / {MAX_NOTE_LENGTH} characters</span>
      </div> : null}
      <div className="flow-footer">
        <div>{step !== "problem" ? <button className="button button-secondary" type="button" onClick={back}>Back</button> : <span className="small-note">No typing required</span>}</div>
        <div className="next-action">
          {!canContinue ? <p id="continue-help">{step === "problem" ? "Choose a problem or Something else to continue." : `Choose a ${step} to continue.`}</p> : null}
          <button className="button button-primary" type="button" disabled={!canContinue} aria-describedby={!canContinue ? "continue-help" : undefined} onClick={next}>
            {step === "priority" ? "Explore solutions" : "Continue"}<span aria-hidden="true"> →</span>
          </button>
        </div>
      </div>
    </div>
  </section>;
}
