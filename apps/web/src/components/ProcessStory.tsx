import { motion } from "framer-motion";
import { fadeUp, stagger, inView } from "../lib/motion";
import "./ProcessStory.css";

const STEPS = [
  { n: "01", t: "Tell us your industry", d: "Pick from a searchable list. XAPPX loads what it already knows about your world." },
  { n: "02", t: "Identify the challenge", d: "We suggest the real problems businesses like yours face — you just choose." },
  { n: "03", t: "Understand people & process", d: "XAPPX infers who's involved and how the work flows, so you don't have to spell it out." },
  { n: "04", t: "AI designs the solution", d: "A clear blueprint: the workflow, the roles, and where AI does the heavy lifting." },
  { n: "05", t: "Explore your prototype", d: "A working preview you can click through — proof we understood, before anything is built." },
];

export function ProcessStory() {
  return (
    <section className="story section" id="how">
      <div className="container">
        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="show" viewport={inView} className="story__head">
          <motion.p className="eyebrow" variants={fadeUp}>From problem to prototype</motion.p>
          <motion.h2 variants={fadeUp}>You describe the problem. XAPPX builds toward the solution — in front of you.</motion.h2>
        </motion.div>

        <motion.ol className="story__track" variants={stagger(0.1)} initial="hidden" whileInView="show" viewport={inView}>
          {STEPS.map((s) => (
            <motion.li className="story__step" key={s.n} variants={fadeUp}>
              <div className="story__node"><span>{s.n}</span></div>
              <h3 className="story__t">{s.t}</h3>
              <p className="story__d text-dim">{s.d}</p>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}
