import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import "./Nav.css";

const LINKS = [
  { label: "Solutions", href: "/solutions" },
  { label: "How it works", href: "/#how" },
  { label: "Industries", href: "/#industries" },
  { label: "Why XAPPX", href: "/#why" },
];
const here = typeof window !== "undefined" ? window.location.pathname.replace(/\/+$/, "") : "";

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
        <a className="nav__logo" href="/" aria-label="XAPPX home">
          <Logo height={50} />
        </a>
        <nav className="nav__links" aria-label="Primary">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} aria-current={l.href === here ? "page" : undefined}>{l.label}</a>
          ))}
        </nav>
        <div className="nav__actions">
          <a className="nav__signin" href="/admin">Sign in</a>
          <a className="btn btn-primary nav__cta" href="/solutions">Explore solutions</a>
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
          <a href="/admin">Sign in</a>
          <a className="btn btn-primary" href="/solutions" onClick={() => setOpen(false)}>Explore solutions</a>
        </div>
      )}
    </header>
  );
}
