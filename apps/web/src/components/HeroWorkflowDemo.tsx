import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import "./HeroWorkflowDemo.css";

/* The signature animation (Section 39/60): a business problem visibly becomes a
   structured, AI-designed prototype. Coded — no video dependency. It loops, and
   reduced-motion users see the fully-assembled final state. */

const STAGES = [
  "Understanding your challenge",
  "Mapping the workflow",
  "Identifying automation",
  "Designing the solution",
  "Prototype ready",
] as const;

const CONTEXT = [
  { k: "Industry", v: "Banking" },
  { k: "Process", v: "Loan approval" },
  { k: "Problem", v: "Processing delay" },
];
const ROLES = ["Applicant", "Loan officer", "Underwriter"];
const FLOW = ["Application", "Document check", "Risk review", "Human approval"];
const AI = ["Document extraction", "Missing-data detection", "Case prioritization"];

const layer = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

export function HeroWorkflowDemo() {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState(reduce ? 4 : 0);

  useEffect(() => {
    if (reduce) return;
    let t: number;
    const advance = () => {
      setStage((s) => {
        const next = s >= 4 ? 0 : s + 1;
        t = window.setTimeout(advance, next === 0 ? 1200 : next === 4 ? 3200 : 1650);
        return next;
      });
    };
    t = window.setTimeout(advance, 1400);
    return () => window.clearTimeout(t);
  }, [reduce]);

  return (
    <div
      className="demo"
      role="img"
      aria-label="Animated demonstration: XAPPX turns the problem 'loan approvals take 8 days' into a structured, AI-designed prototype."
    >
      <div className="demo__win" aria-hidden="true">
        <div className="demo__bar">
          <i /><i /><i />
          <span className="demo__url">xappx.com/build</span>
        </div>

        <div className="demo__body">
          {/* the problem, always present as the origin */}
          <div className="demo__prompt">
            <span className="demo__prompt-tag">You</span>
            <span>"Loan approvals take 8 days."</span>
          </div>

          {/* context extraction */}
          <AnimatePresence>
            {stage >= 1 && (
              <motion.div className="demo__context" variants={layer} initial="hidden" animate="show" exit="hidden">
                {CONTEXT.map((c) => (
                  <span className="demo__chip" key={c.k}><b>{c.k}</b>{c.v}</span>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* stakeholders */}
          <AnimatePresence>
            {stage >= 2 && (
              <motion.div className="demo__block" variants={layer} initial="hidden" animate="show" exit="hidden">
                <div className="demo__lbl">People involved</div>
                <div className="demo__roles">
                  {ROLES.map((r) => <span className="demo__role" key={r}>{r}</span>)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* workflow */}
          <AnimatePresence>
            {stage >= 3 && (
              <motion.div className="demo__block" variants={layer} initial="hidden" animate="show" exit="hidden">
                <div className="demo__lbl">Workflow</div>
                <div className="demo__flow">
                  {FLOW.map((f, i) => (
                    <span className="demo__step" key={f}>
                      {f}{i < FLOW.length - 1 && <em className="demo__arrow">→</em>}
                    </span>
                  ))}
                </div>
                <div className="demo__ai">
                  {AI.map((a) => <span className="demo__aibadge" key={a}>+ {a}</span>)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* assembled prototype */}
          <AnimatePresence>
            {stage >= 4 && (
              <motion.div className="demo__proto" variants={layer} initial="hidden" animate="show" exit="hidden">
                <div className="demo__proto-grid">
                  <span className="demo__tile demo__tile--wide" />
                  <span className="demo__tile" />
                  <span className="demo__tile" />
                  <span className="demo__tile demo__tile--tall" />
                  <span className="demo__tile" />
                </div>
                <div className="demo__ready">
                  <span className="demo__dot" /> Prototype ready
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* AI process rail */}
      <ol className="demo__rail" aria-hidden="true">
        {STAGES.map((s, i) => (
          <li key={s} className={i === stage ? "on" : i < stage ? "done" : ""}>
            <span className="demo__rail-dot" />{s}
          </li>
        ))}
      </ol>
    </div>
  );
}
