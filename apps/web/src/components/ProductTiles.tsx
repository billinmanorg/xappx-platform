import { motion } from "framer-motion";
import { fadeUp, stagger, inView } from "../lib/motion";
import app from "../assets/tiles/app.webp";
import agents from "../assets/tiles/agents.webp";
import data from "../assets/tiles/data.webp";
import tokenization from "../assets/tiles/tokenization.webp";
import network from "../assets/tiles/network.webp";
import interfaces from "../assets/tiles/interfaces.webp";
import "./ProductTiles.css";

const TILES = [
  { img: app, lab: "Custom Apps", h3: "Your App", p: "Software built around your business instead of the other way around." },
  { img: agents, lab: "AI Agents", h3: "Your AI Team", p: "Agents that answer, research, follow up, organize, sell, and support across your tools." },
  { img: data, lab: "Data Vaults", h3: "Your Data", p: "Give AI what it needs to help you while keeping control of valuable information." },
  { img: tokenization, lab: "Tokenization", h3: "Your Digital Economy", p: "Add ownership, access, rewards, or membership to the right product or community." },
  { img: network, lab: "AI-to-AI", h3: "Your Intelligence Network", p: "Let approved AI systems coordinate work, exchange services, and complete authorized transactions." },
  { img: interfaces, lab: "Interfaces", h3: "Anywhere Your Customers Are", p: "Web. Mobile. Messaging. Avatars. Voice. Holograms. Robots. Immersive worlds." },
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
              <div className="tile__viz">
                <img src={t.img} alt="" loading="lazy" decoding="async" />
              </div>
              <div className="tile__body">
                <span className="tile__lab">{t.lab}</span>
                <h3 className="tile__h3">{t.h3}</h3>
                <p className="tile__p text-dim">{t.p}</p>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
