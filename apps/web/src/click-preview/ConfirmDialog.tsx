import { useLayoutEffect, useRef } from "react";

export interface ConfirmDialogProps {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, description, onConfirm, onCancel }: ConfirmDialogProps): JSX.Element {
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const cancelAction = useRef(onCancel);
  cancelAction.current = onCancel;
  useLayoutEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancel.current?.focus();
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.current?.contains(event.target)) cancel.current?.focus();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancelAction.current(); }
      if (event.key !== "Tab") return;
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      const first = buttons?.[0]; const last = buttons?.[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keyboard);
    document.addEventListener("focusin", containFocus);
    return () => {
      document.removeEventListener("keydown", keyboard);
      document.removeEventListener("focusin", containFocus);
      document.body.style.overflow = overflow;
      // The owner removes background inert before closing; navigation may then focus its new heading.
      if (trigger?.isConnected && !trigger.closest("[hidden]")) trigger.focus();
    };
  }, []);
  return <div className="confirmation-overlay">
    <div ref={dialog} className="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-description">
      <button className="button button-quiet confirmation-close" type="button" aria-label="Close confirmation" onClick={onCancel}>Close<span aria-hidden="true"> ×</span></button>
      <p className="proposed-label">Your sample session</p><h2 id="confirmation-title">{title}</h2>
      <p id="confirmation-description">{description}</p>
      <div className="button-row confirmation-actions"><button ref={cancel} className="button button-secondary" type="button" onClick={onCancel}>Cancel</button><button className="button button-primary" type="button" onClick={onConfirm}>Confirm</button></div>
    </div>
  </div>;
}
