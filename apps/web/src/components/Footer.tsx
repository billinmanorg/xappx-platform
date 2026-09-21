import { motion } from "framer-motion";
import { fadeUp, inView } from "../lib/motion";
import "./Footer.css";

const SITE = ""; // same-domain deploy — legal pages ship in this app's public/ folder

export function Footer() {
  return (
    <>
      <section className="cta section" id="build">
        <div className="container cta__in">
          <motion.h2 variants={fadeUp} initial="hidden" whileInView="show" viewport={inView}>
            So — what do you want to build?
          </motion.h2>
          <motion.p className="lede cta__lede" variants={fadeUp} initial="hidden" whileInView="show" viewport={inView}>
            Describe the problem in plain words. XAPPX takes it from there.
          </motion.p>
          <motion.div className="cta__row" variants={fadeUp} initial="hidden" whileInView="show" viewport={inView}>
            <a className="btn btn-primary" href="/build">Build my solution</a>
            <a className="btn btn-ghost" href="#how">See how it works</a>
          </motion.div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer__in">
          <a className="footer__logo" href="#top">X<span>APP</span>X</a>
          <nav className="footer__links" aria-label="Footer">
            <a href="#how">How it works</a>
            <a href="#industries">Industries</a>
            <a href="#why">Why XAPPX</a>
            <a href={`${SITE}/privacy.html`}>Privacy</a>
            <a href={`${SITE}/terms.html`}>Terms</a>
          </nav>
          <p className="footer__legal">© {new Date().getFullYear()} XAPPX Inc. · Las Vegas, Nevada</p>
        </div>
      </footer>
    </>
  );
}
