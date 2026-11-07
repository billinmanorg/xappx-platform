import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import "./HeroVideoCarousel.css";

/**
 * Hero video carousel: three short portrait (phone-screen) videos of the app,
 * shown in a phone frame. The visitor presses play once; when a video ends the
 * frame slides to the next one and keeps playing (with sound, since playback was
 * started by the visitor). After the last video it returns to the first and
 * waits. Arrows and dots allow jumping between videos at any time.
 *
 * Files live in public/videos (web-encoded H.264 720x1280, generated from the
 * originals with scripts/encode-hero-videos.md).
 */
const VIDEOS = [
  { src: "/videos/hero-1.mp4", poster: "/videos/hero-1.jpg", label: "Overview, part 1" },
  { src: "/videos/hero-2.mp4", poster: "/videos/hero-2.jpg", label: "Overview, part 2" },
  { src: "/videos/hero-3.mp4", poster: "/videos/hero-3.jpg", label: "Overview, part 3" },
];

export function HeroVideoCarousel() {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1); // slide direction for the animation
  const [playing, setPlaying] = useState(false); // true once the visitor pressed play; drives autoplay of the next clip
  // Two <video> elements coexist for ~450 ms during the slide (the old one is
  // animating out), so the ref must only ever point at the newest one and must
  // not be reset to null when the old one unmounts.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const setVideoRef = (el: HTMLVideoElement | null) => {
    if (el) videoRef.current = el;
  };

  const go = useCallback(
    (next: number, keepPlaying: boolean) => {
      setDir(next > index || (index === VIDEOS.length - 1 && next === 0) ? 1 : -1);
      setIndex((next + VIDEOS.length) % VIDEOS.length);
      setPlaying(keepPlaying);
    },
    [index],
  );

  const onEnded = () => {
    const last = index === VIDEOS.length - 1;
    go(last ? 0 : index + 1, !last); // after the final clip, rest on the first one
  };

  const play = () => {
    setPlaying(true);
    videoRef.current?.play().catch(() => setPlaying(false));
  };

  const current = VIDEOS[index] ?? VIDEOS[0]!;
  // Warm the browser cache for the next clip so the hand-off is seamless.
  const next = VIDEOS[(index + 1) % VIDEOS.length] ?? current;

  return (
    <div className="hv" aria-roledescription="carousel" aria-label="XAPPX app overview videos">
      <div className="hv__phone">
        <div className="hv__screen">
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <motion.video
              key={current.src}
              ref={setVideoRef}
              className="hv__video"
              src={current.src}
              poster={current.poster}
              preload={playing ? "auto" : "metadata"}
              playsInline
              controls={playing}
              // A clip mounted while we're in "playing" mode starts by itself; the
              // browser allows sound because the visitor already pressed play.
              autoPlay={playing}
              onEnded={onEnded}
              onPause={(e) => {
                // A manual pause (native controls) should not auto-start the next clip.
                // Ignore the pause the browser fires when the outgoing clip is removed,
                // and the one that precedes "ended".
                const v = e.currentTarget;
                if (v.isConnected && !v.ended) setPlaying(false);
              }}
              onPlay={(e) => { if (e.currentTarget.isConnected) setPlaying(true); }}
              custom={dir}
              initial={{ x: dir > 0 ? "100%" : "-100%", opacity: 0.4 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: dir > 0 ? "-100%" : "100%", opacity: 0.4 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              aria-label={current.label}
            />
          </AnimatePresence>

          {!playing && (
            <button className="hv__play" type="button" onClick={play} aria-label={`Play ${current.label}`}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
            </button>
          )}
        </div>
        <link rel="prefetch" href={next.src} as="video" />
      </div>

      <div className="hv__nav">
        <button className="hv__arrow" type="button" onClick={() => go(index - 1, playing)} aria-label="Previous video">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="hv__dots" role="tablist" aria-label="Choose video">
          {VIDEOS.map((v, i) => (
            <button
              key={v.src}
              role="tab"
              type="button"
              className={"hv__dot" + (i === index ? " is-on" : "")}
              aria-selected={i === index}
              aria-label={`${v.label} (${i + 1} of ${VIDEOS.length})`}
              onClick={() => go(i, playing)}
            />
          ))}
        </div>
        <button className="hv__arrow" type="button" onClick={() => go(index + 1, playing)} aria-label="Next video">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <span className="hv__count" aria-live="polite">{index + 1} / {VIDEOS.length}</span>
      </div>
    </div>
  );
}
