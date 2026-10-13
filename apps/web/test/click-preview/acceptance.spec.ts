import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { EVENTS_INDUSTRY, PROBLEMS } from "../../src/click-preview/problems";

type Audit = { requests: string[]; writes: string[]; reads: string[] };
declare global { interface Window { __acceptanceAudit: Audit; __markupExecuted?: boolean } }
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const artworkHash = createHash("sha256").update(readFileSync(new URL("../../src/click-preview/assets/xappy.png", import.meta.url))).digest("hex");

/** Installed before the app: observe attempted APIs even when CSP would block them. */
async function auditPreview(page: Page, baseURL: string, saved: string | null = null, denyStorage = false) {
  const network: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const asset = url.origin === new URL(baseURL).origin && request.method() === "GET" && !url.search
      && ((request.resourceType() === "document" && ["/", "/build"].includes(url.pathname))
        || (url.pathname.startsWith("/assets/") && ["script", "stylesheet", "image", "font"].includes(request.resourceType())));
    if (!asset) { network.push(`${request.method()} ${request.resourceType()} ${url.pathname}`); await route.abort(); }
    else await route.continue();
  });
  await page.addInitScript(({ saved, denyStorage }) => {
    // Test fixture seeding happens before application-write instrumentation.
    if (saved !== null) sessionStorage.setItem("xappx_discovery", saved);
    const audit: Audit = { requests: [], writes: [], reads: [] };
    window.__acceptanceAudit = audit;
    const session = sessionStorage;
    const originalGet = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      audit.reads.push(`${this === session ? "session" : "other"}:${key}`);
      return originalGet.call(this, key);
    };
    for (const method of ["setItem", "removeItem", "clear"] as const) {
      Storage.prototype[method] = function () { audit.writes.push(method); };
    }
    window.fetch = async () => { audit.requests.push("fetch"); throw new Error("Unexpected preview fetch"); };
    XMLHttpRequest.prototype.send = function () { audit.requests.push("XHR"); throw new Error("Unexpected preview XHR"); };
    navigator.sendBeacon = () => { audit.requests.push("beacon"); return false; };
    for (const name of ["WebSocket", "EventSource"] as const) {
      Object.defineProperty(window, name, { configurable: true, value: class {
        constructor() { audit.requests.push(name); throw new Error("Unexpected preview connection"); }
      } });
    }
    if (denyStorage) for (const name of ["sessionStorage", "localStorage"]) {
      Object.defineProperty(window, name, { configurable: true, get() { throw new DOMException("Denied", "SecurityError"); } });
    }
  }, { saved, denyStorage });
  return async () => {
    const audit = await page.evaluate(() => window.__acceptanceAudit);
    expect(audit.requests).toEqual([]); expect(audit.writes).toEqual([]);
    expect(audit.reads.every((read) => read === "session:xappx_discovery")).toBe(true);
    expect(network).toEqual([]); expect(errors).toEqual([]);
    await expect(page.locator('iframe, object, embed, script[src*="widget"], script[src*="cookies"], img[onerror]')).toHaveCount(0);
    expect(await page.evaluate(() => window.__markupExecuted)).toBeUndefined();
  };
}

async function accessCheck(page: Page) {
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const targets = page.locator('button:visible, a:visible, textarea:visible');
  for (const target of await targets.all()) {
    // Background controls inside an inert confirmation overlay are not targets.
    if (await target.evaluate((element) => !!element.closest("[inert]"))) continue;
    const bounds = await target.boundingBox();
    expect(bounds?.width, await target.innerText()).toBeGreaterThanOrEqual(44);
    expect(bounds?.height, await target.innerText()).toBeGreaterThanOrEqual(44);
  }
  expect(await page.locator(".preview-app").evaluate((root) => [root, ...root.querySelectorAll("*")].every((element) => {
    const css = getComputedStyle(element);
    return css.animationName === "none" && css.transitionDuration.split(",").every((value) => Number.parseFloat(value) === 0);
  }))).toBe(true);
}

const flows = [
  { problem: "sponsor-leads", title: "Sponsor Lead Desk", filter: "High", record: "Sample Cloudberry Studio", action: "Mark Qualified", result: "Qualified" },
  { problem: "speaker-submissions", title: "Speaker Submission Review", filter: "Experience", record: "Sample: Welcoming every attendee", action: "Mark Shortlisted", result: "Shortlisted" },
  { problem: "event-operations", title: "Event Operations Board", filter: null, record: "Sample: Hall A microphone check", action: "Set In progress", result: "In progress" },
] as const;

for (const width of [375, 768, 1440]) {
  test.describe(`release acceptance ${width}px`, () => {
    test.use({ viewport: { width, height: 1000 }, hasTouch: width === 375, reducedMotion: "reduce" });
    for (const flow of flows) {
      test(`${flow.title}: private click-only journey, gate, history and reset`, async ({ page, baseURL }, testInfo) => {
        test.setTimeout(90_000);
        const privacy = await auditPreview(page, baseURL!);
        const activate = async (name: string) => {
          const target = button(page, name);
          if (width === 375) await target.tap();
          else { await target.focus(); await page.keyboard.press("Enter"); }
        };
        await page.goto("/");
        const artwork = page.getByRole("img", { name: "Xappy, your preview guide" });
        await expect(artwork).toBeVisible();
        await expect.poll(() => artwork.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 1024 && image.naturalHeight === 1536)).toBe(true);
        const imageResponse = await page.request.get((await artwork.getAttribute("src"))!);
        expect(imageResponse.ok()).toBe(true);
        expect(createHash("sha256").update(await imageResponse.body()).digest("hex")).toBe(artworkHash);
        await accessCheck(page);
        const problem = PROBLEMS.find((item) => item.id === flow.problem)!;
        await activate(problem.label); await activate("Continue");
        await activate(problem.goals[0]!.label); await activate("Continue");
        await activate("100–500 attendees"); await activate("Continue"); await activate("Visibility"); await activate("Explore solutions");
        await expect(page.getByRole("article")).toHaveCount(3);
        const firstCards = await page.getByRole("article").getByRole("heading", { level: 2 }).allTextContents();
        await activate("Show more");
        const allCards = await page.getByRole("article").getByRole("heading", { level: 2 }).allTextContents();
        expect(allCards.slice(0, 3)).toEqual(firstCards); expect(new Set(allCards).size).toBe(allCards.length);
        await expect(button(page, "Show more")).toHaveCount(0);
        await expect(button(page, "View proposed plans")).toHaveCount(0);
        await activate(`Launch preview: ${flow.title}`);
        await expect(page.getByRole("status", { name: "Guided progress" })).toContainText("0 of 3");
        if (flow.filter) { await activate(flow.filter); await activate(flow.filter); }
        await activate(`Open ${flow.record}`);
        if (!flow.filter) await activate("Assign Sample AV team");
        await expect(page.getByRole("status", { name: "Guided progress" })).toContainText("2 of 3");
        await activate(flow.action);
        await expect(page.getByRole("heading", { name: "Your sample result" })).toBeFocused();
        await expect(page.getByRole("status", { name: "Sample result" })).toContainText(`${flow.record} is now ${flow.result}`);
        await expect(page.getByRole("heading", { name: "Your sample result" })).toBeInViewport();
        await expect(page.getByRole("heading", { name: "Proposed plans" })).toHaveCount(0);
        await expect(button(page, flow.action)).toBeDisabled();
        await accessCheck(page); await privacy();
        await page.screenshot({ path: testInfo.outputPath("third-result.png"), fullPage: true });
        await activate("View proposed plans");
        for (const plan of ["Starter", "Professional", "Agency"]) await expect(page.getByRole("article", { name: plan }).getByRole("button")).toBeDisabled();
        await accessCheck(page); await privacy();
        await page.goBack(); await expect(page.getByRole("status", { name: "Guided progress" })).toContainText("3 of 3");
        await page.goForward(); await expect(page.getByRole("heading", { name: "Proposed plans" })).toBeFocused();
        await activate("Return to preview");
        await activate("Reset demo"); await expect(button(page, "Cancel")).toBeFocused();
        await accessCheck(page); await activate("Cancel");
        await expect(page.getByRole("status", { name: "Guided progress" })).toContainText("3 of 3");
        await activate("Reset demo"); await activate("Confirm");
        await expect(page.getByRole("status", { name: "Guided progress" })).toContainText("0 of 3");
        await privacy(); await page.reload();
        await expect(page.getByRole("heading", { name: "What would you like to improve?" })).toBeVisible();
        await privacy();
      });
    }

    test("optional text, None fit, honest empty recovery and Back remain private", async ({ page, baseURL }) => {
      const privacy = await auditPreview(page, baseURL!);
      await page.goto("/"); await button(page, "Something else").click();
      const note = page.getByRole("textbox", { name: "Optional context" });
      await note.fill("x".repeat(501)); await expect(note).toHaveValue("x".repeat(500));
      const markup = '<img src=x onerror="window.__markupExecuted=true">'; await note.fill(markup);
      await button(page, "Registration and check-in").click(); await button(page, "Continue").click();
      await button(page, "Cut check-in lines").click(); await button(page, "Continue").click();
      await button(page, "100–500 attendees").click(); await button(page, "Continue").click();
      await button(page, "Visibility").click(); await button(page, "Explore solutions").click();
      await expect(page.getByText(markup, { exact: true })).toBeVisible();
      await button(page, "None fit").click(); await button(page, "Another goal").click();
      await page.getByRole("textbox").fill("An uncovered sample need");
      await button(page, "Back to recommendations").click(); await button(page, "None fit").click();
      await expect(page.getByRole("textbox")).toHaveValue("An uncovered sample need");
      await button(page, "Update suggestions").click(); await expect(page.getByText("No catalog match yet")).toBeVisible();
      await accessCheck(page); await privacy();
      await button(page, "Browse this problem").click();
      await expect(page.getByRole("article")).toHaveCount(3);
      await expect(page.getByText("An uncovered sample need", { exact: true })).toBeVisible();
      await expect(button(page, "View proposed plans")).toHaveCount(0); await privacy();
    });
  });
}

for (const path of ["/", "/build"]) {
  test(`standalone ${path} entry and direct reload`, async ({ page, baseURL }) => {
    const privacy = await auditPreview(page, baseURL!);
    await page.goto(path); await expect(page.getByRole("heading", { name: "What would you like to improve?" })).toBeVisible();
    await page.reload(); await expect(page.getByText("Sample data · Preview")).toBeVisible();
    await privacy();
  });
}

for (const restored of [
  { name: "corrupt JSON", raw: "{broken", heading: "What would you like to improve?" },
  { name: "missing challenge choices", raw: JSON.stringify({ industry: EVENTS_INDUSTRY, stakeholders: ["Sample team"] }), heading: "What would you like to improve?" },
  { name: "invalid dependent goal", raw: JSON.stringify({ problemId: "registration", goalId: "capture-qualified-leads", scale: "100-500", priority: "visibility", legacy: {} }), heading: "What would a better outcome look like?" },
]) {
  test(`saved-discovery recovery: ${restored.name}`, async ({ page, baseURL }) => {
    const privacy = await auditPreview(page, baseURL!, restored.raw);
    await page.goto("/"); await expect(page.getByRole("heading", { name: restored.heading })).toBeVisible();
    await expect(page.getByRole("region", { name: "Saved discovery notice" })).toBeVisible();
    const choice = restored.heading.includes("outcome") ? "Cut check-in lines" : "Registration and check-in";
    await button(page, choice).click(); await button(page, "Continue").click();
    expect(await page.evaluate(() => sessionStorage.getItem("xappx_discovery"))).toBe(restored.raw);
    await privacy();
  });
}

test("denied storage still permits click-only discovery", async ({ page, baseURL }) => {
  const privacy = await auditPreview(page, baseURL!, null, true);
  await page.goto("/"); await button(page, "Sponsor leads").click(); await button(page, "Continue").click();
  await expect(button(page, "Capture qualified leads")).toBeVisible(); await privacy();
});
