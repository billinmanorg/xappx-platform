import "./Logo.css";

/**
 * The XAPPX logo, exactly as supplied in the style guide: the X mark stacked
 * above the wordmark (transparent PNG cut from the master file in
 * public/assets/brand). `variant="mark"` shows only the X.
 */
export function Logo({ variant = "stacked", height = 48, className = "" }: {
  variant?: "stacked" | "mark";
  /** Rendered height in pixels. */
  height?: number;
  className?: string;
}) {
  const src = variant === "mark" ? "/assets/brand/xappx-mark.png" : "/assets/brand/xappx-logo-stacked.png";
  return (
    <img
      className={`logo logo--${variant} ${className}`.trim()}
      src={src}
      alt="XAPPX"
      style={{ height }}
      decoding="async"
    />
  );
}
