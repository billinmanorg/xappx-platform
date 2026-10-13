import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewApp } from "../../src/click-preview/PreviewApp";
import { RecommendationList } from "../../src/click-preview/RecommendationList";
import { ConceptDetails } from "../../src/click-preview/ConceptDetails";
import { guidanceFor } from "../../src/click-preview/guidance";
import { CATALOG } from "../../src/click-preview/catalog";
import { PROBLEMS } from "../../src/click-preview/problems";
import { recommend } from "../../src/click-preview/recommendations";
import { contextFor, legacyDiscovery } from "./fixtures";

beforeEach(() => { vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null); });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
function journey(problem = PROBLEMS[0]!) {
  click(problem.label); click("Continue");
  click(problem.goals[0]!.label); click("Continue");
  click("100–500 attendees"); click("Continue");
  click("Visibility"); click("Explore solutions");
}
function titles() { return screen.getAllByRole("article").map((card) => within(card).getByRole("heading", { level: 2 }).textContent); }

// A missing category or non-click-only required field breaks its corresponding journey.
describe("nine click-only journeys", () => {
  it.each(PROBLEMS)("explores $label with relevant catalog choices", (problem) => {
    render(<PreviewApp />);
    expect(screen.getByRole("heading", { name: "What would you like to improve?" })).toBeVisible();
    expect(screen.getByRole("img", { name: "Xappy, your preview guide" })).toHaveAttribute("src", expect.stringContaining("xappy.png"));
    journey(problem);
    expect(screen.getByRole("heading", { name: "Explore your possibilities" })).toHaveFocus();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    const expected = recommend(contextFor(problem.id), CATALOG).slice(0, 3).map((item) => item.solution.title);
    expect(titles()).toEqual(expected);
    expect(screen.getByText("Curated recommendations")).toBeVisible();
    expect(screen.queryByText(/actions remaining|Choose your plan/)).not.toBeInTheDocument();
  });
});

// Removing selection validation would allow accidental empty structured answers.
it("explains disabled Continue and shows only one discovery question at a time", () => {
  render(<PreviewApp />);
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  expect(screen.getByText("Choose a problem or Something else to continue.")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Visibility" })).not.toBeInTheDocument();
  click("Sponsor leads"); click("Continue");
  expect(screen.getByRole("heading", { name: "What would a better outcome look like?" })).toHaveFocus();
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
});

// Requiring a note would break the promised click-only Something else path.
it("continues from blank Something else to an honest empty state", () => {
  render(<PreviewApp />); click("Something else");
  expect(screen.getByRole("textbox", { name: "Optional context" })).toHaveValue("");
  click("Continue"); click("Not sure yet"); click("Continue"); click("Speed"); click("Explore solutions");
  expect(screen.getByText("No catalog match yet")).toBeVisible();
  expect(screen.queryAllByRole("article")).toHaveLength(0);
  click("Browse all event problems");
  expect(screen.getByRole("heading", { name: "What would you like to improve?" })).toBeVisible();
});

// Removing the input boundary or using HTML rendering fails this test.
it("limits optional text to 500 characters and treats markup as inert text", () => {
  render(<PreviewApp />); click("Something else");
  const input = screen.getByRole("textbox", { name: "Optional context" });
  fireEvent.change(input, { target: { value: "a".repeat(501) } });
  expect(input).toHaveValue("a".repeat(500));
  expect(input).toHaveAttribute("maxlength", "500");
  const markup = '<img src=x onerror="window.hacked=true">';
  fireEvent.change(input, { target: { value: markup } });
  click("Continue"); click("Not sure yet"); click("Continue"); click("Speed"); click("Explore solutions");
  expect(screen.getByText(markup)).toBeVisible();
  expect(document.querySelector("img[onerror]")).toBeNull();
  expect(screen.getByText(/Don't include personal or confidential information/)).toBeVisible();
});

// Replacing instead of appending batches loses the first cards and fails this test.
it("retains distinct Show more results, announces the count and honest exhaustion", () => {
  render(<PreviewApp />); journey();
  const first = titles(); click("Show more");
  expect(titles().slice(0, 3)).toEqual(first);
  expect(new Set(titles()).size).toBe(4);
  expect(screen.getByRole("status")).toHaveTextContent("Showing all 4 catalog options. 1 more option revealed.");
  expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
});

// Dropping parent-owned context or batches during navigation fails these assertions.
it("preserves chips and Show more batches across discovery Back and concept inspection", () => {
  render(<PreviewApp />); journey(); click("Show more");
  const all = titles(); click("View concept: Check-in Queue Planner");
  expect(screen.getByRole("heading", { name: "Check-in Queue Planner" })).toHaveFocus();
  expect(screen.queryByRole("button", { name: /launch/i })).not.toBeInTheDocument();
  click("Back to recommendations"); expect(titles()).toEqual(all);
  click("Back to choices");
  expect(screen.getByRole("button", { name: "Visibility" })).toHaveAttribute("aria-pressed", "true");
  click("Back");
  expect(screen.getByRole("button", { name: "100–500 attendees" })).toHaveAttribute("aria-pressed", "true");
  click("Back");
  expect(screen.getByRole("button", { name: "Cut check-in lines" })).toHaveAttribute("aria-pressed", "true");
  click("Continue"); click("Continue"); click("Explore solutions");
  expect(titles()).toEqual(all);
});

// Resetting the refinement draft on None fit / Back loses the user's unmet need.
it("retains unmet text and alternative goal across repeated None fit and Back", () => {
  render(<PreviewApp />); journey(); click("Show more"); click("None fit");
  fireEvent.change(screen.getByRole("textbox", { name: "What is still missing? (optional)" }), { target: { value: "A quiet check-in lane" } });
  click("Another goal"); click("Back to recommendations");
  expect(titles()).toHaveLength(4); click("None fit");
  expect(screen.getByRole("textbox", { name: "What is still missing? (optional)" })).toHaveValue("A quiet check-in lane");
  expect(screen.getByRole("button", { name: "Another goal" })).toHaveAttribute("aria-pressed", "true");
  click("Update suggestions");
  expect(screen.getByText("No catalog match yet")).toBeVisible();
  expect(screen.getByText("A quiet check-in lane")).toBeVisible();
  click("Browse this problem"); expect(screen.getAllByRole("article")).toHaveLength(3);
  expect(screen.getByText("A quiet check-in lane")).toBeVisible();
});

it("updates recommendations from an alternative goal and preserves optional context on Back", () => {
  render(<PreviewApp />); click("Something else");
  fireEvent.change(screen.getByRole("textbox", { name: "Optional context" }), { target: { value: "Outdoor event" } });
  click("Registration and check-in"); click("Continue"); click("Cut check-in lines"); click("Continue");
  click("100–500 attendees"); click("Continue"); click("Visibility"); click("Explore solutions");
  click("None fit"); click("Auto-issue badges & QR passes"); click("Update suggestions");
  expect(titles()[0]).toBe("Badge & QR Pass Concept");
  click("Back to choices"); click("Back"); click("Back"); click("Back"); click("Something else");
  expect(screen.getByRole("textbox", { name: "Optional context" })).toHaveValue("Outdoor event");
});

// Empty supplied catalog remains empty rather than fabricating or forcing a sample.
it("renders honest empty results with an available refinement action", () => {
  const onNoneFit = vi.fn();
  render(<RecommendationList items={[]} batch={1} onMore={() => {}} onNoneFit={onNoneFit} onSelect={() => {}} />);
  expect(screen.getByText("No catalog match yet")).toBeVisible();
  expect(screen.queryAllByRole("article")).toHaveLength(0);
  click("Refine your needs"); expect(onNoneFit).toHaveBeenCalledOnce();
});

it("shows actual working catalog status and launches its sample", () => {
  render(<PreviewApp />); journey(PROBLEMS.find((problem) => problem.id === "sponsor-leads")!);
  expect(screen.getByText("Working preview")).toBeVisible();
  click("Launch preview: Sponsor Lead Desk");
  expect(screen.getByRole("heading", { level: 1, name: "Sponsor Lead Desk" })).toHaveFocus();
  expect(screen.getByRole("status", { name: "Guided progress" })).toHaveTextContent("0 of 3");
  expect(screen.queryByText("Sample launch is not connected in this build yet.")).not.toBeInTheDocument();
});

it.each(CATALOG.filter((item) => item.buildStatus === "recommended-solution"))("does not offer a launch for concept $id", (solution) => {
  render(<ConceptDetails solution={solution} onBack={() => {}} />);
  expect(screen.getByText("Recommended solution")).toBeVisible();
  expect(screen.getByText(solution.concept)).toBeVisible();
  expect(screen.queryByRole("button", { name: /launch|try sample/i })).not.toBeInTheDocument();
});

it("restores valid choices with exactly one guarded storage read and no writes or transmission", () => {
  const restored = contextFor("registration");
  const get = vi.mocked(Storage.prototype.getItem).mockReturnValue(JSON.stringify(restored));
  const writes = ["setItem", "removeItem", "clear"].map((name) => vi.spyOn(Storage.prototype, name as "setItem").mockImplementation(() => {}));
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  render(<PreviewApp />);
  expect(screen.getByRole("button", { name: "Visibility" })).toHaveAttribute("aria-pressed", "true");
  click("Explore solutions"); click("Show more"); click("None fit");
  fireEvent.change(screen.getByRole("textbox", { name: "What is still missing? (optional)" }), { target: { value: "Do not transmit" } });
  click("Update suggestions");
  expect(get).toHaveBeenCalledTimes(1); expect(get).toHaveBeenCalledWith("xappx_discovery");
  writes.forEach((write) => expect(write).not.toHaveBeenCalled()); expect(fetch).not.toHaveBeenCalled();
});

it.each([
  ["corrupt saved discovery", "{oops", /couldn't restore saved choices/],
  ["ambiguous matchmaking", JSON.stringify(legacyDiscovery("matchmaking", ["Capture qualified leads"])), /could mean Networking and matchmaking or Sponsor leads/],
  ["ambiguous logistics", JSON.stringify(legacyDiscovery("logistics")), /covers event operations, agendas and scheduling, or budgets and vendors/],
  ["other industry", JSON.stringify({ ...legacyDiscovery("Other challenge"), industry: { slug: "healthcare", label: "Healthcare" } }), /Your saved industry is Healthcare/],
])("keeps recovery and context notices visible for %s", (_name, saved, notice) => {
  vi.mocked(Storage.prototype.getItem).mockReturnValue(saved);
  render(<PreviewApp />);
  expect(screen.getByText(notice)).toBeVisible();
  click("Registration and check-in"); click("Continue");
  expect(screen.getByText(notice)).toBeVisible();
});

it("retains saved legacy context for review without turning it into a selection", () => {
  vi.mocked(Storage.prototype.getItem).mockReturnValue(JSON.stringify(legacyDiscovery("matchmaking", ["Capture qualified leads"])));
  render(<PreviewApp />); click("Review saved context");
  expect(screen.getByText("matchmaking")).toBeVisible();
  expect(screen.getByText("Capture qualified leads")).toBeVisible();
  expect(screen.getByRole("button", { name: "Sponsor leads" })).toHaveAttribute("aria-pressed", "false");
});

it("recovers when storage access is denied", () => {
  vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
  render(<PreviewApp />);
  expect(screen.getByText(/Saved choices are unavailable/)).toBeVisible(); journey();
  expect(screen.getAllByRole("article")).toHaveLength(3);
});

it("supports keyboard selection and keeps guidance explicitly predefined", async () => {
  const user = userEvent.setup(); render(<PreviewApp />);
  const option = screen.getByRole("button", { name: "Sponsor leads" }); option.focus();
  await user.keyboard(" "); expect(option).toHaveAttribute("aria-pressed", "true");
  screen.getByRole("button", { name: "Continue" }).focus(); await user.keyboard("{Enter}");
  expect(screen.getByRole("heading", { name: "What would a better outcome look like?" })).toHaveFocus();
  expect(screen.getByText("Predefined Xappy guidance")).toBeVisible();
  expect(screen.getByText("Live Xappy chat is not connected in this preview.")).toBeVisible();
});

it("provides deterministic guidance for every step without reading optional text", () => {
  const context = contextFor("registration");
  for (const step of ["problem", "goal", "scale", "priority", "recommendations", "refine"] as const) {
    const normal = guidanceFor(context, step);
    expect(normal.length).toBeGreaterThan(20);
    expect(guidanceFor({ ...context, note: "private-content", uncoveredNeed: "private-content" }, step)).toBe(normal);
  }
});

// A separate input boundary is needed on refinement; the discovery note limit is not enough.
it("caps unmet-need text at 500 and retains it when browsing a different problem", () => {
  render(<PreviewApp />); journey(); click("None fit");
  fireEvent.change(screen.getByRole("textbox", { name: "What is still missing? (optional)" }), { target: { value: "z".repeat(501) } });
  expect(screen.getByRole("textbox", { name: "What is still missing? (optional)" })).toHaveValue("z".repeat(500));
  click("Choose another problem"); journey(PROBLEMS.find((problem) => problem.id === "networking")!);
  expect(screen.getByText("z".repeat(500))).toBeVisible();
});

it("keeps the blank Something else selection when returning from results", () => {
  render(<PreviewApp />); click("Something else"); click("Continue");
  click("Not sure yet"); click("Continue"); click("Speed"); click("Explore solutions");
  click("Back to choices"); click("Back"); click("Back");
  expect(screen.getByRole("button", { name: "Something else" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
});

// History stores destinations, not old answers. A goal needs a current category;
// reconciling that destination must neither add entries nor erase explicit edits.
it.each(["", "An outdoor event"])("reconciles a stale Forward goal after Something else without history loops (note: %s)", (note) => {
  render(<PreviewApp />); const problemState = window.history.state;
  click("Registration and check-in"); click("Continue"); const goalState = window.history.state;
  click("Cut check-in lines"); click("Continue"); const scaleState = window.history.state;
  click("100–500 attendees"); click("Continue"); const priorityState = window.history.state;
  click("Visibility"); click("Explore solutions"); click("None fit");
  fireEvent.change(screen.getByRole("textbox", { name: "What is still missing? (optional)" }), { target: { value: "A quiet lane" } });
  const pop = (state: unknown) => fireEvent(window, new PopStateEvent("popstate", { state }));
  pop(problemState); click("Something else");
  fireEvent.change(screen.getByRole("textbox", { name: "Optional context" }), { target: { value: note } });
  const push = vi.spyOn(window.history, "pushState");
  const replace = vi.spyOn(window.history, "replaceState");
  const length = window.history.length;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    pop(goalState);
    expect(screen.getByRole("heading", { name: "What would you like to improve?" })).toHaveFocus();
    expect(screen.queryByRole("heading", { name: "What would a better outcome look like?" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Something else" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { name: "Optional context" })).toHaveValue(note);
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    pop(scaleState);
    expect(screen.getByRole("button", { name: "100–500 attendees" })).toHaveAttribute("aria-pressed", "true");
    pop(priorityState);
    expect(screen.getByRole("button", { name: "Visibility" })).toHaveAttribute("aria-pressed", "true");
    pop(problemState);
  }
  expect(push).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled();
  expect(window.history.length).toBe(length);
  // Explicit Continue still skips the inapplicable goal and keeps every note.
  click("Continue"); expect(screen.getByRole("heading", { name: "How big is your event?" })).toHaveFocus();
  click("Continue"); click("Explore solutions");
  expect(screen.getByText("No catalog match yet")).toBeVisible();
  expect(screen.getByText("A quiet lane")).toBeVisible();
  if (note) expect(screen.getByText(note)).toBeVisible();
});

it("uses the current category and explicit goal when replaying an older goal route", () => {
  render(<PreviewApp />); const problemState = window.history.state;
  click("Registration and check-in"); click("Continue"); const goalState = window.history.state;
  click("Cut check-in lines");
  fireEvent(window, new PopStateEvent("popstate", { state: problemState }));
  click("Sponsor leads");
  fireEvent(window, new PopStateEvent("popstate", { state: goalState }));
  expect(screen.getByRole("heading", { name: "What would a better outcome look like?" })).toHaveFocus();
  expect(screen.queryByRole("button", { name: "Cut check-in lines" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  click("Capture qualified leads");
  fireEvent(window, new PopStateEvent("popstate", { state: problemState }));
  fireEvent(window, new PopStateEvent("popstate", { state: goalState }));
  expect(screen.getByRole("button", { name: "Capture qualified leads" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
});

// An untouched refinement choice must follow the user's newer explicit discovery choice.
it.each([false, true])("does not restore a stale refinement goal after discovery changes (restored: %s)", (restored) => {
  if (restored) vi.mocked(Storage.prototype.getItem).mockReturnValue(JSON.stringify({ ...contextFor("registration"), note: "Outdoor registration", uncoveredNeed: "Quiet lane" }));
  render(<PreviewApp />);
  if (restored) click("Explore solutions"); else journey();
  click("None fit");
  expect(screen.getByRole("button", { name: "Cut check-in lines" })).toHaveAttribute("aria-pressed", "true");
  click("Back to recommendations"); click("Back to choices"); click("Back"); click("Back");
  click("Auto-issue badges & QR passes"); click("Continue"); click("Continue"); click("Explore solutions");
  expect(titles()[0]).toBe("Badge & QR Pass Concept");
  click("None fit");
  expect(screen.getByRole("button", { name: "Auto-issue badges & QR passes" })).toHaveAttribute("aria-pressed", "true");
  click("Update suggestions");
  expect(titles()[0]).toBe("Badge & QR Pass Concept");
  expect(within(screen.getByRole("list", { name: "Your choices" })).getByText("Auto-issue badges & QR passes")).toBeVisible();
  if (restored) {
    expect(screen.getByText("Outdoor registration")).toBeVisible();
    expect(screen.getByText("Quiet lane")).toBeVisible();
  }
});

// Explicitly edited drafts remain valid across ordinary Back, but a newer discovery goal supersedes them.
it("reconciles an edited refinement draft only when its originating discovery goal changes", () => {
  render(<PreviewApp />); journey(); click("None fit");
  click("Another goal");
  fireEvent.change(screen.getByRole("textbox", { name: "What is still missing? (optional)" }), { target: { value: "Quiet lane" } });
  click("Back to recommendations"); click("Back to choices");
  click("Speed"); click("Explore solutions"); click("None fit");
  expect(screen.getByRole("button", { name: "Another goal" })).toHaveAttribute("aria-pressed", "true");
  click("Back to recommendations"); click("Back to choices"); click("Back"); click("Back");
  click("Auto-issue badges & QR passes"); click("Continue"); click("Continue"); click("Explore solutions"); click("None fit");
  expect(screen.getByRole("button", { name: "Auto-issue badges & QR passes" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("textbox", { name: "What is still missing? (optional)" })).toHaveValue("Quiet lane");
});

// Removing the empty-state control must not leave keyboard focus on BODY.
it("focuses the results heading after keyboard recovery through Browse this problem", async () => {
  const user = userEvent.setup(); render(<PreviewApp />); journey();
  click("None fit"); click("Another goal"); click("Update suggestions");
  const browse = screen.getByRole("button", { name: "Browse this problem" }); browse.focus();
  await user.keyboard("{Enter}");
  expect(screen.getAllByRole("article")).toHaveLength(3);
  expect(screen.queryByRole("button", { name: "Browse this problem" })).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Explore your possibilities" })).toHaveFocus();
  expect(screen.getByRole("status")).toHaveTextContent("Showing 3 of 4 catalog options.");
  click("Show more");
  expect(screen.getByRole("status")).toHaveTextContent("Showing all 4 catalog options. 1 more option revealed.");
});

// Applying a draft commits its origin too; returning to the old goal must not resurrect that draft.
it("does not resurrect an applied refinement when discovery returns to its previous goal", () => {
  render(<PreviewApp />); journey();
  click("None fit"); click("Auto-issue badges & QR passes"); click("Update suggestions");
  expect(titles()[0]).toBe("Badge & QR Pass Concept");
  click("Back to choices"); click("Back"); click("Back");
  click("Cut check-in lines"); click("Continue"); click("Continue"); click("Explore solutions");
  expect(titles()[0]).toBe("Check-in Queue Planner");
  click("None fit");
  expect(screen.getByRole("button", { name: "Cut check-in lines" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Auto-issue badges & QR passes" })).toHaveAttribute("aria-pressed", "false");
  click("Update suggestions");
  expect(titles()[0]).toBe("Check-in Queue Planner");
  expect(within(screen.getByRole("list", { name: "Your choices" })).getByText("Cut check-in lines")).toBeVisible();
});

// A real discovery transition supersedes a pending draft even if the user returns to its source goal.
it("invalidates a pending refinement after discovery changes away and back before reopening", () => {
  render(<PreviewApp />); journey(); click("None fit"); click("Another goal");
  click("Back to recommendations"); click("Back to choices"); click("Back"); click("Back");
  click("Auto-issue badges & QR passes"); click("Cut check-in lines");
  click("Continue"); click("Continue"); click("Explore solutions"); click("None fit");
  expect(screen.getByRole("button", { name: "Cut check-in lines" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Another goal" })).toHaveAttribute("aria-pressed", "false");
});
