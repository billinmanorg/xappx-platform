// Opens the XAPPY chat (the vendor widget bubble) — the discovery entry point
// until the dedicated /build flow ships. Falls back to the Factory if the widget
// hasn't loaded (e.g. origin not yet on the chat server's allow-list).
export function openXappy(e?: { preventDefault?: () => void }) {
  e?.preventDefault?.();
  const root = document.getElementById("xappy-root") as (HTMLElement & { shadowRoot?: ShadowRoot }) | null;
  const launch = root?.shadowRoot?.querySelector<HTMLButtonElement>(".launch");
  // Opens the chat when the widget is present. If it isn't (e.g. the static
  // preview sandbox, or the script hasn't loaded yet), do nothing rather than
  // navigate somewhere unexpected.
  if (launch) launch.click();
}
