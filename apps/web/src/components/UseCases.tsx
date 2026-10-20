import { motion } from "framer-motion";
import { fadeUp, stagger, inView } from "../lib/motion";
import "./UseCases.css";

type UseCase = { name: string; mono: string; tag: string; desc: string; accent: string; href?: string };

// Apps & experiences built on the platform + the Twin Vault. Live ones link
// out; the rest are labelled concept previews (their own sites mark them as
// prototypes / fictional data), so we don't present them as shipping products.
const CASES: UseCase[] = [
  {
    name: "HiringPulse", mono: "HP", tag: "Recruitment", accent: "#00C2FF",
    desc: "A smart recruitment platform that turns hiring into better, AI-assisted conversations.",
    href: "https://hiringpulse.in",
  },
  {
    name: "Twin Vault", mono: "TV", tag: "Personal data", accent: "#2bd4a8",
    desc: "Your secure personal data vault — you own your files and decide exactly what AI can use.",
    href: "https://vault.twns.ai",
  },
  {
    name: "Twinder", mono: "Tw", tag: "Dating & connection", accent: "#ff5e8a",
    desc: "Let your AI twin break the ice — it opens on shared interests, and you decide where it goes.",
  },
  {
    name: "The Light", mono: "TL", tag: "Community & events", accent: "#e0a93f",
    desc: "A membership community and global event experience where your personal Vault always stays yours.",
  },
  {
    name: "Job by TWIN", mono: "J", tag: "Careers", accent: "#2f7bff",
    desc: "A careers platform where candidates own their evidence and AI makes better introductions — human review first.",
  },
  {
    name: "Natasha Graziano", mono: "N", tag: "Creator membership", accent: "#8A73FF",
    desc: "A creator membership experience — explore the library, talk to Natasha's Twin, keep your journey in a personal Vault.",
  },
];

export function UseCases() {
  return (
    <section className="ucs section" id="use-cases">
      <div className="container">
        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="show" viewport={inView} className="ucs__head">
          <motion.p className="eyebrow" variants={fadeUp}>Use cases</motion.p>
          <motion.h2 variants={fadeUp}>Already being built on the platform.</motion.h2>
          <motion.p className="lede ucs__lede" variants={fadeUp}>
            A growing ecosystem of apps and experiences — from hiring to events to creator membership —
            all powered by XAPPX and your own Twin Vault.
          </motion.p>
        </motion.div>

        <motion.div className="ucs__grid" variants={stagger(0.06)} initial="hidden" whileInView="show" viewport={inView}>
          {CASES.map((c) => (
            <motion.article className="uc" key={c.name} variants={fadeUp}>
              <div className="uc__top">
                <span className="uc__mono" style={{ ["--c" as string]: c.accent }}>{c.mono}</span>
                <div className="uc__id">
                  <h3 className="uc__name">{c.name}</h3>
                  <span className="uc__tag">{c.tag}</span>
                </div>
              </div>
              <p className="uc__desc text-dim">{c.desc}</p>
              <div className="uc__foot">
                {c.href
                  ? <a className="uc__link" href={c.href} target="_blank" rel="noopener noreferrer">Visit site ↗</a>
                  : <span className="uc__badge">Concept preview</span>}
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
