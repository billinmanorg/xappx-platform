import type { Variants } from "framer-motion";

// Reusable motion system. Durations mirror the token scale (Section 6). All
// entrances start from a *visible-ish* resting state and only translate/fade a
// little, so the page reads correctly at rest and for reduced-motion users.

export const EASE = [0.16, 1, 0.3, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

export const stagger = (gap = 0.08, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: EASE } },
};

// Standard viewport trigger for scroll-in sections.
export const inView = { once: true, amount: 0.3 } as const;
