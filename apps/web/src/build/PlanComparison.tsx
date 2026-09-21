import { PLANS, classifyComplexity, type PlanId } from "./plans";
import type { SolutionDiscovery } from "./types";
import "./commerce.css";

export function PlanComparison({ d, onChoose, onBack }: { d: SolutionDiscovery; onChoose: (id: PlanId) => void; onBack: () => void }) {
  const recommended = classifyComplexity(d);
  return (
    <div className="cm">
      <p className="eyebrow">Ready to make it real?</p>
      <h1 className="build__q">Turn this into a complete solution.</h1>
      <p className="build__sub">
        You've explored the initial concept and blueprint. The next step is a solution designed, built,
        and deployed for your organization by XAPPX experts.
      </p>

      <div className="cm__plans">
        {PLANS.map((p) => (
          <div className={"cm__plan" + (p.id === recommended ? " cm__plan--rec" : "")} key={p.id}>
            {p.id === recommended && <span className="cm__rec">Recommended for you</span>}
            <h3 className="cm__plan-name">{p.name}</h3>
            <p className="cm__plan-tag">{p.tagline}</p>
            <p className="cm__plan-price">{p.priceLabel}</p>
            <ul className="cm__plan-inc">
              {p.includes.map((i) => <li key={i}>{i}</li>)}
            </ul>
            <button className={"btn " + (p.id === recommended ? "btn-primary" : "btn-ghost")} onClick={() => onChoose(p.id)}>{p.cta}</button>
          </div>
        ))}
      </div>

      <div className="cm__foot">
        <button className="btn btn-ghost" onClick={onBack}>← Back to prototype</button>
        <p className="cm__note">Final pricing is confirmed with your XAPPX solution expert based on your scope.</p>
      </div>
    </div>
  );
}
