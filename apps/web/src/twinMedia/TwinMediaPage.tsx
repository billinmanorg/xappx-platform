import { useEffect } from "react";
import { motion } from "framer-motion";
import { fadeUp, stagger, inView } from "../lib/motion";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { MediaMock } from "../solutions/mocks";
import { ContactSection } from "../solutions/SolutionsPage";
import "../solutions/SolutionsPage.css";
import "./TwinMediaPage.css";

/**
 * /twin-media: the Twin Media product page (Bill, Nov 26). Video creation,
 * your AI twin on camera and the daily local podcast.
 */
export function TwinMediaPage() {
  useEffect(() => { document.title = "XAPPX · Twin Media"; }, []);

  return (
    <>
      <Nav />
      <main className="tm">
        <section className="tm__hero">
          <div className="container tm__hero-in">
            <motion.div variants={stagger(0.1)} initial="hidden" animate="show">
              <motion.p className="eyebrow" variants={fadeUp}>Twin Media</motion.p>
              <motion.h1 className="tm__title" variants={fadeUp}>Your business, on camera and on air, <span>every day</span>.</motion.h1>
              <motion.p className="lede tm__lede" variants={fadeUp}>
                Twin Media is the XAPPX production team plus XAPPY's agents. We make the videos, the podcasts and the AI version of you that keep your business visible, and we deliver all of it into your Twin Vault.
              </motion.p>
              <motion.div className="tm__cta" variants={fadeUp}>
                <a className="btn btn-primary" href="#contact" data-product="Twin Media">Request media</a>
                <a className="btn btn-ghost" href="#what">See what we make</a>
              </motion.div>
            </motion.div>
            <motion.div className="tm__visual" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}>
              <MediaMock />
            </motion.div>
          </div>
        </section>

        <section className="tm__what section" id="what">
          <div className="container">
            <motion.div variants={stagger(0.08)} initial="hidden" whileInView="show" viewport={inView}>
              <motion.p className="eyebrow" variants={fadeUp}>What we make</motion.p>
              <motion.h2 variants={fadeUp}>Three products. One request to start.</motion.h2>
            </motion.div>
            <motion.div className="tm__grid" variants={stagger(0.06)} initial="hidden" whileInView="show" viewport={inView}>
              {WHAT.map((w) => (
                <motion.article className="tm__card" key={w.title} variants={fadeUp}>
                  <span className="tm__card-n">{w.n}</span>
                  <h3>{w.title}</h3>
                  <p>{w.body}</p>
                  <ul>{w.points.map((p) => <li key={p}>{p}</li>)}</ul>
                </motion.article>
              ))}
            </motion.div>
          </div>
        </section>

        <section className="tm__how section">
          <div className="container tm__how-in">
            <motion.div variants={stagger(0.08)} initial="hidden" whileInView="show" viewport={inView}>
              <motion.p className="eyebrow" variants={fadeUp}>How it works</motion.p>
              <motion.h2 variants={fadeUp}>Ask once. Review. It's live.</motion.h2>
              <motion.ol className="tm__steps" variants={fadeUp}>
                <li><b>Tell us what you need.</b> A video, a podcast, your twin on camera, or all three. A short brief is enough; XAPPY asks the rest.</li>
                <li><b>We produce it.</b> Scripts, voice, visuals and edits by the XAPPX media team and XAPPY's agents. Your twin needs only a few photos and a short voice sample.</li>
                <li><b>You approve.</b> Nothing goes out until you say so. Daily pieces, like the podcast, run on a schedule you set and can pause any time.</li>
                <li><b>Delivered to your Vault.</b> Every finished piece lands in your Twin Vault, under your control, and posts to the channels you choose.</li>
              </motion.ol>
            </motion.div>
            <motion.figure className="xappy tm__xappy" variants={fadeUp} initial="hidden" whileInView="show" viewport={inView}>
              <img src="/xappy-face.png" alt="" width="40" height="40" />
              <figcaption><span className="xappy__who">XAPPY explains</span><p>Think of it as a media department that never sleeps. You decide what gets said; we handle the cameras, the microphones and the schedule.</p></figcaption>
            </motion.figure>
          </div>
        </section>

        <ContactSection defaultProduct="Twin Media" />
      </main>
      <Footer />
    </>
  );
}

const WHAT = [
  { n: "01", title: "Video creation", body: "Explainer, promo and social videos, scripted and produced for you.", points: ["Written from a short brief", "Edited, captioned and sized per channel", "Revisions until you approve"] },
  { n: "02", title: "Your AI twin on camera", body: "A video version of you, built from a few photos and a short voice sample, that presents your content without a shoot.", points: ["Looks and sounds like you", "Records new pieces in minutes", "You approve every script"] },
  { n: "03", title: "Daily local podcast", body: "A five-to-ten-minute podcast in your own voice about your market: weather, events, news and what it means for your customers.", points: ["Built for real estate first, works for any local business", "Posted automatically to the channels you choose", "Pause or edit any day"] },
];
