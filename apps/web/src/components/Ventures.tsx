import { motion } from "framer-motion";
import { fadeUp, stagger, inView } from "../lib/motion";
import "./Ventures.css";

const VENTURES = [
  { img: "angel-twin", cls: "icon", lab: "Angel Twin · AI Twins", p: "AI Twins that engage your audience 24/7 — and that people own, govern, and monetize themselves." },
  { img: "ai-fi", cls: "", lab: "AI Fi · AI Payments", p: "Agentic payment rails so AI agents and people can transact autonomously." },
  { img: "chainge", cls: "", lab: "CHAINGE · AI Media", p: "An AI-native media brand producing original shows on the rise of AI." },
];

export function Ventures() {
  return (
    <section className="ven section" id="ventures">
      <div className="container">
        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="show" viewport={inView} className="ven__head">
          <motion.p className="eyebrow" variants={fadeUp}>Proof, not promises</motion.p>
          <motion.h2 variants={fadeUp}>See what this team has already built.</motion.h2>
          <motion.p className="lede ven__lede" variants={fadeUp}>
            XAPPX is built by the people behind these ventures — the same thinking now goes into what we build for you.
          </motion.p>
        </motion.div>

        <motion.div className="ven__grid" variants={stagger(0.08)} initial="hidden" whileInView="show" viewport={inView}>
          {VENTURES.map((v) => (
            <motion.article className="ven__card" key={v.img} variants={fadeUp}>
              <div className="ven__plate">
                <img className={"ven__logo " + v.cls} src={`/brand/${v.img}.webp`} alt={v.lab.split(" · ")[0] + " logo"} loading="lazy" decoding="async" />
              </div>
              <div className="ven__body">
                <span className="ven__lab">{v.lab}</span>
                <p className="ven__p text-dim">{v.p}</p>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
