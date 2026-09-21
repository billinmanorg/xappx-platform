import { motion } from "framer-motion";
import { fadeUp, stagger, inView } from "../lib/motion";
import "./Founders.css";

const FOUNDERS = [
  {
    img: "bill", name: "Bill Inman", role: "Co-founder",
    bio: "Decentralized-AI pioneer, investor, and multi-exit entrepreneur with 25+ years building companies from concept to scale — and a patent holder in AI and blockchain.",
    chips: ["25+ years building companies", "Multi-exit founder", "AI & blockchain patents"],
  },
  {
    img: "narinder", name: "Narinder Kamra", role: "Co-founder",
    bio: "Founder & CEO of VDOIT Technologies, with 25+ years across AI/ML, Web3, blockchain, and cloud system integration — and a mentor with ASSOCHAM's National Startup Council.",
    chips: ["25+ years in tech", "Founder & CEO, VDOIT", "AI/ML · Web3 · Cloud"],
  },
];

export function Founders() {
  return (
    <section className="fnd section" id="founders">
      <div className="container">
        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="show" viewport={inView} className="fnd__head">
          <motion.p className="eyebrow" variants={fadeUp}>Who's behind XAPPX</motion.p>
          <motion.h2 variants={fadeUp}>Built by proven operators.</motion.h2>
          <motion.p className="lede fnd__lede" variants={fadeUp}>
            Not a first attempt. XAPPX comes from founders who have built, scaled, and shipped real AI products.
          </motion.p>
        </motion.div>

        <motion.div className="fnd__grid" variants={stagger(0.1)} initial="hidden" whileInView="show" viewport={inView}>
          {FOUNDERS.map((f) => (
            <motion.article className="fnd__card" key={f.img} variants={fadeUp}>
              <div className="fnd__top">
                <img className="fnd__photo" src={`/brand/${f.img}.webp`} alt={f.name} loading="lazy" decoding="async" />
                <div>
                  <h3 className="fnd__name">{f.name}</h3>
                  <div className="fnd__role">{f.role}</div>
                </div>
              </div>
              <p className="fnd__bio text-dim">{f.bio}</p>
              <div className="fnd__chips">
                {f.chips.map((c) => <span className="fnd__chip" key={c}>{c}</span>)}
              </div>
            </motion.article>
          ))}
        </motion.div>

        <motion.blockquote className="fnd__quote" variants={fadeUp} initial="hidden" whileInView="show" viewport={inView}>
          "AIs will not inherit the Earth alone. Humans will not evolve alone. The future belongs to those who learn to think together."
          <cite>— Bill Inman</cite>
        </motion.blockquote>
      </div>
    </section>
  );
}
