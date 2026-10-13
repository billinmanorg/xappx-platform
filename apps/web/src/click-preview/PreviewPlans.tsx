import { PREVIEW_PLANS } from "./previewPlans";
import { XappyGuide } from "./XappyGuide";

export interface PreviewPlansProps { onBack: () => void }

export function PreviewPlans({ onBack }: PreviewPlansProps): JSX.Element {
  return <section className="preview-plans" aria-labelledby="plans-title">
    <button className="button button-quiet back-link" type="button" onClick={onBack}>Return to preview</button>
    <div className="question-row">
      <div className="question-copy"><p className="proposed-label">Proposed pricing · Subject to approval</p>
        <h1 id="plans-title" tabIndex={-1}>Proposed plans</h1>
        <p className="question-description">Compare a possible next step for your team. Your sample result and records are preserved for read-only inspection.</p>
      </div>
      <XappyGuide text="These monthly USD prices and limits are concepts for review. You can compare the proposed plans, then return to your sample whenever you're ready." />
    </div>
    <div className="plan-grid">{PREVIEW_PLANS.map((plan) => <article className="plan-card" key={plan.id} aria-labelledby={`plan-${plan.id}`}>
      <h2 id={`plan-${plan.id}`}>{plan.name}</h2>
      <p className="plan-price"><strong>${plan.monthlyUsd}</strong><span>USD / month</span></p>
      <ul aria-label={`${plan.name} proposed limits`}><li>{plan.activeApps} active {plan.activeApps === 1 ? "app" : "apps"}</li><li>{plan.editors} editors</li></ul>
      <p className="small-note">Proposed monthly subscription</p>
      <button className="button button-secondary" type="button" disabled aria-describedby="checkout-explanation">Checkout unavailable<span className="sr-only"> for {plan.name}</span></button>
    </article>)}</div>
    <div className="checkout-boundary"><h2>Comparison only</h2><p id="checkout-explanation">Checkout is not connected in this preview. These proposed prices and limits are not approved commercial offers. No payment or subscription can be started here.</p></div>
  </section>;
}
