import { motion } from "framer-motion";
import { fadeUp, stagger, inView } from "../lib/motion";
import "./VideoSection.css";

// A ready-to-fill video spot (brief §9/§10, per Narinder). When the real asset
// exists, set VIDEO_SRC (an .mp4 in public/, or swap the block for an embed)
// and POSTER; until then this shows a graceful placeholder — nothing depends on
// the final video.
const VIDEO_SRC = "";
const POSTER = "";

export function VideoSection() {
  return (
    <section className="vid section" id="watch">
      <div className="container">
        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="show" viewport={inView} className="vid__head">
          <motion.p className="eyebrow" variants={fadeUp}>See it in action</motion.p>
          <motion.h2 variants={fadeUp}>Watch XAPPX turn a problem into a solution.</motion.h2>
          <motion.p className="lede vid__lede" variants={fadeUp}>A short walkthrough of the journey — from your business problem to a working prototype.</motion.p>
        </motion.div>

        <motion.div className="vid__frame" variants={fadeUp} initial="hidden" whileInView="show" viewport={inView}>
          {VIDEO_SRC ? (
            <video className="vid__video" src={VIDEO_SRC} poster={POSTER || undefined} autoPlay muted loop playsInline />
          ) : (
            <div className="vid__ph" role="img" aria-label="Product walkthrough video — coming soon">
              <button className="vid__play" type="button" aria-label="Play (video coming soon)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
              </button>
              <span className="vid__cap">Product walkthrough</span>
              <span className="vid__soon">Video coming soon</span>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
