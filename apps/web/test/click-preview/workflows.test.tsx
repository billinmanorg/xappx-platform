import { useReducer } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkingPreview } from "../../src/click-preview/WorkingPreview";
import { RecordList } from "../../src/click-preview/RecordList";
import { RecordDetails } from "../../src/click-preview/RecordDetails";
import { GuidedProgress } from "../../src/click-preview/GuidedProgress";
import { PreviewApp } from "../../src/click-preview/PreviewApp";
import { createPreviewSession, previewReducer } from "../../src/click-preview/previewSession";
import type { PreviewSession, WorkflowId } from "../../src/click-preview/types";
import * as discoveryAdapter from "../../src/click-preview/restore";
import { CATALOG } from "../../src/click-preview/catalog";
import { contextFor, legacyDiscovery } from "./fixtures";

const flows = [
  { workflow: "sponsor", title: "Sponsor Lead Desk", problem: "sponsor-leads", filter: "High", target: "Sample Cloudberry Studio", other: "Sample Pebble Labs", action: "Mark Qualified", final: "Qualified", count: "Qualified leads", fields: ["Company", "Interest", "Owner", "Stage"] },
  { workflow: "speaker", title: "Speaker Submission Review", problem: "speaker-submissions", filter: "Experience", target: "Sample: Welcoming every attendee", other: "Sample: Making space for conversation", action: "Mark Shortlisted", final: "Shortlisted", count: "Shortlisted submissions", fields: ["Title", "Topic", "Format", "Abstract", "Status"] },
  { workflow: "operations", title: "Event Operations Board", problem: "event-operations", filter: null, target: "Sample: Hall A microphone check", other: "Sample: Entry sign missing", action: "Set In progress", final: "In progress", count: "In-progress incidents", fields: ["Incident", "Severity", "Location", "Sample team", "Status"] },
] as const;
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const progress = () => screen.getByRole("status", { name: "Guided progress" });
const details = () => screen.getByRole("region", { name: "Record details" });
const list = () => screen.getByRole("list", { name: "Sample records" });
function Harness({ workflow = "sponsor", initial }: { workflow?: WorkflowId; initial?: PreviewSession }) {
  const [session, dispatch] = useReducer(previewReducer, initial ?? createPreviewSession(workflow, legacyDiscovery()));
  return <div className="preview-app"><WorkingPreview session={session} dispatch={dispatch} onBack={() => {}} onReset={() => {}} onChangeWorkflow={() => {}} /><output aria-label="Session gate">{session.gate}</output></div>;
}
function firstTwo(flow: typeof flows[number]) {
  if (flow.filter) click(flow.filter);
  click(`Open ${flow.target}`);
  if (flow.workflow === "operations") click("Assign Sample AV team");
}
beforeEach(() => { vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null); });

// Removing an overview shortcut must focus its new list, without stealing focus
// from stable navigation controls or charging inspection as a guided action.
it.each([
  { flow: flows[0], view: "Leads" },
  { flow: flows[1], view: "Submissions" },
  { flow: flows[2], view: "Incidents" },
  { flow: flows[2], view: "Tasks" },
])("focuses Browse $view destinations before and after guided completion", async ({ flow, view }) => {
  vi.mocked(Storage.prototype.getItem).mockReturnValue(JSON.stringify(contextFor(flow.problem)));
  const user = userEvent.setup(); render(<PreviewApp />);
  click("Explore solutions"); click(`Launch preview: ${flow.title}`);
  for (const completed of [false, true]) {
    const overview = screen.getByRole("button", { name: "Sample overview" });
    overview.focus(); await user.keyboard("{Enter}"); expect(overview).toHaveFocus();
    const browse = screen.getByRole("button", { name: `Browse ${view.toLowerCase()}` });
    browse.focus(); await user.keyboard("{Enter}");
    const region = screen.getByRole("region", { name: `${view} list` });
    expect(region).toBeVisible();
    expect(within(region).getByRole("heading", { name: view })).toHaveFocus();
    expect(region.closest(".working-workspace")).not.toHaveClass("has-record-detail");
    expect(screen.queryByRole("button", { name: `Browse ${view.toLowerCase()}` })).not.toBeInTheDocument();
    expect(progress()).toHaveTextContent(completed ? "3 of 3" : "0 of 3");
    const navigation = screen.getByRole("button", { name: flow.workflow === "operations" ? "Incidents" : view });
    navigation.focus(); await user.keyboard("{Enter}"); expect(navigation).toHaveFocus();
    if (!completed) { firstTwo(flow); click(flow.action); }
    else {
      expect(screen.getByRole("status", { name: "Sample result" })).toHaveTextContent(flow.final);
      expect(screen.getByRole("group", { name: flow.count })).toHaveTextContent("2");
      click(`Open ${flow.target}`);
      expect(within(details()).getByText(flow.final, { selector: "dd" })).toBeVisible();
      expect(screen.getByRole("button", { name: flow.action })).toBeDisabled();
    }
  }
});

// All values, summaries and final states must come from the real Task 4 reducer.
describe.each(flows)("$title", (flow) => {
  it("completes its three ordered actions, synchronizes records and announces the third result before plans", () => {
    render(<Harness workflow={flow.workflow} />);
    expect(progress()).toHaveTextContent("0 of 3");
    expect(screen.getByRole("heading", { level: 1, name: flow.title })).toBeVisible();
    expect(screen.queryByRole("button", { name: "View proposed plans" })).not.toBeInTheDocument();
    if (flow.filter) {
      click(flow.filter); expect(progress()).toHaveTextContent("1 of 3");
      expect(within(list()).getAllByRole("button")).toHaveLength(3);
    }
    click(`Open ${flow.target}`);
    expect(progress()).toHaveTextContent(flow.filter ? "2 of 3" : "1 of 3");
    expect(within(details()).getByRole("heading", { name: flow.target })).toHaveFocus();
    flow.fields.forEach((field) => expect(within(details()).getByText(field, { selector: "dt" })).toBeVisible());
    if (!flow.filter) { click("Assign Sample AV team"); expect(progress()).toHaveTextContent("2 of 3"); }
    click(flow.action);
    expect(progress()).toHaveTextContent("3 of 3");
    expect(screen.getByLabelText("Session gate")).toHaveTextContent("result");
    expect(within(details()).getByText(flow.final, { selector: "dd" })).toBeVisible();
    expect(within(list()).getByRole("button", { name: `Open ${flow.target}` })).toHaveTextContent(flow.final);
    expect(screen.getByRole("group", { name: flow.count })).toHaveTextContent("2");
    expect(screen.getByRole("status", { name: "Sample result" })).toHaveTextContent(flow.final);
    expect(screen.getByRole("heading", { name: "Your sample result" })).toHaveFocus();
    expect(screen.getByRole("button", { name: flow.action })).toBeDisabled();
    expect(screen.getByText(/Edits are locked/)).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Proposed plans" })).not.toBeInTheDocument();
    click("View proposed plans");
    expect(screen.getByLabelText("Session gate")).toHaveTextContent("plans");
  });

  it("does not charge inspection, repeated clicks or wrong-record attempts, and remains inspectable after completion", () => {
    render(<Harness workflow={flow.workflow} />);
    click(`Open ${flow.other}`);
    expect(progress()).toHaveTextContent("0 of 3");
    expect(screen.getByRole("button", { name: flow.action })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: flow.action }));
    expect(progress()).toHaveTextContent("0 of 3");
    click("Back to records");
    if (flow.filter) { click(flow.filter); click(flow.filter); }
    click(`Open ${flow.target}`);
    click("Back to records"); click(`Open ${flow.target}`);
    expect(progress()).toHaveTextContent(flow.filter ? "2 of 3" : "1 of 3");
    if (!flow.filter) { click("Assign Sample AV team"); fireEvent.click(screen.getByRole("button", { name: "Assign Sample AV team" })); }
    const action = screen.getByRole("button", { name: flow.action });
    fireEvent.click(action); fireEvent.click(action); fireEvent.doubleClick(action);
    expect(progress()).toHaveTextContent("3 of 3");
    click("Back to records"); click(`Open ${flow.other}`);
    expect(within(details()).getByRole("heading", { name: flow.other })).toBeVisible();
    expect(screen.getByRole("button", { name: flow.action })).toBeDisabled();
    expect(progress()).toHaveTextContent("3 of 3");
    click("Back to records"); click(`Open ${flow.target}`);
    expect(within(details()).getByText(flow.final, { selector: "dd" })).toBeVisible();
  });

  it("supports keyboard-only guided actions and accessible progress", async () => {
    const user = userEvent.setup(); render(<Harness workflow={flow.workflow} />);
    const activate = async (name: string) => { screen.getByRole("button", { name }).focus(); await user.keyboard("{Enter}"); };
    if (flow.filter) await activate(flow.filter);
    await activate(`Open ${flow.target}`);
    if (!flow.filter) await activate("Assign Sample AV team");
    await activate(flow.action);
    expect(progress()).toHaveAttribute("aria-live", "polite");
    expect(progress()).toHaveTextContent("3 of 3");
    expect(screen.getByRole("heading", { name: "Your sample result" })).toHaveFocus();
  });
});

it.each(flows.filter((flow) => flow.filter))("recovers early $workflow inspection with a changed filter, and preserves a repeated filter selection", (flow) => {
  render(<Harness workflow={flow.workflow} />);
  click(`Open ${flow.target}`);
  expect(progress()).toHaveTextContent("0 of 3");
  expect(screen.getByRole("alert")).toHaveTextContent(/prompted guided step/);
  click(flow.filter!);
  expect(screen.queryByRole("region", { name: "Record details" })).not.toBeInTheDocument();
  expect(progress()).toHaveTextContent("1 of 3");
  click(`Open ${flow.target}`); click(flow.filter!);
  expect(within(details()).getByRole("heading", { name: flow.target })).toBeVisible();
  expect(progress()).toHaveTextContent("2 of 3");
  click(flow.action); expect(progress()).toHaveTextContent("3 of 3");
});

it("keeps tasks and incidents separate, derives every summary, and never offers task mutations", () => {
  render(<Harness workflow="operations" />);
  expect(within(list()).getAllByRole("button")).toHaveLength(6);
  click("Tasks");
  expect(screen.getByRole("button", { name: "Tasks" })).toHaveAttribute("aria-current", "page");
  expect(within(list()).getAllByRole("button")).toHaveLength(6);
  expect(screen.queryByRole("button", { name: "Open Sample: Hall A microphone check" })).not.toBeInTheDocument();
  click("Open Sample: Check spare microphones");
  expect(within(details()).getByText("Sample AV team", { selector: "dd" })).toBeVisible();
  expect(screen.queryByRole("button", { name: /Assign Sample|Set In progress/ })).not.toBeInTheDocument();
  expect(progress()).toHaveTextContent("0 of 3");
  click("Incidents"); firstTwo(flows[2]); click("Set In progress");
  expect(screen.getByRole("group", { name: "Open incidents" })).toHaveTextContent("3");
  expect(screen.getByRole("group", { name: "Assigned incidents" })).toHaveTextContent("5");
  expect(screen.getByRole("group", { name: "Sample tasks" })).toHaveTextContent("6");
  click("Tasks"); click("Open Sample: Check spare microphones");
  expect(within(details()).getByText("To do", { selector: "dd" })).toBeVisible();
  click("Sample overview");
  expect(screen.getByRole("heading", { name: "A snapshot of your sample" })).toBeVisible();
  expect(progress()).toHaveTextContent("3 of 3");
});

it("renders empty filter results with a clear recovery that preserves progress", () => {
  const initial = createPreviewSession("sponsor", legacyDiscovery()); initial.filter = "No matching sample";
  render(<Harness initial={initial} />);
  expect(screen.getByText("No sample records match this filter.")).toBeVisible();
  click("Clear filter"); expect(within(list()).getAllByRole("button")).toHaveLength(6);
  expect(progress()).toHaveTextContent("0 of 3");
});

it("renders empty records, unavailable selections and invalid views without crashing or inventing data", () => {
  const onBack = vi.fn(); const onReset = vi.fn();
  const initial = { ...createPreviewSession("speaker", legacyDiscovery()), records: [], selectedId: "missing" };
  const { rerender } = render(<WorkingPreview session={initial} dispatch={() => {}} onBack={onBack} onReset={onReset} onChangeWorkflow={() => {}} />);
  expect(screen.getByText("No sample records are available.")).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent(/record is unavailable/);
  click("Reset demo"); expect(onReset).toHaveBeenCalledOnce();
  click("Back to recommendations"); expect(onBack).toHaveBeenCalledOnce();
  rerender(<WorkingPreview session={{ ...initial, view: "missing-view" }} dispatch={() => {}} onBack={onBack} onReset={onReset} onChangeWorkflow={() => {}} />);
  expect(screen.getByText(/This sample view is unavailable/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Submissions" })).toBeEnabled();
});

it("shows reducer recovery errors and does not mutate a stale or reused prompted record", () => {
  const initial = createPreviewSession("sponsor", legacyDiscovery());
  initial.records[0]!.values.company = "Substituted record";
  render(<Harness initial={initial} />); click("High"); click("Open Substituted record");
  expect(screen.getByRole("alert")).toHaveTextContent(/unavailable or has changed/);
  expect(progress()).toHaveTextContent("0 of 3");
  expect(screen.getByRole("button", { name: "Mark Qualified" })).toBeDisabled();
  expect(within(details()).getByText("New", { selector: "dd" })).toBeVisible();
});

it("delegates reset, Back and workflow changes without owning or silently discarding session state", () => {
  const onBack = vi.fn(); const onReset = vi.fn(); const onChangeWorkflow = vi.fn();
  const session = createPreviewSession("sponsor", legacyDiscovery());
  render(<WorkingPreview session={session} dispatch={() => {}} onBack={onBack} onReset={onReset} onChangeWorkflow={onChangeWorkflow} />);
  click("Reset demo"); click("Back to recommendations"); click("Speaker Submission Review");
  expect(onReset).toHaveBeenCalledOnce(); expect(onBack).toHaveBeenCalledOnce(); expect(onChangeWorkflow).toHaveBeenCalledWith("speaker");
  expect(session.completed).toEqual([]);
});

it("renders record components from provided data and consumes spec field labels and progress prompts", () => {
  const session = createPreviewSession("sponsor", legacyDiscovery()); const open = vi.fn();
  const { unmount } = render(<RecordList records={session.records} selectedId="LE-1040" onOpen={open} />);
  click("Open Sample Cloudberry Studio"); expect(open).toHaveBeenCalledWith("LE-1040");
  expect(screen.getByRole("button", { name: "Open Sample Cloudberry Studio" })).toHaveAttribute("aria-pressed", "true");
  unmount();
  session.spec.workflow[0]!.label = "A changed predefined prompt";
  session.spec.entities[0]!.fields[0]!.label = "Sample organization";
  render(<><GuidedProgress session={session} /><RecordDetails record={session.records[0]!} session={session} dispatch={() => {}} onBack={() => {}} /></>);
  expect(progress()).toHaveTextContent("A changed predefined prompt");
  expect(screen.getByText("Sample organization", { selector: "dt" })).toBeVisible();
});

// Integration prevents charging concept browsing, resetting on Back, extra storage reads or content requests.
describe("catalog launch and session integration", () => {
  it.each(flows)("launches the real $title only from a working card", (flow) => {
    vi.mocked(Storage.prototype.getItem).mockReturnValue(JSON.stringify(contextFor(flow.problem)));
    render(<PreviewApp />); click("Explore solutions");
    expect(screen.queryByRole("status", { name: "Guided progress" })).not.toBeInTheDocument();
    click(`Launch preview: ${flow.title}`);
    expect(screen.getByRole("heading", { level: 1, name: flow.title })).toHaveFocus();
    expect(progress()).toHaveTextContent("0 of 3");
    expect(screen.getByRole("navigation", { name: "Preview journey" }).querySelector('[aria-current="step"]')).toHaveTextContent("Try");
    expect(screen.queryByText(/Sample launch is not connected/)).not.toBeInTheDocument();
  });

  it("preserves progress, selection and edits through Back, concepts and explicit plans return without writes or transmission", () => {
    const get = vi.mocked(Storage.prototype.getItem).mockReturnValue(JSON.stringify(contextFor("sponsor-leads")));
    const writes = ["setItem", "removeItem", "clear"].map((name) => vi.spyOn(Storage.prototype, name as "setItem").mockImplementation(() => {}));
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    render(<PreviewApp />); click("Explore solutions"); click("Show more"); click("Launch preview: Sponsor Lead Desk");
    firstTwo(flows[0]); click("Mark Qualified");
    click("Back to recommendations"); expect(screen.getAllByRole("article")).toHaveLength(4);
    const concept = CATALOG.find((item) => item.problemIds.includes("sponsor-leads") && item.buildStatus === "recommended-solution")!;
    click(`View concept: ${concept.title}`);
    expect(screen.queryByRole("status", { name: "Guided progress" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Launch preview/ })).not.toBeInTheDocument();
    click("Back to recommendations"); click("Launch preview: Sponsor Lead Desk");
    expect(progress()).toHaveTextContent("3 of 3");
    expect(within(details()).getByText("Qualified", { selector: "dd" })).toBeVisible();
    click("View proposed plans");
    expect(screen.getByRole("heading", { name: "Proposed plans" })).toHaveFocus();
    click("Return to preview");
    expect(progress()).toHaveTextContent("3 of 3");
    expect(screen.getByRole("button", { name: "Mark Qualified" })).toBeDisabled();
    expect(within(details()).getByText("Qualified", { selector: "dd" })).toBeVisible();
    expect(get).toHaveBeenCalledTimes(1); writes.forEach((write) => expect(write).not.toHaveBeenCalled()); expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves an active session when reset or another workflow confirmation is cancelled", () => {
    vi.mocked(Storage.prototype.getItem).mockReturnValue(JSON.stringify(contextFor("event-operations")));
    render(<PreviewApp />); click("Explore solutions"); click("Launch preview: Event Operations Board");
    firstTwo(flows[2]);
    click("Reset demo");
    expect(screen.getByRole("dialog")).toBeVisible(); click("Cancel");
    expect(progress()).toHaveTextContent("2 of 3");
    click("Speaker Submission Review");
    expect(screen.getByRole("dialog")).toBeVisible(); click("Cancel");
    expect(screen.getByRole("heading", { level: 1, name: "Event Operations Board" })).toBeVisible();
    expect(within(details()).getByText("Sample AV team", { selector: "dd" })).toBeVisible();
    click("Set In progress"); expect(progress()).toHaveTextContent("3 of 3");
  });

  it("reload starts a fresh working session while restored discovery stays unchanged", () => {
    vi.mocked(Storage.prototype.getItem).mockReturnValue(JSON.stringify(contextFor("sponsor-leads")));
    const { unmount } = render(<PreviewApp />); click("Explore solutions"); click("Launch preview: Sponsor Lead Desk");
    firstTwo(flows[0]); click("Mark Qualified"); unmount();
    render(<PreviewApp />); click("Explore solutions"); click("Launch preview: Sponsor Lead Desk");
    expect(progress()).toHaveTextContent("0 of 3");
    expect(screen.getByRole("group", { name: "Qualified leads" })).toHaveTextContent("1");
  });
});

it("restores record-list focus only after the separate mobile detail has closed", () => {
  render(<Harness />); click("High"); click("Open Sample Cloudberry Studio");
  const heading = screen.getByRole("heading", { name: "Leads" });
  let detailWasClosed = false;
  const focus = vi.spyOn(heading, "focus").mockImplementation(() => {
    // A mobile browser cannot focus the list while its workspace has this class:
    // the responsive stylesheet applies display:none until the detail is closed.
    detailWasClosed = !heading.closest(".working-workspace")?.classList.contains("has-record-detail");
  });
  click("Back to records"); expect(focus).toHaveBeenCalledOnce(); expect(detailWasClosed).toBe(true);
});

it("preserves the records view through recommendation Back and a plans round trip", () => {
  vi.mocked(Storage.prototype.getItem).mockReturnValue(JSON.stringify(contextFor("sponsor-leads")));
  render(<PreviewApp />); click("Explore solutions"); click("Launch preview: Sponsor Lead Desk");
  firstTwo(flows[0]); click("Mark Qualified"); click("Back to records");
  expect(screen.queryByRole("region", { name: "Record details" })).not.toBeInTheDocument();
  click("Back to recommendations"); click("Launch preview: Sponsor Lead Desk");
  expect(screen.queryByRole("region", { name: "Record details" })).not.toBeInTheDocument();
  click("View proposed plans"); click("Return to preview");
  expect(screen.queryByRole("region", { name: "Record details" })).not.toBeInTheDocument();
  expect(progress()).toHaveTextContent("3 of 3");
  click("Open Sample Cloudberry Studio");
  expect(within(details()).getByText("Qualified", { selector: "dd" })).toBeVisible();
});


it("adapts discovery only at first launch and protects an existing session from a different recommendation", () => {
  const adapt = vi.spyOn(discoveryAdapter, "toLegacyDiscovery");
  vi.mocked(Storage.prototype.getItem).mockReturnValue(JSON.stringify(contextFor("sponsor-leads")));
  render(<PreviewApp />); click("Explore solutions");
  expect(adapt).not.toHaveBeenCalled();
  click("Launch preview: Sponsor Lead Desk"); firstTwo(flows[0]);
  expect(adapt).toHaveBeenCalledOnce();
  click("Back to recommendations"); click("Back to choices"); click("Back"); click("Back"); click("Back");
  click("Speaker submissions"); click("Continue"); click("Review speaker submissions"); click("Continue");
  click("Continue"); click("Explore solutions"); click("Launch preview: Speaker Submission Review");
  expect(screen.getByRole("dialog", { name: "Change working preview?" })).toBeVisible(); click("Cancel");
  expect(screen.getByRole("heading", { name: "Explore your possibilities" })).toBeVisible();
  expect(adapt).toHaveBeenCalledOnce();
  click("Back to choices"); click("Back"); click("Back"); click("Back");
  click("Sponsor leads"); click("Continue"); click("Capture qualified leads"); click("Continue"); click("Continue"); click("Explore solutions");
  click("Launch preview: Sponsor Lead Desk");
  expect(progress()).toHaveTextContent("2 of 3");
  expect(within(details()).getByRole("heading", { name: "Sample Cloudberry Studio" })).toBeVisible();
  expect(adapt).toHaveBeenCalledOnce();
});
