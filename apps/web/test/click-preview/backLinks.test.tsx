import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { configure, getConfig, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PreviewPlans } from "../../src/click-preview/PreviewPlans";

const stylesheet = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../src/click-preview/preview.css"), "utf8");

// JSDOM omits computed pseudo-element styles. Supply the real, shared back-link
// rule to the accessible-name algorithm rather than silently ignoring its text.
function backDecoration() {
  const rule = stylesheet.match(/\.preview-app \.back-link::before\s*\{[^}]*\}/)?.[0];
  expect(rule, "the visible back cue must still exist").toBeDefined();
  const sheet = new CSSStyleSheet();
  sheet.insertRule(rule!, 0);
  return (sheet.cssRules[0] as CSSStyleRule).style;
}

// Reintroducing textual pseudo-content must fail even when ordinary JSDOM role
// queries continue to find the unchanged DOM label.
it("keeps the decorative back cue out of the accessible button name", () => {
  render(<div className="preview-app"><PreviewPlans onBack={() => {}} /></div>);
  const back = screen.getByRole("button", { name: "Return to preview" });
  const decoration = backDecoration();
  const empty = document.createElement("span").style;
  empty.content = "none";
  const originalComputedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => pseudo
    ? (pseudo === "::before" && element.matches(".preview-app .back-link") ? decoration : empty)
    : originalComputedStyle(element));
  const previous = getConfig().computedStyleSupportsPseudoElements;
  configure({ computedStyleSupportsPseudoElements: true });
  try {
    expect(screen.queryByRole("button", { name: "Return to preview" }), "CSS-aware exact name must match the DOM label").toBe(back);
  } finally {
    configure({ computedStyleSupportsPseudoElements: previous });
  }
});

// Removing the cue entirely is not an accessibility fix. It stays a painted,
// non-textual chevron inheriting the control's normal, hover, and focus colors.
it("paints a visible back chevron without generated text", () => {
  const decoration = backDecoration();
  expect(decoration.getPropertyValue("content")).toBe('""');
  expect(decoration.getPropertyValue("width")).toBe("0.45em");
  expect(decoration.getPropertyValue("height")).toBe("0.45em");
  expect(decoration.getPropertyValue("border-left")).toBe("2px solid currentColor");
  expect(decoration.getPropertyValue("border-bottom")).toBe("2px solid currentColor");
  expect(decoration.getPropertyValue("transform")).toBe("rotate(45deg)");
});
