import { motion } from "framer-motion";
import { fadeUp, stagger } from "../lib/motion";
import { HeroVideoCarousel } from "./HeroVideoCarousel";
import { MicButton } from "./MicButton";
import "./Hero.css";

/** Voice entry: the spoken problem is handed to /build through session storage, never the URL. */
function startFromVoice(text: string) {
  try { sessionStorage.setItem("xappx_voice_problem", text); } catch { /* ignore */ }
  window.location.href = "/build";
}

export function Hero() {
  return (
    <section className="hero" id="top">
      <div className="container hero__in">
        <motion.div className="hero__copy" variants={stagger(0.1)} initial="hidden" animate="show">
          <motion.p className="eyebrow" variants={fadeUp}>AI-native solution studio</motion.p>
          <motion.h1 className="hero__title" variants={fadeUp}>
            Turn a business problem into an <span>AI solution</span>.
          </motion.h1>
          <motion.p className="lede hero__lede" variants={fadeUp}>
            Tell XAPPX what isn't working. We help identify the opportunity, design the
            solution, and generate an intelligent working prototype. No tech knowledge needed.
          </motion.p>
          <motion.div className="hero__cta" variants={fadeUp}>
            <a className="btn btn-primary" href="/build">Build my solution</a>
            <a className="btn btn-ghost" href="#how">See how it works</a>
          </motion.div>
          <motion.div className="hero__voice" variants={fadeUp}>
            <MicButton size="lg" label="Or just tell XAPPY what isn't working" onText={startFromVoice} />
          </motion.div>
          <motion.p className="hero__trust" variants={fadeUp}>
            Your description is used only to design your solution. Every build is reviewed by XAPPX experts.
          </motion.p>
        </motion.div>

        <motion.div
          className="hero__demo"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        >
          <HeroVideoCarousel />
        </motion.div>
      </div>
    </section>
  );
}
