import { motion } from "framer-motion";
import { fadeUp, stagger, inView } from "../lib/motion";
import "./IndustryEntry.css";

// The verticals XAPPX is pursuing (Bill, Nov 10): each with a blurb, plus
// "Other" for everyone else. The full 40+ industry list still lives in the
// builder; "Other" opens that picker.
const INDUSTRIES: { slug: string; label: string; blurb: string }[] = [
  { slug: "events_conferences", label: "Events & Conferences", blurb: "Registration, check-in, sponsors, and the follow-up that never happens. Built on what we learned running live events." },
  { slug: "real_estate", label: "Real Estate", blurb: "Market intelligence for your area, a daily podcast in your voice, buyer follow-up, and listing pages." },
  { slug: "support_admin", label: "Support & Administration", blurb: "An AI twin and a Vault for every assistant and support team member, with a daily record of what got done." },
  { slug: "all", label: "Other", blurb: "Not on the list? XAPPX works across 40+ industries. Describe your problem and start there." },
];

export function IndustryEntry() {
  return (
    <section className="ind section" id="industries">
      <div className="container">
        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="show" viewport={inView} className="ind__head">
          <motion.p className="eyebrow" variants={fadeUp}>Start where you work</motion.p>
          <motion.h2 variants={fadeUp}>Pick your industry. XAPPX already knows its problems.</motion.h2>
        </motion.div>

        <motion.div className="ind__grid" variants={stagger(0.05)} initial="hidden" whileInView="show" viewport={inView}>
          {INDUSTRIES.map((i) => (
            <motion.a className="ind__card" key={i.slug} href={`/build?industry=${i.slug}`} variants={fadeUp}>
              <span className="ind__label">{i.label}</span>
              <span className="ind__blurb">{i.blurb}</span>
              <span className="ind__go" aria-hidden="true">Start here →</span>
            </motion.a>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
