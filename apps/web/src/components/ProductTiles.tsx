import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { fadeUp, stagger, inView } from "../lib/motion";
import "./ProductTiles.css";

const S = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const ICONS: Record<string, ReactNode> = {
  app: <svg {...S}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /><path d="M7 6.5h.01M9.5 6.5h.01" /></svg>,
  agents: <svg {...S}><rect x="3" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="4" width="7" height="7" rx="1.5" /><rect x="8.5" y="13" width="7" height="7" rx="1.5" /></svg>,
  data: <svg {...S}><path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" /><path d="M9.5 12l1.8 1.8L15 10" /></svg>,
  tokenization: <svg {...S}><circle cx="9" cy="9" r="5" /><circle cx="15" cy="15" r="5" /></svg>,
  network: <svg {...S}><circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="M7 6h10M6.2 7.7l4.6 8.6M17.8 7.7l-4.6 8.6" /></svg>,
  interfaces: <svg {...S}><rect x="2" y="5" width="13" height="9" rx="1.5" /><path d="M6 18h6" /><rect x="17" y="8" width="5" height="11" rx="1.5" /></svg>,
};

const TILES = [
  { img: "app", lab: "Custom Apps", h3: "Your App", p: "Software built around your business instead of the other way around." },
  { img: "agents", lab: "AI Agents", h3: "Your AI Team", p: "Agents that answer, research, follow up, organize, sell, and support across your tools." },
  { img: "data", lab: "Data Vaults", h3: "Your Data", p: "Give AI what it needs to help you while keeping control of valuable information." },
  { img: "tokenization", lab: "Tokenization", h3: "Your Digital Economy", p: "Add ownership, access, rewards, or membership to the right product or community." },
  { img: "network", lab: "AI-to-AI", h3: "Your Intelligence Network", p: "Let approved AI systems coordinate work, exchange services, and complete authorized transactions." },
  { img: "interfaces", lab: "Interfaces", h3: "Anywhere Your Customers Are", p: "Web. Mobile. Messaging. Avatars. Voice. Holograms. Robots. Immersive worlds." },
];

export function ProductTiles() {
  return (
    <section className="tiles section" id="build-blocks">
      <div className="container">
        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="show" viewport={inView} className="tiles__head">
          <motion.p className="eyebrow" variants={fadeUp}>What you can build</motion.p>
          <motion.h2 variants={fadeUp}>You can build more than you think.</motion.h2>
          <motion.p className="lede tiles__lede" variants={fadeUp}>
            Start with the outcome you want. XAPPX figures out which of these gets you there.
          </motion.p>
        </motion.div>

        <motion.div className="tiles__grid" variants={stagger(0.06)} initial="hidden" whileInView="show" viewport={inView}>
          {TILES.map((t) => (
            <motion.article className="tile" key={t.img} variants={fadeUp}>
              <div className="tile__ic">{ICONS[t.img]}</div>
              <span className="tile__lab">{t.lab}</span>
              <h3 className="tile__h3">{t.h3}</h3>
              <p className="tile__p text-dim">{t.p}</p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
