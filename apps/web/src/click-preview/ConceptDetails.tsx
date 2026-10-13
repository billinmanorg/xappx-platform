import { useEffect, useRef } from "react";
import type { CatalogSolution } from "./types";
import { XappyGuide } from "./XappyGuide";

export function ConceptDetails({ solution, onBack }: { solution: Extract<CatalogSolution, { buildStatus: "recommended-solution" }>; onBack: () => void }): JSX.Element {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [solution.id]);
  return <section className="concept-details" aria-labelledby="concept-title">
    <button className="button button-quiet back-link" type="button" onClick={onBack}>Back to recommendations</button>
    <div className="question-row">
      <div className="question-copy">
        <span className="build-status build-concept">Recommended solution</span>
        <h1 id="concept-title" tabIndex={-1} ref={heading}>{solution.title}</h1>
        <p className="question-description">{solution.benefit}</p>
      </div>
      <XappyGuide text="This is a concept to explore. These possible functions describe an idea, and aren't an implemented app in this preview." />
    </div>
    <div className="concept-panel">
      <div><h2>What this could help with</h2>
        <ul className="concept-functions">{solution.functions.map((item, index) => <li key={item}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{item}</li>)}</ul>
      </div>
      <div className="concept-boundary"><h2>Concept only</h2>
        <p>{solution.concept}</p>
        <p className="availability-note">There is no working app to launch for this concept.</p>
      </div>
    </div>
  </section>;
}
