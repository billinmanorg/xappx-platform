import { motion } from "framer-motion";
import { fadeUp, stagger, inView } from "../lib/motion";
import "./IndustryEntry.css";

// Curated marketing subset of the platform's industry taxonomy. Each links into
// the builder with the industry pre-selected (Section 33/49) — /build lands in a
// later phase; the deep-link contract is set now so it just works when it ships.
const INDUSTRIES = [
  ["financial_services", "Financial Services"],
  ["healthcare", "Healthcare"],
  ["retail", "Retail"],
  ["manufacturing", "Manufacturing"],
  ["logistics", "Logistics"],
  ["real_estate", "Real Estate"],
  ["education", "Education"],
  ["tourism_hospitality", "Hospitality"],
  ["services", "Professional Services"],
  ["it_bpm", "Technology"],
];

export function IndustryEntry() {
  return (
    <section className="ind section" id="industries">
      <div className="container">
        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="show" viewport={inView} className="ind__head">
          <motion.p className="eyebrow" variants={fadeUp}>Start where you work</motion.p>
          <motion.h2 variants={fadeUp}>Pick your industry — XAPPX already knows its problems.</motion.h2>
        </motion.div>

        <motion.div className="ind__grid" variants={stagger(0.05)} initial="hidden" whileInView="show" viewport={inView}>
          {INDUSTRIES.map(([slug, label]) => (
            <motion.a className="ind__card" key={slug} href={`/build?industry=${slug}`} variants={fadeUp}>
              <span className="ind__label">{label}</span>
              <span className="ind__go" aria-hidden="true">→</span>
            </motion.a>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
