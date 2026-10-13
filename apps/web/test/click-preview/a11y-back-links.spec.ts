import { expect, test, type Page } from "@playwright/test";
import { contextFor } from "./fixtures";
import { reportBackLinkFailure } from "./backLinkDiagnostics";

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
test.afterEach(({ page }, testInfo) => reportBackLinkFailure(page, testInfo));

for (const width of [375, 768, 1440]) {
  test.describe(`back-control accessible names at ${width}px`, () => {
    test.use({ viewport: { width, height: 1000 }, hasTouch: width === 375 });
    test("all six back controls exclude decoration and retain keyboard/touch navigation", async ({ page }) => {
      await page.addInitScript((context) => sessionStorage.setItem("xappx_discovery", JSON.stringify(context)), contextFor("sponsor-leads"));
      await page.goto("/");
      await button(page, "Explore solutions").click();

      const useBack = async (name: string) => {
        // Find the DOM control independently of its accessible name so a name
        // regression fails immediately with the computed name, not a long click timeout.
        const control = page.locator(".back-link:visible").filter({ hasText: new RegExp(`^${name}$`) });
        await expect(control).toHaveCount(1);
        await expect(control).toHaveAccessibleName(name);
        expect(await control.evaluate((element) => {
          const cue = getComputedStyle(element, "::before");
          return cue.content === '\"\"' && Number.parseFloat(cue.width) > 0 && Number.parseFloat(cue.height) > 0
            && cue.borderLeftStyle === "solid" && Number.parseFloat(cue.borderLeftWidth) > 0
            && cue.borderBottomStyle === "solid" && Number.parseFloat(cue.borderBottomWidth) > 0;
        })).toBe(true);
        const named = button(page, name);
        if (width === 375) await named.tap();
        else {
          await page.keyboard.press("Tab");
          await named.focus();
          await expect(named).toBeFocused();
          expect(await named.evaluate((element) => element.matches(":focus-visible") && getComputedStyle(element).outlineStyle !== "none")).toBe(true);
          await page.keyboard.press("Enter");
        }
      };

      await useBack("Back to choices");
      await button(page, "Explore solutions").click();
      await button(page, "None fit").click();
      await useBack("Back to recommendations");
      await page.getByRole("button", { name: /^View concept:/ }).first().click();
      await useBack("Back to recommendations");
      await button(page, "Launch preview: Sponsor Lead Desk").click();
      await useBack("Back to recommendations");
      await button(page, "Launch preview: Sponsor Lead Desk").click();
      await button(page, "Open Sample Cloudberry Studio").click();
      await useBack("Back to records");
      await expect(page.getByRole("heading", { name: "Leads", exact: true })).toBeFocused();
      await button(page, "High").click();
      await button(page, "Open Sample Cloudberry Studio").click();
      await button(page, "Mark Qualified").click();
      await button(page, "View proposed plans").click();
      await useBack("Return to preview");
      await expect(button(page, "View proposed plans")).toBeFocused();
      await expect(page.getByRole("status", { name: "Guided progress" })).toContainText("3 of 3");
    });
  });
}
