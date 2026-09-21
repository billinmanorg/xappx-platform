import { motion } from "framer-motion";
import { fadeUp, stagger, inView } from "../lib/motion";
import "./WhyXappx.css";

const LAYERS = [
  { t: "XAPPX AI", d: "Understands your challenge, maps the people and process, and designs the solution." },
  { t: "Domain intelligence", d: "Structured, industry-specific knowledge — so the solution fits how your business actually works." },
  { t: "XAPPX experts", d: "Real engineers who take the design to a secure, integrated, production-ready build." },
];

const GENERIC = ["Prompt", "Generate"];
const XAPPX = ["Business context", "Problem discovery", "Stakeholder mapping", "Workflow design", "AI solution", "Prototype", "Expert build"];

export function WhyXappx() {
  return (
    <section className="why section" id="why">
      <div className="container">
        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="show" viewport={inView} className="why__head">
          <motion.p className="eyebrow" variants={fadeUp}>Why XAPPX is different</motion.p>
          <motion.h2 variants={fadeUp}>AI speed. Human expertise. Production-ready thinking.</motion.h2>
          <motion.p className="lede why__lede" variants={fadeUp}>
            Generic AI builders jump from a prompt to a guess. XAPPX understands the business first —
            then engineers something real.
          </motion.p>
        </motion.div>

        <motion.div className="why__layers" variants={stagger(0.1)} initial="hidden" whileInView="show" viewport={inView}>
          {LAYERS.map((l, i) => (
            <motion.div className="why__layer" key={l.t} variants={fadeUp}>
              <span className="why__num">{i + 1}</span>
              <h3>{l.t}</h3>
              <p className="text-dim">{l.d}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div className="why__compare" variants={fadeUp} initial="hidden" whileInView="show" viewport={inView}>
          <div className="why__col why__col--muted">
            <div className="why__col-label">Generic AI builder</div>
            <div className="why__chain">
              {GENERIC.map((g, i) => (
                <span className="why__pill" key={g}>{g}{i < GENERIC.length - 1 && <em>→</em>}</span>
              ))}
            </div>
          </div>
          <div className="why__col why__col--accent">
            <div className="why__col-label">The XAPPX journey</div>
            <div className="why__chain">
              {XAPPX.map((g, i) => (
                <span className="why__pill why__pill--on" key={g}>{g}{i < XAPPX.length - 1 && <em>→</em>}</span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
