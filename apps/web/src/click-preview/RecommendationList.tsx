import { useEffect, useRef } from "react";
import { visibleRecommendations } from "./recommendations";
import type { CatalogSolution, Recommendation } from "./types";

interface RecommendationListProps {
  items: readonly Recommendation[];
  batch: number;
  onMore: () => void;
  onNoneFit: () => void;
  onSelect: (solution: CatalogSolution) => void;
}
export function RecommendationList({ items, batch, onMore, onNoneFit, onSelect }: RecommendationListProps): JSX.Element {
  const visible = visibleRecommendations(items, batch);
  const all = visibleRecommendations(items, Number.MAX_SAFE_INTEGER);
  const exhausted = visible.length >= all.length;
  const status = useRef<HTMLParagraphElement>(null);
  const previousBatch = useRef(batch);
  useEffect(() => {
    if (batch > previousBatch.current && exhausted) status.current?.focus();
    previousBatch.current = batch;
  }, [batch, exhausted]);
  const newlyShown = batch > 1 ? Math.max(0, visible.length - (batch - 1) * 3) : 0;
  if (visible.length === 0) return <div className="empty-state">
    <span className="empty-symbol" aria-hidden="true">↗</span>
    <h2>No catalog match yet</h2>
    <p>Our curated catalog doesn't cover every need. Your choices and optional notes are still here. Refine your goal or browse more broadly.</p>
    <button className="button button-primary" type="button" onClick={onNoneFit}>Refine your needs</button>
  </div>;
  return <>
    <div className="recommendation-grid">
      {visible.map(({ solution, reason }) => <article className="solution-card" key={solution.id} aria-labelledby={`solution-${solution.id}`}>
        <span className={`build-status ${solution.buildStatus === "working-preview" ? "build-working" : "build-concept"}`}>
          <span aria-hidden="true">{solution.buildStatus === "working-preview" ? "◈" : "◇"}</span>
          {solution.buildStatus === "working-preview" ? "Working preview" : "Recommended solution"}
        </span>
        <h2 id={`solution-${solution.id}`}>{solution.title}</h2>
        <p className="solution-benefit">{solution.benefit}</p>
        <ul className="solution-functions">{solution.functions.map((feature) => <li key={feature}>{feature}</li>)}</ul>
        <div className="solution-reason"><h3>Why it fits</h3><p>{reason}</p></div>
        <button className={`button ${solution.buildStatus === "working-preview" ? "button-primary" : "button-secondary"}`} type="button"
          aria-label={`${solution.buildStatus === "working-preview" ? "Launch preview" : "View concept"}: ${solution.title}`} onClick={() => onSelect(solution)}>
          {solution.buildStatus === "working-preview" ? "Launch preview" : "View concept"}<span aria-hidden="true"> ↗</span>
        </button>
      </article>)}
    </div>
    <div className="recommendation-footer">
      <p ref={status} tabIndex={-1} role="status" aria-live="polite" aria-atomic="true">
        {exhausted ? `Showing all ${visible.length} catalog options.` : `Showing ${visible.length} of ${all.length} catalog options.`}
        {newlyShown > 0 ? ` ${newlyShown} more option${newlyShown === 1 ? "" : "s"} revealed.` : ""}
      </p>
      <div className="button-row">
        {!exhausted ? <button className="button button-secondary" type="button" onClick={onMore}>Show more</button> : null}
        <button className="button button-quiet" type="button" onClick={onNoneFit}>None fit</button>
      </div>
    </div>
  </>;
}
