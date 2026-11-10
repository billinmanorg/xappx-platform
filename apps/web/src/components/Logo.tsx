import "./Logo.css";

/**
 * The XAPPX logo: the X mark (a cyan-to-violet stroke crossed by an indigo
 * stroke) with the wordmark. Drawn as SVG + text so it stays crisp at any size
 * and works on the dark site; `onLight` switches to the navy palette of the
 * style guide for light backgrounds (documents, emails).
 */
export function Logo({ variant = "full", size = 28, onLight = false, className = "" }: {
  variant?: "full" | "mark";
  /** Height of the mark in pixels; the wordmark scales with it. */
  size?: number;
  onLight?: boolean;
  className?: string;
}) {
  const id = onLight ? "l" : "d";
  return (
    <span className={`logo ${onLight ? "logo--light" : ""} ${className}`.trim()} style={{ ["--logo-h" as string]: `${size}px` }}>
      <svg className="logo__mark" viewBox="0 0 100 80" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`xg-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#00D4FF" />
            <stop offset="0.5" stopColor="#2F7BFF" />
            <stop offset="1" stopColor="#7A2BFF" />
          </linearGradient>
          <linearGradient id={`xn-${id}`} x1="1" y1="0" x2="0" y2="1">
            {onLight ? (
              <><stop offset="0" stopColor="#1C2566" /><stop offset="1" stopColor="#0E1240" /></>
            ) : (
              <><stop offset="0" stopColor="#7C89FF" /><stop offset="1" stopColor="#3647B8" /></>
            )}
          </linearGradient>
        </defs>
        {/* cyan→violet stroke, top-left to bottom-right */}
        <polygon points="2,0 27,0 98,80 73,80" fill={`url(#xg-${id})`} />
        {/* indigo stroke in front, top-right to bottom-left */}
        <polygon points="73,0 98,0 27,80 2,80" fill={`url(#xn-${id})`} />
      </svg>
      {variant === "full" && (
        <span className="logo__word" aria-label="XAPPX">
          <b className="logo__x1">X</b><span className="logo__app">APP</span><b className="logo__x2">X</b>
        </span>
      )}
    </span>
  );
}
