import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { contextFor } from "./fixtures";

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const saved = JSON.stringify({ ...contextFor("sponsor-leads"), note: "An inert <sample> note", uncoveredNeed: "A quiet sponsor area" });
async function start(page: Page) {
  await page.addInitScript((raw) => {
    if (sessionStorage.getItem("xappx_discovery") === null) sessionStorage.setItem("xappx_discovery", raw);
    const writes: string[] = [];
    Object.assign(window, { previewStorageWrites: writes });
    for (const name of ["setItem", "removeItem", "clear"] as const) {
      const original = Storage.prototype[name];
      Object.defineProperty(Storage.prototype, name, { value: function (...args: string[]) {
        writes.push(name); return Reflect.apply(original, this, args);
      } });
    }
  }, saved);
  await page.goto("/"); await button(page, "Explore solutions").click(); await button(page, "Show more").click();
  await button(page, "Launch preview: Sponsor Lead Desk").click();
}
async function complete(page: Page) {
  await button(page, "High").click(); await button(page, "Open Sample Cloudberry Studio").click(); await button(page, "Mark Qualified").click();
}
async function safety(page: Page) {
  expect(await page.evaluate(() => ({ raw: sessionStorage.getItem("xappx_discovery"), local: localStorage.length,
    writes: (window as unknown as { previewStorageWrites: string[] }).previewStorageWrites }))).toEqual({ raw: saved, local: 0, writes: [] });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const target of await page.getByRole("button").all()) {
    expect((await target.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
}

for (const note of ["", "An outdoor event"]) {
  test(`Forward reconciles an old goal after Something else without adding history (note: ${note || "blank"})`, async ({ page }) => {
    await page.goto("/");
    const problemState = await page.evaluate(() => history.state);
    await button(page, "Registration and check-in").click(); await button(page, "Continue").click();
    const goalState = await page.evaluate(() => history.state);
    const length = await page.evaluate(() => history.length);
    await page.goBack(); await expect(page.getByRole("heading", { name: "What would you like to improve?" })).toBeFocused();
    await button(page, "Something else").click();
    if (note) await page.getByRole("textbox", { name: "Optional context" }).fill(note);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await page.goForward();
      await expect(page.getByRole("heading", { name: "What would you like to improve?" })).toBeFocused();
      await expect(page.getByRole("heading", { name: "What would a better outcome look like?" })).toHaveCount(0);
      await expect(button(page, "Something else")).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("textbox", { name: "Optional context" })).toHaveValue(note);
      await expect(button(page, "Continue")).toBeEnabled();
      expect(await page.evaluate(() => ({ state: history.state, length: history.length }))).toEqual({ state: goalState, length });
      await page.goBack();
      await expect(page.getByRole("heading", { name: "What would you like to improve?" })).toBeFocused();
      expect(await page.evaluate(() => ({ state: history.state, length: history.length }))).toEqual({ state: problemState, length });
    }
    await page.goForward(); await expect(button(page, "Continue")).toBeEnabled();
    await button(page, "Continue").click();
    await expect(page.getByRole("heading", { name: "How big is your event?" })).toBeFocused();
    await button(page, "Not sure yet").click(); await button(page, "Continue").click();
    await button(page, "Speed").click(); await button(page, "Explore solutions").click();
    await expect(page.getByText("No catalog match yet")).toBeVisible();
    if (note) await expect(page.getByText(note, { exact: true })).toBeVisible();
    await button(page, "Back to choices").click(); await button(page, "Back").click(); await button(page, "Back").click();
    await expect(button(page, "Something else")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("textbox", { name: "Optional context" })).toHaveValue(note);
    await expect(button(page, "Continue")).toBeEnabled();
  });
}

for (const width of [375, 768, 1440]) {
  test.describe(`plans and confirmation at ${width}px`, () => {
    test.use({ viewport: { width, height: 1000 }, hasTouch: width === 375, reducedMotion: "reduce" });
    test("third result, exact proposed plans, keyboard return, browser history and no checkout", async ({ page }) => {
      const requests: string[] = [];
      page.on("request", (request) => { if (request.method() !== "GET" || ["fetch", "xhr", "websocket", "eventsource"].includes(request.resourceType())) requests.push(request.url()); });
      await start(page); const url = page.url(); await complete(page);
      await expect(page.getByRole("heading", { name: "Your sample result" })).toBeFocused();
      await expect(page.getByRole("heading", { name: "Proposed plans" })).toHaveCount(0);
      await button(page, "View proposed plans").focus(); await page.keyboard.press("Enter");
      await expect(page.getByRole("heading", { name: "Proposed plans" })).toBeFocused();
      await expect(page.getByText("Proposed pricing · Subject to approval")).toBeVisible();
      for (const [name, price, apps, editors] of [["Starter", 49, 1, 2], ["Professional", 129, 5, 5], ["Agency", 299, 15, 15]] as const) {
        const plan = page.getByRole("article", { name });
        await expect(plan.getByText(`$${price}`, { exact: true })).toBeVisible();
        await expect(plan.getByText(`${apps} active ${apps === 1 ? "app" : "apps"}`, { exact: true })).toBeVisible();
        await expect(plan.getByText(`${editors} editors`, { exact: true })).toBeVisible();
        await expect(plan.getByRole("button")).toBeDisabled();
      }
      await expect(page.locator("form")).toHaveCount(0); await safety(page);
      await page.screenshot({ path: `test-results/click-preview/plans-${width}.png`, fullPage: true });
      await page.goBack(); await expect(page.getByRole("status", { name: "Sample result" })).toContainText("Qualified");
      await expect(button(page, "Mark Qualified")).toBeDisabled();
      await page.goForward(); await expect(page.getByRole("heading", { name: "Proposed plans" })).toBeFocused();
      if (width === 375) await button(page, "Return to preview").tap();
      else { await button(page, "Return to preview").focus(); await page.keyboard.press("Enter"); }
      await expect(button(page, "View proposed plans")).toBeFocused();
      await page.goBack(); await expect(page.getByRole("heading", { name: "Proposed plans" })).toHaveCount(0);
      await page.goForward(); await expect(page.getByRole("heading", { level: 1, name: "Sponsor Lead Desk" })).toBeVisible();
      await expect(page.getByRole("status", { name: "Guided progress" })).toContainText("3 of 3");
      await button(page, "Back to recommendations").click(); await expect(page.getByRole("article")).toHaveCount(4);
      await page.goBack(); await expect(page.getByRole("status", { name: "Guided progress" })).toContainText("3 of 3");
      expect(page.url()).toBe(url); expect(requests).toEqual([]); await safety(page);
    });
    test("Cancel, Close, Escape, focus trapping, confirmed reset and discovery preservation", async ({ page }) => {
      await start(page); await complete(page);
      for (const dismiss of ["Cancel", "Close confirmation", "Escape"]) {
        const before = await page.evaluate(() => ({ length: history.length, state: history.state }));
        await button(page, "Reset demo").click(); const dialog = page.getByRole("dialog", { name: "Reset this sample?" });
        await expect(dialog).toHaveAttribute("aria-modal", "true"); await expect(button(page, "Cancel")).toBeFocused();
        await button(page, "Confirm").focus(); await page.keyboard.press("Tab"); await expect(button(page, "Close confirmation")).toBeFocused();
        await page.keyboard.press("Shift+Tab"); await expect(button(page, "Confirm")).toBeFocused();
        expect(await page.evaluate(() => ({ length: history.length, state: history.state }))).toEqual(before);
        await safety(page);
        if (dismiss === "Escape") await page.keyboard.press("Escape"); else await button(page, dismiss).click();
        await expect(dialog).toHaveCount(0); await expect(button(page, "Reset demo")).toBeFocused();
        await expect(page.getByRole("status", { name: "Guided progress" })).toContainText("3 of 3");
      }
      await button(page, "Reset demo").click();
      await page.screenshot({ path: `test-results/click-preview/reset-dialog-${width}.png`, fullPage: true });
      await button(page, "Confirm").click(); await expect(page.getByRole("heading", { level: 1, name: "Sponsor Lead Desk" })).toBeFocused();
      await expect(page.getByRole("status", { name: "Guided progress" })).toContainText("0 of 3");
      await expect(page.getByRole("group", { name: "Qualified leads" })).toContainText("1");
      await button(page, "Back to recommendations").click(); await expect(page.getByRole("article")).toHaveCount(4);
      await expect(page.getByText("An inert <sample> note")).toBeVisible(); await expect(page.getByText("A quiet sponsor area")).toBeVisible(); await safety(page);
    });
  });
}

test("browser navigation dismisses confirmations; newer navigation truncates Forward; reload starts clean", async ({ page }) => {
  await start(page); await button(page, "High").click(); await button(page, "Reset demo").click();
  await page.goBack(); await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Explore your possibilities" })).toBeFocused();
  await page.goForward(); await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status", { name: "Guided progress" })).toContainText("1 of 3");
  await page.goBack(); await button(page, "None fit").click();
  await button(page, "Another goal").click(); await page.getByRole("textbox").fill("Another inert <tag> need");
  await page.goBack(); await expect(page.getByRole("article")).toHaveCount(4);
  await page.goForward(); await expect(button(page, "Another goal")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("textbox")).toHaveValue("Another inert <tag> need");
  await page.goBack(); await button(page, "Launch preview: Sponsor Lead Desk").click();
  await page.goForward(); await expect(page.getByRole("heading", { level: 1, name: "Sponsor Lead Desk" })).toBeVisible();
  await page.reload(); await expect(button(page, "Explore solutions")).toBeVisible();
  await page.goBack(); await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Proposed plans" })).toHaveCount(0);
  await button(page, "Explore solutions").click(); await button(page, "Launch preview: Sponsor Lead Desk").click();
  await expect(page.getByRole("status", { name: "Guided progress" })).toContainText("0 of 3"); await safety(page);
});

test("confirmed workflow switch invalidates the previous session and old plan routes", async ({ page }) => {
  await start(page); await complete(page); await button(page, "View proposed plans").click(); await button(page, "Return to preview").click();
  await button(page, "Speaker Submission Review").click(); await button(page, "Cancel").click();
  await expect(button(page, "Speaker Submission Review")).toBeFocused();
  await expect(page.getByRole("status", { name: "Guided progress" })).toContainText("3 of 3");
  await button(page, "Speaker Submission Review").click(); await button(page, "Confirm").click();
  await expect(page.getByRole("heading", { level: 1, name: "Speaker Submission Review" })).toBeFocused();
  await expect(page.getByRole("status", { name: "Guided progress" })).toContainText("0 of 3");
  await page.goBack(); await expect(page.getByRole("heading", { name: "Proposed plans" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Explore your possibilities" })).toBeVisible();
  await page.goForward(); await expect(page.getByRole("heading", { level: 1, name: "Speaker Submission Review" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Guided progress" })).toContainText("0 of 3"); await safety(page);
});


for (const width of [375, 768, 1440]) {
  test(`skip link preserves routes and Back/Forward at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await start(page); await complete(page);
    for (const view of ["working", "plans", "recommendations"]) {
      if (view === "plans") await button(page, "View proposed plans").click();
      if (view === "recommendations") { await button(page, "Return to preview").click(); await button(page, "Back to recommendations").click(); }
      const heading = view === "working" ? "Sponsor Lead Desk" : view === "plans" ? "Proposed plans" : "Explore your possibilities";
      const previousHeading = view === "working" ? "Explore your possibilities" : "Sponsor Lead Desk";
      for (const activation of ["click", "keyboard"]) {
        const before = await page.evaluate(() => ({ state: history.state, length: history.length, url: location.href,
          sample: document.querySelector(".working-preview")!.innerHTML }));
        const skip = page.getByRole("link", { name: "Skip to main content" });
        await expect(skip).toHaveAttribute("href", "#preview-content");
        await skip.focus();
        if (activation === "keyboard") await page.keyboard.press("Enter"); else await skip.click();
        await expect(page.getByRole("main")).toBeFocused();
        await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
        expect(await page.evaluate(() => ({ state: history.state, length: history.length, url: location.href,
          sample: document.querySelector(".working-preview")!.innerHTML }))).toEqual(before);
      }
      await page.goBack(); await expect(page.getByRole("heading", { level: 1, name: previousHeading })).toBeVisible();
      await page.goForward(); await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }
    await button(page, "Launch preview: Sponsor Lead Desk").click();
    await expect(page.getByRole("status", { name: "Guided progress" })).toContainText("3 of 3");
    await expect(page.getByRole("status", { name: "Sample result" })).toContainText("Qualified");
    await expect(button(page, "Mark Qualified")).toBeDisabled(); await safety(page);
  });
}
