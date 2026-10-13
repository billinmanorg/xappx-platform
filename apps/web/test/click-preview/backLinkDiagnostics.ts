import type { Page, TestInfo } from "@playwright/test";

/** Failure-only, fixture-local diagnostics; never dump forms, storage, or HTML. */
export async function reportBackLinkFailure(page: Page, testInfo: TestInfo) {
  if (testInfo.status === testInfo.expectedStatus || page.isClosed()) return;
  try {
    const structure = await page.locator(".preview-app").evaluate((root) => ({
      headingIds: Array.from(root.querySelectorAll("[data-current-view] h1"), (heading) => heading.id),
      controls: Array.from(root.querySelectorAll(".back-link"), (element) => ({
        label: element.textContent,
        hidden: Boolean(element.closest("[hidden], [inert]")),
        before: getComputedStyle(element, "::before").content,
        after: getComputedStyle(element, "::after").content,
      })),
    }), undefined, { timeout: 2_000 });
    const accessibleButtons = await Promise.all((await page.locator(".back-link:visible").all())
      .map((control) => control.ariaSnapshot({ timeout: 1_000 })));
    console.log("Back-link failure diagnostics:", JSON.stringify({ ...structure, accessibleButtons }));
  } catch {
    // A closed/detached page must not obscure the original test failure.
    console.log("Back-link failure diagnostics unavailable: page closed or changed.");
  }
}
