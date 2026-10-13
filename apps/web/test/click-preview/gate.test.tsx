import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewApp } from "../../src/click-preview/PreviewApp";
import * as sessions from "../../src/click-preview/previewSession";
import * as adapter from "../../src/click-preview/restore";
import { contextFor } from "./fixtures";

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const progress = () => screen.getByRole("status", { name: "Guided progress" });
const details = () => screen.getByRole("region", { name: "Record details" });
const historyState = () => structuredClone(window.history.state);
const pop = (state: unknown) => fireEvent(window, new PopStateEvent("popstate", { state }));
function launch() { click("Explore solutions"); click("Launch preview: Sponsor Lead Desk"); }
function complete() { click("High"); click("Open Sample Cloudberry Studio"); click("Mark Qualified"); }
beforeEach(() => {
  vi.spyOn(Storage.prototype, "getItem").mockReturnValue(JSON.stringify({ ...contextFor("sponsor-leads"), note: "Keep this discovery note", uncoveredNeed: "A quieter sponsor area" }));
});

describe("proposed plan comparison", () => {
  it("shows exact proposed USD caps with explained disabled checkout and no purchase form or success", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const { container } = render(<PreviewApp />); launch(); complete();
    expect(screen.queryByRole("heading", { name: "Proposed plans" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your sample result" })).toHaveFocus();
    click("View proposed plans");
    expect(screen.getByRole("heading", { name: "Proposed plans" })).toHaveFocus();
    expect(screen.getByText("Proposed pricing · Subject to approval")).toBeVisible();
    for (const [name, price, apps, editors] of [["Starter", 49, 1, 2], ["Professional", 129, 5, 5], ["Agency", 299, 15, 15]] as const) {
      const plan = screen.getByRole("article", { name });
      expect(within(plan).getByText(`$${price}`)).toBeVisible();
      expect(within(plan).getByText("USD / month")).toBeVisible();
      expect(within(plan).getByText(`${apps} active ${apps === 1 ? "app" : "apps"}`)).toBeVisible();
      expect(within(plan).getByText(`${editors} editors`)).toBeVisible();
      const checkout = within(plan).getByRole("button", { name: /Checkout unavailable/ });
      expect(checkout).toBeDisabled();
      expect(checkout).toHaveAccessibleDescription(/not connected.*proposed.*not approved/i); fireEvent.click(checkout);
    }
    expect(container.querySelector("form")).toBeNull(); expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/purchase successful|payment confirmed|thank you for subscribing/i)).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("returns read-only with the third result and exact records retained, including browser Back and Forward", () => {
    render(<PreviewApp />); launch(); complete(); const working = historyState();
    const result = screen.getByRole("status", { name: "Sample result" }).textContent;
    click("View proposed plans"); const plans = historyState(); pop(working);
    expect(screen.getByRole("status", { name: "Sample result" })).toHaveTextContent(result!);
    expect(screen.getByRole("button", { name: "Mark Qualified" })).toBeDisabled();
    pop(plans); expect(screen.getByRole("heading", { name: "Proposed plans" })).toHaveFocus(); click("Return to preview");
    expect(screen.getByRole("button", { name: "View proposed plans" })).toHaveFocus();
    expect(progress()).toHaveTextContent("3 of 3");
    expect(within(details()).getByText("Qualified", { selector: "dd" })).toBeVisible();
    expect(screen.getByRole("status", { name: "Sample result" })).toHaveTextContent(result!);
    expect(screen.getByRole("button", { name: "Mark Qualified" })).toBeDisabled();
  });
});

describe("confirmation safety and focus", () => {
  it.each(["Cancel", "Close confirmation", "Escape"])("%s preserves the entire session and restores the trigger without a history entry", (dismiss) => {
    const reducer = vi.spyOn(sessions, "previewReducer");
    render(<PreviewApp />); launch(); click("High"); click("Open Sample Cloudberry Studio");
    const before = structuredClone(reducer.mock.results.at(-1)!.value);
    const state = historyState(); const length = window.history.length;
    const trigger = screen.getByRole("button", { name: "Reset demo" }); trigger.focus(); click("Reset demo");
    const dialog = screen.getByRole("dialog", { name: "Reset this sample?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(/sample records and guided progress.*discovery choices and notes/i);
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(document.querySelector(".preview-background")).toHaveAttribute("inert");
    expect(window.history.length).toBe(length); expect(window.history.state).toEqual(state);
    if (dismiss === "Escape") fireEvent.keyDown(document, { key: "Escape" }); else click(dismiss);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(trigger).toHaveFocus();
    expect(document.querySelector(".preview-background")).not.toHaveAttribute("inert");
    click("Mark Qualified"); expect(reducer.mock.calls.at(-1)![0]).toEqual(before);
    expect(progress()).toHaveTextContent("3 of 3");
  });
  it("traps forward/reverse Tab and redirects accidental focus outside the dialog", async () => {
    const user = userEvent.setup(); render(<PreviewApp />); launch(); click("Reset demo");
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Confirm" });
    const close = within(dialog).getByRole("button", { name: "Close confirmation" });
    confirm.focus(); await user.tab(); expect(close).toHaveFocus();
    await user.tab({ shift: true }); expect(confirm).toHaveFocus();
    (document.querySelector("#working-title") as HTMLElement).focus(); expect(dialog.contains(document.activeElement)).toBe(true);
  });
  it("confirmed reset replaces only the sample session, announces reset and resets its mobile panel", () => {
    const create = vi.spyOn(sessions, "createPreviewSession");
    render(<PreviewApp />); click("Explore solutions"); click("Show more");
    const cards = screen.getAllByRole("article").map((card) => card.textContent);
    click("Launch preview: Sponsor Lead Desk"); complete(); click("Reset demo"); click("Confirm");
    expect(create).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("heading", { level: 1, name: "Sponsor Lead Desk" })).toHaveFocus();
    expect(progress()).toHaveTextContent("0 of 3");
    expect(screen.getByRole("status", { name: "Session notice" })).toHaveTextContent(/reset.*records.*progress/i);
    expect(screen.queryByRole("region", { name: "Record details" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Qualified leads" })).toHaveTextContent("1");
    click("Back to recommendations"); expect(screen.getAllByRole("article").map((card) => card.textContent)).toEqual(cards);
    expect(screen.getByText("Keep this discovery note")).toBeVisible(); expect(screen.getByText("A quieter sponsor area")).toBeVisible();
    click("Launch preview: Sponsor Lead Desk"); expect(progress()).toHaveTextContent("0 of 3"); expect(create).toHaveBeenCalledTimes(2);
  });
  it("same workflow resumes, another confirms before creation, and discarded routes never resurrect records or offers", () => {
    const create = vi.spyOn(sessions, "createPreviewSession"); const adapt = vi.spyOn(adapter, "toLegacyDiscovery");
    render(<PreviewApp />); launch(); complete(); const oldWorking = historyState();
    click("View proposed plans"); const oldPlans = historyState(); click("Return to preview");
    click("Back to recommendations"); click("Launch preview: Sponsor Lead Desk");
    expect(create).toHaveBeenCalledTimes(1); expect(adapt).toHaveBeenCalledTimes(1);
    click("Speaker Submission Review");
    expect(screen.getByRole("dialog", { name: "Change working preview?" })).toHaveAccessibleDescription(/Sponsor Lead Desk.*Speaker Submission Review/);
    expect(create).toHaveBeenCalledTimes(1); click("Cancel"); expect(progress()).toHaveTextContent("3 of 3");
    click("Speaker Submission Review"); click("Confirm");
    expect(create).toHaveBeenCalledTimes(2); expect(adapt).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("heading", { level: 1, name: "Speaker Submission Review" })).toHaveFocus(); expect(progress()).toHaveTextContent("0 of 3");
    for (const state of [oldPlans, oldWorking]) {
      pop(state); expect(screen.queryByRole("heading", { name: "Proposed plans" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { level: 1, name: "Sponsor Lead Desk" })).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: "Explore your possibilities" })).toBeVisible();
    expect(create).toHaveBeenCalledTimes(2);
  });
  it("browser navigation dismisses a pending confirmation without stale focus or reopening it on Forward", () => {
    render(<PreviewApp />); click("Explore solutions"); const recommendations = historyState();
    click("Launch preview: Sponsor Lead Desk"); const working = historyState(); click("High");
    screen.getByRole("button", { name: "Reset demo" }).focus(); click("Reset demo"); pop(recommendations);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(screen.getByRole("heading", { name: "Explore your possibilities" })).toHaveFocus();
    pop(working); expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(progress()).toHaveTextContent("1 of 3");
    expect(screen.getByRole("heading", { level: 1, name: "Sponsor Lead Desk" })).toHaveFocus();
  });
});

describe("memory-only navigation", () => {
  it("browser Back/Forward retains steps, batches, drafts, filters and edits without URL or history content", () => {
    const push = vi.spyOn(window.history, "pushState"); const replace = vi.spyOn(window.history, "replaceState");
    const url = window.location.href; render(<PreviewApp />); const choices = historyState();
    click("Explore solutions"); click("Show more"); const recommendations = historyState();
    const cards = screen.getAllByRole("article").map((card) => card.textContent);
    click("None fit"); click("Another goal");
    fireEvent.change(screen.getByRole("textbox", { name: "What is still missing? (optional)" }), { target: { value: "inert <tag> private note" } });
    const refine = historyState(); pop(recommendations); expect(screen.getAllByRole("article").map((card) => card.textContent)).toEqual(cards);
    pop(refine); expect(screen.getByRole("button", { name: "Another goal" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox")).toHaveValue("inert <tag> private note");
    pop(choices); expect(screen.getByRole("button", { name: "Visibility" })).toHaveAttribute("aria-pressed", "true");
    pop(recommendations); click("Launch preview: Sponsor Lead Desk"); complete(); const working = historyState();
    pop(recommendations); pop(working); expect(progress()).toHaveTextContent("3 of 3");
    expect(screen.getByRole("button", { name: "High" })).toHaveAttribute("aria-pressed", "true");
    expect(within(details()).getByText("Qualified", { selector: "dd" })).toBeVisible(); expect(window.location.href).toBe(url);
    expect(push).toHaveBeenCalled(); expect(replace).toHaveBeenCalled();
    for (const [state, , nextUrl] of [...push.mock.calls, ...replace.mock.calls]) {
      expect(Object.keys(state)).toEqual(["xappxPreview"]); expect(typeof state.xappxPreview).toBe("string");
      expect(JSON.stringify(state)).not.toMatch(/sponsor|Qualified|note|tag|discovery|records/); expect(nextUrl).toBeUndefined();
    }
  });
  it("new navigation truncates Forward entries and stale/foreign history never reopens a dismissed dialog", () => {
    render(<PreviewApp />); click("Explore solutions"); const recommendations = historyState();
    click("None fit"); const discarded = historyState(); pop(recommendations);
    click("Launch preview: Sponsor Lead Desk"); click("Reset demo"); click("Cancel"); pop(discarded);
    expect(screen.queryByRole("heading", { name: "What would fit better?" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); pop({ otherApp: "unexpected" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(screen.queryByRole("heading", { name: "Proposed plans" })).not.toBeInTheDocument();
  });
  it("reload ignores former history and resets the sample with one read and no storage writes", () => {
    const writes = ["setItem", "removeItem", "clear"].map((name) => vi.spyOn(Storage.prototype, name as "setItem").mockImplementation(() => {}));
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const first = render(<PreviewApp />); launch(); complete(); click("View proposed plans"); const stale = historyState(); first.unmount();
    vi.mocked(Storage.prototype.getItem).mockClear(); render(<PreviewApp />); pop(stale);
    expect(screen.queryByRole("heading", { name: "Proposed plans" })).not.toBeInTheDocument();
    launch(); expect(progress()).toHaveTextContent("0 of 3"); expect(screen.getByRole("group", { name: "Qualified leads" })).toHaveTextContent("1");
    expect(Storage.prototype.getItem).toHaveBeenCalledTimes(1);
    writes.forEach((write) => expect(write).not.toHaveBeenCalled()); expect(fetch).not.toHaveBeenCalled();
  });
});

it("removes background inert before restoring cancellation focus", () => {
  render(<PreviewApp />); launch();
  const trigger = screen.getByRole("button", { name: "Reset demo" }); trigger.focus(); click("Reset demo");
  let inertAtRestore = true;
  const originalFocus = trigger.focus.bind(trigger);
  vi.spyOn(trigger, "focus").mockImplementation(() => {
    inertAtRestore = !!trigger.closest("[inert]");
    if (!inertAtRestore) originalFocus();
  });
  click("Cancel"); expect(inertAtRestore).toBe(false); expect(trigger).toHaveFocus();
});

it("explicit plans return replaces the offer entry so Back does not reopen a dismissed comparison", () => {
  render(<PreviewApp />); launch(); complete(); click("View proposed plans");
  const plans = historyState(); const length = window.history.length;
  const replace = vi.spyOn(window.history, "replaceState");
  click("Return to preview"); expect(replace).toHaveBeenCalledOnce(); expect(window.history.length).toBe(length);
  expect(screen.getByRole("button", { name: "View proposed plans" })).toHaveFocus();
  pop(plans); expect(screen.queryByRole("heading", { name: "Proposed plans" })).not.toBeInTheDocument();
});


describe("skip-to-content route preservation", () => {
  it.each([
    ["recommendations", "click"], ["recommendations", "keyboard"],
    ["working", "click"], ["working", "keyboard"],
    ["plans", "click"], ["plans", "keyboard"],
  ] as const)("%s: %s focuses main without changing the route, sample or native Back/Forward positions", async (view, activation) => {
    window.history.replaceState(null, "", "/");
    const user = userEvent.setup(); render(<PreviewApp />);
    click("Explore solutions"); click("Show more"); const recommendations = historyState();
    click("Launch preview: Sponsor Lead Desk"); complete(); const working = historyState();
    let heading = "Sponsor Lead Desk";
    let previousHeading = "Explore your possibilities";
    let previousState = recommendations;
    if (view === "recommendations") { click("Back to recommendations"); heading = "Explore your possibilities"; previousHeading = "Sponsor Lead Desk"; previousState = working; }
    if (view === "plans") { click("View proposed plans"); heading = "Proposed plans"; previousHeading = "Sponsor Lead Desk"; previousState = working; }
    const before = { state: historyState(), length: window.history.length, url: window.location.href,
      sample: document.querySelector(".working-preview")!.innerHTML };
    const skip = screen.getByRole("link", { name: "Skip to main content" });
    expect(skip).toHaveAttribute("href", "#preview-content");
    if (activation === "keyboard") { skip.focus(); await user.keyboard("{Enter}"); } else await user.click(skip);
    // Let native fragment navigation and its queued popstate run, if the default was not prevented.
    await act(async () => { await new Promise<void>((resolve) => window.setTimeout(resolve, 0)); });
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    expect(screen.getByRole("main")).toHaveFocus();
    expect(window.location.href).toBe(before.url); expect(window.history.length).toBe(before.length);
    expect(window.history.state).toEqual(before.state);
    expect(document.querySelector(".working-preview")!.innerHTML).toBe(before.sample);
    act(() => window.history.back());
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: previousHeading })).toBeVisible());
    expect(window.history.state).toEqual(previousState);
    act(() => window.history.forward());
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: heading })).toBeVisible());
    expect(window.history.state).toEqual(before.state);
    if (view !== "working") pop(working);
    expect(progress()).toHaveTextContent("3 of 3");
    expect(within(details()).getByText("Qualified", { selector: "dd" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Mark Qualified" })).toBeDisabled();
  });
});
