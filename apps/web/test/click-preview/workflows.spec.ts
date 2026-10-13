import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PROBLEMS } from "../../src/click-preview/problems";
import { observeNativePointerInput } from "./pointerDiagnostics";

const flows = [
  { id: "sponsor", problem: "sponsor-leads", title: "Sponsor Lead Desk", filter: "High", target: "Sample Cloudberry Studio", other: "Sample Pebble Labs", action: "Mark Qualified", status: "Qualified", count: "Qualified leads", view: "Leads" },
  { id: "speaker", problem: "speaker-submissions", title: "Speaker Submission Review", filter: "Experience", target: "Sample: Welcoming every attendee", other: "Sample: Making space for conversation", action: "Mark Shortlisted", status: "Shortlisted", count: "Shortlisted submissions", view: "Submissions" },
  { id: "operations", problem: "event-operations", title: "Event Operations Board", filter: null, target: "Sample: Hall A microphone check", other: "Sample: Entry sign missing", action: "Set In progress", status: "In progress", count: "In-progress incidents", view: "Incidents" },
] as const;
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
async function launch(page: Page, flow: typeof flows[number]) {
  const problem = PROBLEMS.find((item) => item.id === flow.problem)!;
  await page.goto("/");
  await button(page, problem.label).click(); await button(page, "Continue").click();
  await button(page, problem.goals[0]!.label).click(); await button(page, "Continue").click();
  await button(page, "100–500 attendees").click(); await button(page, "Continue").click();
  await button(page, "Visibility").click(); await button(page, "Explore solutions").click();
  await button(page, `Launch preview: ${flow.title}`).click();
  await expect(page.getByRole("heading", { level: 1, name: flow.title })).toBeFocused();
}
async function verifyLayout(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const target of await page.getByRole("button").all()) {
    const bounds = await target.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
}
async function browseOverview(page: Page, flow: typeof flows[number], completed: number) {
  for (const view of flow.id === "operations" ? ["Tasks", "Incidents"] : [flow.view]) {
    const overview = button(page, "Sample overview");
    await overview.focus(); await page.keyboard.press("Enter"); await expect(overview).toBeFocused();
    await button(page, `Browse ${view.toLowerCase()}`).focus(); await page.keyboard.press("Enter");
    const heading = page.getByRole("region", { name: `${view} list` }).getByRole("heading", { name: view, exact: true });
    await expect(heading).toBeVisible(); await expect(heading).toBeFocused();
    expect(await heading.evaluate((node) => node.matches(":focus-visible") && getComputedStyle(node).outlineStyle !== "none")).toBe(true);
    await expect(page.getByRole("status", { name: "Guided progress" })).toContainText(`${completed} of 3`);
    const navigation = button(page, view);
    await navigation.focus(); await page.keyboard.press("Enter"); await expect(navigation).toBeFocused();
  }
}

for (const width of [375, 768, 1440]) {
  test.describe(`working previews at ${width}px`, () => {
    test.use({ viewport: { width, height: 1000 }, hasTouch: width === 375 });
    for (const flow of flows) {
      test(`${flow.title}: guided result, inspection, keyboard/touch and accessibility`, async ({ page }) => {
        const requests: string[] = [];
        page.on("request", (request) => {
          if (request.method() !== "GET" || ["fetch", "xhr", "websocket", "eventsource"].includes(request.resourceType())) requests.push(request.url());
        });
        await launch(page, flow);
        const activate = async (target: Locator) => {
          if (width === 375) await target.tap();
          else if (width === 768) { await target.focus(); await page.keyboard.press("Enter"); }
          else await target.click();
        };
        const progress = page.getByRole("status", { name: "Guided progress" });
        await expect(progress).toContainText("0 of 3");
        await expect(button(page, "View proposed plans")).toHaveCount(0);
        await browseOverview(page, flow, 0);
        await verifyLayout(page);
        await page.screenshot({ path: `test-results/click-preview/${flow.id}-${width}-list.png`, fullPage: true });
        await activate(button(page, `Open ${flow.other}`));
        await expect(progress).toContainText("0 of 3");
        await expect(button(page, flow.action)).toBeDisabled();
        if (width === 375) await expect(page.getByRole("list", { name: "Sample records" })).toHaveCount(0);
        await activate(button(page, "Back to records"));
        await expect(page.getByRole("heading", { name: flow.view, exact: true })).toBeFocused();
        if (flow.filter) {
          await activate(button(page, flow.filter)); await activate(button(page, flow.filter));
          await expect(progress).toContainText("1 of 3");
        }
        await activate(button(page, `Open ${flow.target}`));
        await expect(page.getByRole("region", { name: "Record details" }).getByRole("heading", { name: flow.target })).toBeFocused();
        await expect(progress).toContainText(flow.filter ? "2 of 3" : "1 of 3");
        await activate(button(page, "Back to records"));
        await activate(button(page, `Open ${flow.target}`));
        await expect(progress).toContainText(flow.filter ? "2 of 3" : "1 of 3");
        if (!flow.filter) {
          await expect(button(page, flow.action)).toBeDisabled();
          await activate(button(page, "Assign Sample AV team"));
          await expect(progress).toContainText("2 of 3");
        }
        await activate(button(page, flow.action));
        await expect(progress).toContainText("3 of 3");
        await expect(page.getByRole("heading", { name: "Your sample result" })).toBeFocused();
        await expect(page.getByRole("status", { name: "Sample result" })).toContainText(flow.status);
        await expect(page.getByRole("region", { name: "Record details" }).locator("dd", { hasText: new RegExp(`^${flow.status}$`) })).toBeVisible();
        await expect(page.getByRole("group", { name: flow.count })).toContainText("2");
        await expect(page.getByRole("heading", { name: "Proposed plans" })).toHaveCount(0);
        await expect(button(page, flow.action)).toBeDisabled();
        await verifyLayout(page);
        await page.screenshot({ path: `test-results/click-preview/${flow.id}-${width}-result.png`, fullPage: true });
        await activate(button(page, "View proposed plans"));
        await expect(page.getByRole("heading", { name: "Proposed plans" })).toBeFocused();
        await activate(button(page, "Return to preview"));
        await expect(progress).toContainText("3 of 3");
        await expect(button(page, flow.action)).toBeDisabled();
        await activate(button(page, "Back to records")); await activate(button(page, `Open ${flow.other}`));
        await expect(page.getByRole("region", { name: "Record details" }).getByRole("heading", { name: flow.other })).toBeVisible();
        await expect(button(page, flow.action)).toBeDisabled();
        await expect(page.getByRole("status", { name: "Sample result" })).toContainText(`${flow.target} is now ${flow.status}`);
        await activate(button(page, "Back to recommendations"));
        await expect(page.getByRole("article")).toHaveCount(3);
        await activate(button(page, `Launch preview: ${flow.title}`));
        await expect(progress).toContainText("3 of 3");
        await browseOverview(page, flow, 3);
        await activate(button(page, `Open ${flow.target}`));
        await expect(page.getByRole("region", { name: "Record details" }).locator("dd", { hasText: new RegExp(`^${flow.status}$`) })).toBeVisible();
        await expect(button(page, flow.action)).toBeDisabled();
        expect(requests).toEqual([]);
      });
    }
  });
}

for (const flow of flows.filter((item) => item.filter)) {
  test(`${flow.title}: early inspection, changed filters and rapid duplicate input`, async ({ page }) => {
    await launch(page, flow);
    const progress = page.getByRole("status", { name: "Guided progress" });
    await button(page, `Open ${flow.target}`).click();
    await expect(progress).toContainText("0 of 3");
    await expect(page.getByRole("alert")).toContainText("prompted guided step");
    const reportFilterInput = await observeNativePointerInput(button(page, flow.filter!));
    try { await button(page, flow.filter!).dblclick(); }
    finally { await reportFilterInput(); }
    await expect(page.getByRole("region", { name: "Record details" })).toHaveCount(0);
    await expect(progress).toContainText("1 of 3");
    const reportRecordInput = await observeNativePointerInput(button(page, `Open ${flow.target}`));
    try { await button(page, `Open ${flow.target}`).dblclick(); }
    finally { await reportRecordInput(); }
    await expect(progress).toContainText("2 of 3");
    // Two native click events in one browser turn exercise a stale UI handler
    // before React paints the disabled state; the reducer still allows one write.
    await button(page, flow.action).evaluate((element: HTMLButtonElement) => { element.click(); element.click(); });
    await expect(progress).toContainText("3 of 3");
    await expect(page.getByRole("group", { name: flow.count })).toContainText("2");
    await button(page, "Back to records").click(); await button(page, "All").click();
    await expect(page.getByRole("list", { name: "Sample records" }).getByRole("button")).toHaveCount(6);
    await expect(progress).toContainText("3 of 3");
  });
}

for (const width of [375, 768, 1440]) {
  test.describe(`recovery layout at ${width}px`, () => {
    test.use({ viewport: { width, height: 1000 }, hasTouch: width === 375 });
    for (const flow of flows.filter((item) => item.filter)) {
      test(`${flow.title}: clearing feedback keeps the pointer over the active filter`, async ({ page }) => {
        await launch(page, flow);
        await button(page, `Open ${flow.target}`).click();
        await expect(page.getByRole("alert")).toContainText("prompted guided step");
        if (width === 375) await button(page, "Back to records").tap();
        const filter = button(page, flow.filter!);
        await filter.scrollIntoViewIfNeeded();
        const before = await filter.boundingBox();
        expect(before).not.toBeNull();
        const feedback = page.locator(".sample-error-space");
        const feedbackBefore = await feedback.boundingBox();
        expect(feedbackBefore!.height).toBeGreaterThan(0);
        const reportInput = await observeNativePointerInput(filter);
        try {
          if (width === 375) await filter.tap();
          else await filter.click();
        } finally { await reportInput(); }
        await expect(page.getByRole("alert")).toHaveCount(0);
        await expect(page.getByRole("region", { name: "Record details" })).toHaveCount(0);
        await expect(page.getByRole("status", { name: "Guided progress" })).toContainText("1 of 3");
        const after = await filter.boundingBox();
        expect(after).not.toBeNull();
        expect((await feedback.boundingBox())!.height).toBeCloseTo(feedbackBefore!.height, 0);
        const point = { x: before!.x + before!.width / 2, y: before!.y + before!.height / 2 };
        expect(point.x).toBeGreaterThanOrEqual(after!.x);
        expect(point.x).toBeLessThan(after!.x + after!.width);
        expect(point.y).toBeGreaterThanOrEqual(after!.y);
        expect(point.y).toBeLessThan(after!.y + after!.height);
        expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("button")?.textContent, point)).toBe(flow.filter);
        await expect(filter).toBeFocused();
      });
    }
  });
}

test("operations has separate task inspection, correct summaries and retained edits on interrupted navigation", async ({ page }) => {
  await launch(page, flows[2]);
  const progress = page.getByRole("status", { name: "Guided progress" });
  await button(page, "Tasks").click();
  await expect(button(page, "Open Sample: Hall A microphone check")).toHaveCount(0);
  await button(page, "Open Sample: Check spare microphones").click();
  await expect(button(page, "Assign Sample AV team")).toHaveCount(0);
  await expect(progress).toContainText("0 of 3");
  await button(page, "Incidents").click(); await button(page, "Open Sample: Hall A microphone check").dblclick();
  await expect(progress).toContainText("1 of 3");
  await button(page, "Assign Sample AV team").evaluate((element: HTMLButtonElement) => { element.click(); element.click(); });
  await expect(page.getByRole("group", { name: "Assigned incidents" })).toContainText("5");
  await button(page, "Back to recommendations").click(); await button(page, "Launch preview: Event Operations Board").click();
  await expect(progress).toContainText("2 of 3");
  await expect(page.getByRole("region", { name: "Record details" }).locator("dd", { hasText: "Sample AV team" })).toBeVisible();
  await button(page, "Set In progress").evaluate((element: HTMLButtonElement) => { element.click(); element.click(); });
  await expect(progress).toContainText("3 of 3");
  await button(page, "Tasks").click();
  await button(page, "Open Sample: Check spare microphones").click();
  await expect(page.getByRole("region", { name: "Record details" }).locator("dd", { hasText: /^To do$/ })).toBeVisible();
  await expect(page.getByRole("group", { name: "Open incidents" })).toContainText("3");
  await expect(page.getByRole("group", { name: "Sample tasks" })).toContainText("6");
});

test("reload restarts records and progress without persisting preview actions", async ({ page }) => {
  await launch(page, flows[0]);
  await button(page, "High").click(); await button(page, "Open Sample Cloudberry Studio").click(); await button(page, "Mark Qualified").click();
  await expect(page.getByRole("status", { name: "Guided progress" })).toContainText("3 of 3");
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  await launch(page, flows[0]);
  await expect(page.getByRole("status", { name: "Guided progress" })).toContainText("0 of 3");
  await expect(page.getByRole("group", { name: "Qualified leads" })).toContainText("1");
});
