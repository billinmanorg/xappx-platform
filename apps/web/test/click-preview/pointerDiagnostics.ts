import type { Locator } from "@playwright/test";

type ProbeRoot = HTMLElement & { stopPointerProbe?: () => unknown };

/** Test-only, bounded fixture diagnostics. Never inspect forms, storage, or HTML. */
export async function observeNativePointerInput(control: Locator) {
  await control.evaluate((element) => {
    const root = element.closest<ProbeRoot>(".working-preview")!;
    const rectangle = (node: Element | null) => {
      if (!node) return null;
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    };
    const snapshot = () => ({
      control: rectangle(element),
      workspace: rectangle(root.querySelector(".working-workspace")),
      feedback: rectangle(root.querySelector(".sample-error-space")),
      scroll: { x: scrollX, y: scrollY },
      progress: root.querySelector(".guided-announcement strong")?.textContent,
      selectedRecord: root.querySelector('.sample-record-card[aria-pressed="true"]')?.getAttribute("aria-label") ?? null,
      details: root.querySelectorAll('[aria-label="Record details"]').length,
      alerts: root.querySelectorAll('[role="alert"]').length,
    });
    const before = snapshot();
    const events: unknown[] = [];
    const capture = (event: Event) => {
      if (!(event instanceof MouseEvent) || events.length >= 12) return;
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      // Only static sample/filter labels, never arbitrary text from an input.
      const label = button?.matches(".record-filters button, .sample-record-card")
        ? button.getAttribute("aria-label") ?? button.textContent : button ? "other button" : "non-button";
      events.push({ type: event.type, label, trusted: event.isTrusted, detail: event.detail,
        pointer: { x: event.clientX, y: event.clientY }, ...snapshot() });
    };
    const names = ["pointerdown", "pointerup", "click", "dblclick"];
    names.forEach((name) => root.addEventListener(name, capture, true));
    root.stopPointerProbe = () => {
      names.forEach((name) => root.removeEventListener(name, capture, true));
      delete root.stopPointerProbe;
      return { before, events, after: snapshot() };
    };
  });
  return async () => {
    try {
      const report = await control.evaluate((element) => element.closest<ProbeRoot>(".working-preview")?.stopPointerProbe?.(), undefined, { timeout: 2_000 });
      console.log("Native sample pointer diagnostics:", JSON.stringify(report));
    } catch {
      console.log("Native sample pointer diagnostics unavailable: page closed or changed.");
    }
  };
}
