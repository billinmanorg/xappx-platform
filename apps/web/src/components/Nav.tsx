import { useEffect, useState } from "react";
import "./Nav.css";

const LINKS = [
  { label: "How it works", href: "#how" },
  { label: "Industries", href: "#industries" },
  { label: "Why XAPPX", href: "#why" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={"nav" + (scrolled ? " nav--scrolled" : "")}>
      <div className="container nav__in">
        <a className="nav__logo" href="#top" aria-label="XAPPX home">
          X<span>APP</span>X
        </a>
        <nav className="nav__links" aria-label="Primary">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>{l.label}</a>
          ))}
        </nav>
        <div className="nav__actions">
          <a className="nav__signin" href="https://app-factory-3jf3.onrender.com">Sign in</a>
          <a className="btn btn-primary nav__cta" href="#build">Build my solution</a>
        </div>
        <button
          className="nav__burger"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span /><span /><span />
        </button>
      </div>
      {open && (
        <div className="nav__mobile">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>
          ))}
          <a href="https://app-factory-3jf3.onrender.com">Sign in</a>
          <a className="btn btn-primary" href="#build" onClick={() => setOpen(false)}>Build my solution</a>
        </div>
      )}
    </header>
  );
}
