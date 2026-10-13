import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PROBLEMS } from "../../src/click-preview/problems";

type Page = import("@playwright/test").Page;
async function journey(page: Page, problem = PROBLEMS[0]!) {
  await page.getByRole("button", { name: problem.label, exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: problem.goals[0]!.label, exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "100–500 attendees", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Visibility", exact: true }).click();
  await page.getByRole("button", { name: "Explore solutions", exact: true }).click();
}

for (const problem of PROBLEMS) {
  test(`click-only journey: ${problem.label}`, async ({ page }) => {
    await page.goto("/"); await journey(page, problem);
    await expect(page.getByRole("heading", { name: "Explore your possibilities" })).toBeFocused();
    await expect(page.getByRole("article")).toHaveCount(3);
    await expect(page.getByText("Curated recommendations")).toBeVisible();
    await expect(page.getByText(/actions remaining|Choose your plan/)).toHaveCount(0);
  });
}

for (const width of [375, 768, 1440]) {
  test(`responsive keyboard, artwork, touch targets and accessibility at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 }); await page.goto("/");
    const artwork = page.getByRole("img", { name: "Xappy, your preview guide" });
    await expect(artwork).toBeVisible();
    expect(await artwork.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth === 1024 && node.naturalHeight === 1536)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const button of await page.getByRole("button").all()) {
      const rect = await button.boundingBox(); expect(rect?.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: `test-results/click-preview/discovery-${width}.png`, fullPage: true });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "Sponsor leads", exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Sponsor leads", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Continue", exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "What would a better outcome look like?" })).toBeFocused();
    await page.getByRole("button", { name: "Capture qualified leads", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "100–500 attendees", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Visibility", exact: true }).click();
    await page.getByRole("button", { name: "Explore solutions", exact: true }).click();
    await page.getByRole("button", { name: "Show more", exact: true }).click();
    await expect(page.getByRole("article")).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `test-results/click-preview/recommendations-${width}.png`, fullPage: true });
  });
}

test("refinement preserves unmet text, batches, concept Back and an honest empty state", async ({ page }) => {
  await page.goto("/"); await journey(page);
  const first = await page.getByRole("article").getByRole("heading", { level: 2 }).allTextContents();
  await page.getByRole("button", { name: "Show more", exact: true }).click();
  expect((await page.getByRole("article").getByRole("heading", { level: 2 }).allTextContents()).slice(0, 3)).toEqual(first);
  await expect(page.getByRole("status")).toContainText("Showing all 4 catalog options. 1 more option revealed.");
  await page.getByRole("button", { name: "View concept: Check-in Queue Planner", exact: true }).click();
  await expect(page.getByRole("button", { name: /launch/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Back to recommendations", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(4);
  await page.getByRole("button", { name: "None fit", exact: true }).click();
  await page.getByRole("textbox").fill("A quiet check-in lane");
  await page.getByRole("button", { name: "Another goal", exact: true }).click();
  await page.getByRole("button", { name: "Back to recommendations", exact: true }).click();
  await page.getByRole("button", { name: "None fit", exact: true }).click();
  await expect(page.getByRole("textbox")).toHaveValue("A quiet check-in lane");
  await page.getByRole("button", { name: "Update suggestions", exact: true }).click();
  await expect(page.getByText("No catalog match yet")).toBeVisible();
  await page.getByRole("button", { name: "Browse this problem", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Explore your possibilities" })).toBeFocused();
  await expect(page.getByRole("article")).toHaveCount(3);
  await expect(page.getByText("A quiet check-in lane")).toBeVisible();
});

test("optional content is inert, capped and never transmitted or persisted", async ({ page, baseURL }) => {
  const contentRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" || new URL(request.url()).origin !== new URL(baseURL!).origin || ["fetch", "xhr", "websocket", "eventsource"].includes(request.resourceType())) contentRequests.push(request.url());
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, "__discoveryWrites", { value: [] });
    for (const method of ["setItem", "removeItem", "clear"] as const) Storage.prototype[method] = () => {
      (window as unknown as { __discoveryWrites: string[] }).__discoveryWrites.push(method);
    };
  });
  await page.goto("/"); await page.getByRole("button", { name: "Something else", exact: true }).click();
  const input = page.getByRole("textbox", { name: "Optional context" });
  await input.fill("a".repeat(501)); await expect(input).toHaveValue("a".repeat(500));
  const markup = '<img src=x onerror="window.hacked=true">'; await input.fill(markup);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Not sure yet", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Speed", exact: true }).click();
  await page.getByRole("button", { name: "Explore solutions", exact: true }).click();
  await expect(page.getByText(markup)).toBeVisible(); await expect(page.locator("img[onerror]")).toHaveCount(0);
  expect(contentRequests).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { __discoveryWrites: string[] }).__discoveryWrites)).toEqual([]);
});

for (const restored of [false, true]) {
  test(`untouched refinement follows a newer discovery goal (restored: ${restored})`, async ({ page }) => {
    if (restored) await page.addInitScript(() => {
      sessionStorage.setItem("xappx_discovery", JSON.stringify({ problemId: "registration", goalId: "cut-check-in-lines", scale: "100-500", priority: "visibility", note: "Outdoor registration", uncoveredNeed: "Quiet lane", legacy: {} }));
    });
    await page.goto("/");
    if (restored) await page.getByRole("button", { name: "Explore solutions", exact: true }).click();
    else await journey(page);
    await page.getByRole("button", { name: "None fit", exact: true }).click();
    await page.getByRole("button", { name: "Back to recommendations", exact: true }).click();
    await page.getByRole("button", { name: "Back to choices", exact: true }).click();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: "Auto-issue badges & QR passes", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Explore solutions", exact: true }).click();
    await page.getByRole("button", { name: "None fit", exact: true }).click();
    await expect(page.getByRole("button", { name: "Auto-issue badges & QR passes", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Update suggestions", exact: true }).click();
    await expect(page.getByRole("article").first().getByRole("heading", { level: 2 })).toHaveText("Badge & QR Pass Concept");
    if (restored) {
      await expect(page.getByText("Outdoor registration")).toBeVisible();
      await expect(page.getByText("Quiet lane")).toBeVisible();
    }
  });
}

test("applied refinement cannot overwrite a later return to the previous discovery goal", async ({ page }) => {
  await page.goto("/"); await journey(page);
  await page.getByRole("button", { name: "None fit", exact: true }).click();
  await page.getByRole("button", { name: "Auto-issue badges & QR passes", exact: true }).click();
  await page.getByRole("button", { name: "Update suggestions", exact: true }).click();
  await expect(page.getByRole("article").first().getByRole("heading", { level: 2 })).toHaveText("Badge & QR Pass Concept");
  await page.getByRole("button", { name: "Back to choices", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Cut check-in lines", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Explore solutions", exact: true }).click();
  await page.getByRole("button", { name: "None fit", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cut check-in lines", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Update suggestions", exact: true }).click();
  await expect(page.getByRole("article").first().getByRole("heading", { level: 2 })).toHaveText("Check-in Queue Planner");
});
