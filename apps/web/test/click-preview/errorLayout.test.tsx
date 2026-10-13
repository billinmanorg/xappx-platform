import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { useReducer } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorkingPreview } from "../../src/click-preview/WorkingPreview";
import { createPreviewSession, previewReducer } from "../../src/click-preview/previewSession";
import type { PreviewSession, WorkflowId } from "../../src/click-preview/types";
import { legacyDiscovery } from "./fixtures";

const stylesheet = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../src/click-preview/workflows.css"), "utf8");
const style = document.createElement("style");
style.textContent = stylesheet;
beforeEach(() => { document.head.append(style); });
afterEach(() => { style.remove(); });

function Harness({ workflow, initial }: { workflow: WorkflowId; initial?: PreviewSession }) {
  const [session, dispatch] = useReducer(previewReducer, initial ?? createPreviewSession(workflow, legacyDiscovery()));
  return <div className="preview-app"><WorkingPreview session={session} dispatch={dispatch} onBack={() => {}} onReset={() => {}} onChangeWorkflow={() => {}} /></div>;
}

// JSDOM has no layout. Supply only the browser measurement, not the behavior
// under test: the production component must retain it after removing the alert.
function measureFeedback(height: number | (() => number)) {
  const original = HTMLElement.prototype.getBoundingClientRect;
  return vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.matches(".sample-error-space") && this.querySelector('[role="alert"]')) {
      return new DOMRect(0, 0, 500, typeof height === "number" ? height : height());
    }
    return original.call(this);
  });
}

// Supply browser size notifications only; the real component must decide
// whether to measure, retain the maximum, and ignore a queued stale callback.
function feedbackResizeObserver() {
  let notify: (() => void) | undefined;
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) {
      notify = () => callback([], this as unknown as ResizeObserver);
    }
    observe() {}
    disconnect() {}
  });
  return () => { act(() => { notify?.(); }); };
}

it.each([
  { workflow: "sponsor" as const, filter: "High", target: "Sample Cloudberry Studio" },
  { workflow: "speaker" as const, filter: "Experience", target: "Sample: Welcoming every attendee" },
])("retains $workflow recovery feedback space after a changed filter without stale announcements", async (flow) => {
  measureFeedback(118);
  const user = userEvent.setup();
  const { container } = render(<Harness workflow={flow.workflow} />);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: `Open ${flow.target}` }));
  expect(screen.getByRole("alert")).toHaveTextContent("prompted guided step");
  const space = container.querySelector<HTMLElement>(".sample-error-space");
  expect(space, "the alert needs a persistent layout container above the workspace").not.toBeNull();
  // The real stylesheet must contain its child's margins within the measured box.
  expect(getComputedStyle(space!).display).toBe("flow-root");
  expect(space).toHaveStyle({ minHeight: "118px" });
  const filter = screen.getByRole("button", { name: flow.filter });
  filter.focus();
  await user.keyboard("{Enter}");
  expect(filter).toHaveFocus();
  expect(space).toHaveStyle({ minHeight: "118px" });
  expect(space).toBeEmptyDOMElement();
  expect(screen.queryByRole("alert", { hidden: true })).not.toBeInTheDocument();
  expect(screen.queryByText(/prompted guided step/)).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Record details" })).not.toBeInTheDocument();
  fireEvent.click(filter);
  expect(screen.getByRole("status", { name: "Guided progress" })).toHaveTextContent("1 of 3");
  expect(screen.queryByRole("region", { name: "Record details" })).not.toBeInTheDocument();
});

it("removes unavailable-record recovery controls while retaining their measured space", () => {
  measureFeedback(174);
  const initial = { ...createPreviewSession("sponsor", legacyDiscovery()), selectedId: "missing" };
  const { container } = render(<Harness workflow="sponsor" initial={initial} />);
  expect(screen.getByRole("alert")).toHaveTextContent("record is unavailable");
  expect(screen.getByRole("button", { name: "Back to records" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "High" }));
  const space = container.querySelector(".sample-error-space");
  expect(space, "recovery must retain its layout container after removing its controls").not.toBeNull();
  expect(space).toHaveStyle({ minHeight: "174px" });
  expect(space).toBeEmptyDOMElement();
  expect(screen.queryByRole("button", { name: "Back to records", hidden: true })).not.toBeInTheDocument();
  expect(screen.queryByRole("alert", { hidden: true })).not.toBeInTheDocument();
});

it.each([
  { workflow: "sponsor" as const, filter: "High", target: "Sample Cloudberry Studio" },
  { workflow: "speaker" as const, filter: "Experience", target: "Sample: Welcoming every attendee" },
])("retains $workflow feedback growth after viewport reflow even without ResizeObserver", async (flow) => {
  vi.stubGlobal("ResizeObserver", undefined);
  let height = 118;
  measureFeedback(() => height);
  const user = userEvent.setup();
  const { container } = render(<Harness workflow={flow.workflow} />);
  fireEvent.click(screen.getByRole("button", { name: `Open ${flow.target}` }));
  const alert = screen.getByRole("alert");
  const space = container.querySelector(".sample-error-space");
  expect(space).toHaveStyle({ minHeight: "118px" });
  height = 174;
  fireEvent(window, new Event("resize"));
  expect(space).toHaveStyle({ minHeight: "174px" });
  expect(screen.getByRole("alert")).toBe(alert);
  height = 118;
  fireEvent(window, new Event("resize"));
  expect(space).toHaveStyle({ minHeight: "174px" });
  const filter = screen.getByRole("button", { name: flow.filter });
  filter.focus();
  await user.keyboard("{Enter}");
  fireEvent.click(filter);
  expect(filter).toHaveFocus();
  expect(space).toHaveStyle({ minHeight: "174px" });
  expect(space).toBeEmptyDOMElement();
  expect(screen.queryByRole("alert", { hidden: true })).not.toBeInTheDocument();
  expect(screen.queryByText(/prompted guided step/)).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Record details" })).not.toBeInTheDocument();
  expect(screen.getByRole("status", { name: "Guided progress" })).toHaveTextContent("1 of 3");
});

it("retains observed recovery-content growth without stale callbacks or recovery controls", () => {
  const notifyResize = feedbackResizeObserver();
  let height = 174;
  const measurement = measureFeedback(() => height);
  const initial = { ...createPreviewSession("sponsor", legacyDiscovery()), selectedId: "missing" };
  const { container, unmount } = render(<Harness workflow="sponsor" initial={initial} />);
  const space = container.querySelector(".sample-error-space");
  const alert = screen.getByRole("alert");
  expect(space).toHaveStyle({ minHeight: "174px" });
  // Text/content reflow can happen without a viewport resize event.
  height = 230;
  notifyResize();
  expect(space).toHaveStyle({ minHeight: "230px" });
  height = 174;
  notifyResize();
  notifyResize();
  expect(space).toHaveStyle({ minHeight: "230px" });
  expect(screen.getByRole("alert")).toBe(alert);
  fireEvent.click(screen.getByRole("button", { name: "High" }));
  expect(space).toHaveStyle({ minHeight: "230px" });
  expect(space).toBeEmptyDOMElement();
  expect(screen.queryByRole("button", { name: "Back to records", hidden: true })).not.toBeInTheDocument();
  expect(screen.queryByRole("alert", { hidden: true })).not.toBeInTheDocument();
  // A previously queued observer notification must be harmless after cleanup.
  const readsAfterClear = measurement.mock.calls.length;
  height = 300;
  notifyResize();
  fireEvent(window, new Event("resize"));
  expect(measurement.mock.calls).toHaveLength(readsAfterClear);
  expect(space).toHaveStyle({ minHeight: "230px" });
  unmount();
  notifyResize();
  expect(measurement.mock.calls).toHaveLength(readsAfterClear);
});
