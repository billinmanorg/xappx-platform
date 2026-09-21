import { useState } from "react";
import { classifyComplexity, type PlanId } from "./plans";
import { getLeadService, type LeadPayload } from "./leadService";
import type { SolutionDiscovery } from "./types";
import "./commerce.css";

const svc = getLeadService();
const TITLES: Record<PlanId, { title: string; sub: string }> = {
  standard: { title: "Start your build", sub: "Tell us where to send your project quote — with everything you've defined already attached." },
  advanced: { title: "Talk to a solution expert", sub: "A XAPPX expert will walk through your requirements — with your discovery already in hand." },
  custom: { title: "Request a custom proposal", sub: "We'll scope a bespoke engagement from the discovery you've completed." },
};
const emailOk = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export function LeadForm({ d, plan, onBack, onRestart }: { d: SolutionDiscovery; plan: PlanId; onBack: () => void; onRestart: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const t = TITLES[plan];
  const valid = name.trim().length >= 2 && emailOk(email) && company.trim().length >= 2;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true); setErr(null);
    const payload: LeadPayload = {
      name: name.trim(), email: email.trim(), company: company.trim(), message: message.trim() || undefined,
      plan, complexity: classifyComplexity(d),
      industry: d.industry?.label, challenge: d.challenge ?? undefined,
      stakeholders: d.stakeholders, outcomes: d.outcomes, blueprintName: d.blueprint?.solutionName,
      submittedAt: Date.now(),
    };
    try {
      const r = await svc.submit(payload);
      if (r.ok) setDone(true); else setErr("Something went wrong. Please try again.");
    } catch { setErr("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="cm">
        <div className="cm__done">
          <div className="cm__done-badge">✓</div>
          <h1 className="build__q">Thanks, {name.trim().split(" ")[0]} — we've got it.</h1>
          <p className="build__sub">A XAPPX solution expert will reach out about your <b>{d.industry?.label}</b> build. They already have your blueprint, so you won't repeat yourself.</p>
          <button className="btn btn-ghost" onClick={onRestart}>Design another solution</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cm">
      <p className="eyebrow">{t.title}</p>
      <h1 className="build__q">{t.title}</h1>
      <p className="build__sub">{t.sub}</p>

      <div className="cm__lead">
        <form className="cm__form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className="cm__field"><span>Your name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
          <label className="cm__field"><span>Work email</span><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
            {email.length > 0 && !emailOk(email) && <em className="cm__err">Enter a valid email.</em>}</label>
          <label className="cm__field"><span>Company</span><input value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" /></label>
          <label className="cm__field"><span>Anything to add? <i>(optional)</i></span><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} /></label>
          {err && <p className="cm__err">{err}</p>}
          <button className="btn btn-primary" type="submit" disabled={!valid || busy}>{busy ? "Sending…" : "Send to a solution expert →"}</button>
          <p className="cm__trust">Your information is only used to design and scope your solution.</p>
        </form>

        <aside className="cm__context">
          <div className="cm__context-h">What we'll send with your request</div>
          <dl>
            <dt>Plan</dt><dd>{t.title}</dd>
            <dt>Industry</dt><dd>{d.industry?.label || "—"}</dd>
            <dt>Challenge</dt><dd>{d.challenge || "—"}</dd>
            <dt>Users</dt><dd>{d.stakeholders.join(", ") || "—"}</dd>
            <dt>Outcomes</dt><dd>{d.outcomes.join(", ") || "—"}</dd>
            {d.blueprint && <><dt>Blueprint</dt><dd>{d.blueprint.solutionName}</dd></>}
          </dl>
        </aside>
      </div>

      <div className="cm__foot">
        <button className="btn btn-ghost" onClick={onBack}>← Back to plans</button>
      </div>
    </div>
  );
}
