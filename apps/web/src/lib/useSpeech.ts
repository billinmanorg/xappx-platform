// Voice in and out for XAPPY, using what the browser already has:
// speech recognition for the microphone, speech synthesis for reading aloud.
// Both are optional: when a browser lacks them the UI simply hides the button.
import { useCallback, useEffect, useRef, useState } from "react";

interface RecognitionResultLike { 0: { transcript: string }; isFinal: boolean }
interface RecognitionEventLike { resultIndex: number; results: ArrayLike<RecognitionResultLike> }
interface RecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start(): void; stop(): void; abort(): void;
}
type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechInputSupported = () => recognitionCtor() !== null;
export const speechOutputSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Microphone → text. `onText` receives the final transcript of one utterance. */
export function useSpeechInput(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<RecognitionLike | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const supported = speechInputSupported();

  const stop = useCallback(() => { recRef.current?.stop(); }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    try {
      const rec = new Ctor();
      rec.lang = navigator.language || "en-US";
      rec.continuous = false;
      rec.interimResults = true;
      let finalText = "";
      rec.onresult = (e) => {
        let live = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (!r) continue;
          if (r.isFinal) finalText += r[0].transcript;
          else live += r[0].transcript;
        }
        setInterim(live);
      };
      rec.onerror = (e) => { setError(e.error ?? "error"); };
      rec.onend = () => {
        setListening(false);
        setInterim("");
        const t = finalText.trim();
        if (t) onTextRef.current(t);
        recRef.current = null;
      };
      recRef.current = rec;
      setError(null);
      setListening(true);
      rec.start();
    } catch {
      setError("unavailable");
      setListening(false);
    }
  }, []);

  useEffect(() => () => { recRef.current?.abort(); }, []);

  return { supported, listening, interim, error, start, stop };
}

/** Read a short line aloud; a new call interrupts the previous one. */
export function speak(text: string) {
  if (!speechOutputSupported()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.pitch = 0.95;
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}
export function stopSpeaking() {
  if (speechOutputSupported()) try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
}
