import { useSpeechInput } from "../lib/useSpeech";
import "./MicButton.css";

/**
 * A microphone button that turns one spoken utterance into text. Renders
 * nothing in browsers without speech recognition, so no dead controls.
 */
export function MicButton({ onText, label, size = "sm", className = "" }: { onText: (text: string) => void; label?: string; size?: "sm" | "lg"; className?: string }) {
  const { supported, listening, interim, start, stop } = useSpeechInput(onText);
  if (!supported) return null;
  return (
    <span className={`mic mic--${size} ${listening ? "is-listening" : ""} ${className}`.trim()}>
      <button
        type="button"
        className="mic__btn"
        onClick={listening ? stop : start}
        aria-pressed={listening}
        aria-label={listening ? "Stop listening" : (label ?? "Speak instead of typing")}
        title={listening ? "Listening… click to stop" : (label ?? "Speak instead of typing")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v5a4 4 0 0 0 4 4Z" fill="currentColor" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {label && size === "lg" && <span className="mic__label">{listening ? (interim || "Listening…") : label}</span>}
      </button>
      {size === "sm" && listening && <span className="mic__live" aria-live="polite">{interim || "Listening…"}</span>}
    </span>
  );
}
