import { motion } from "framer-motion";
import { fadeUp, stagger, inView } from "../lib/motion";
import xappxShot from "../assets/usecases/xappx.webp";
import hiringShot from "../assets/usecases/hiringpulse.webp";
import "./UseCases.css";

type App = {
  name: string;
  cat: string;        // category eyebrow
  desc: string;
  img?: string;       // screenshot; gradient placeholder when absent
  href?: string;      // outbound link; "Link coming" note when absent (and not soon)
  cta?: string;       // link label
  accent?: string;    // placeholder tint
  soon?: boolean;     // coming-soon card
};

// "Live apps, not concepts" — real, running apps built by the team. Each links
// out to the live site. (Prototype/concept demos are intentionally NOT here.)
const APPS: App[] = [
  {
    name: "XAPPX", cat: "AI Guide · Agents · Tokenization", img: xappxShot, href: "/build", cta: "Open XAPPX ↗",
    desc: "Describe the app you want to a guide named XAPPY and it turns the idea into a build plan — no technical spec required.",
  },
  {
    name: "Magic Confidence Quest", cat: "Gamified Learning · Rewards", cta: "Try the free lessons ↗", accent: "#8A73FF",
    desc: "Kids learn real magic tricks and build public-speaking confidence across 80 challenges, with a parent progress report. Built for KidsDoMagic.",
  },
  {
    name: "San Diego Home Buyers", cat: "Real Estate · Lead Capture", cta: "Open the site ↗", accent: "#2bd4a8",
    desc: "Walks a visitor from browsing listings to a pre-approval letter — affordability calculator, text alerts, English and Spanish — and routes every step to the agent.",
  },
  {
    name: "HiringPulse", cat: "Recruitment · AI Hiring", img: hiringShot, href: "https://hiringpulse.in", cta: "Open the site ↗",
    desc: "One platform for hiring and getting hired — AI-matched roles and candidates across 10+ industries.",
  },
  {
    name: "Events platform", cat: "Events", accent: "#e0a93f", soon: true,
    desc: "AI-assisted event experiences on the platform — registration, engagement and follow-up.",
  },
];

export function UseCases() {
  return (
    <section className="ucs section" id="use-cases">
      <div className="container">
        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="show" viewport={inView} className="ucs__head">
          <motion.p className="eyebrow" variants={fadeUp}>Apps we've built</motion.p>
          <motion.h2 variants={fadeUp}>Live apps, not concepts.</motion.h2>
          <motion.p className="lede ucs__lede" variants={fadeUp}>
            Built by our team and running today. Open them, try them, and picture what we could build for you.
          </motion.p>
        </motion.div>

        <motion.div className="ucs__grid" variants={stagger(0.06)} initial="hidden" whileInView="show" viewport={inView}>
          {APPS.map((a) => (
            <motion.article className="uc" key={a.name} variants={fadeUp}>
              <div className="uc__shot">
                {a.img
                  ? <img src={a.img} alt={`${a.name} screenshot`} loading="lazy" decoding="async" />
                  : <span className="uc__ph" style={{ ["--c" as string]: a.accent ?? "#2f7bff" }}>{a.name}</span>}
                {a.soon && <span className="uc__soon">Coming soon</span>}
              </div>
              <div className="uc__body">
                <span className="uc__cat">{a.cat}</span>
                <h3 className="uc__name">{a.name}</h3>
                <p className="uc__desc text-dim">{a.desc}</p>
                {a.soon
                  ? null
                  : a.href
                    ? <a className="uc__link" href={a.href} target={a.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{a.cta ?? "Open the site ↗"}</a>
                    : <span className="uc__pending">Link coming soon</span>}
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
