import { expect, test } from "@playwright/test";

type IsolationAudit = {
  contentRequests: string[];
  storageWrites: string[];
  storageReads: { storage: string; key: string }[];
};

declare global {
  interface Window { __clickPreviewAudit: IsolationAudit }
}

async function observePreview(page: import("@playwright/test").Page, denyStorage = false) {
  await page.addInitScript(({ denyStorage }) => {
    const audit: IsolationAudit = { contentRequests: [], storageWrites: [], storageReads: [] };
    window.__clickPreviewAudit = audit;
    const local = window.localStorage;
    const session = window.sessionStorage;
    const originalGet = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      audit.storageReads.push({ storage: this === session ? "session" : this === local ? "local" : "other", key });
      return originalGet.call(this, key);
    };
    for (const method of ["setItem", "removeItem", "clear"] as const) {
      Storage.prototype[method] = function () { audit.storageWrites.push(method); };
    }
    window.fetch = async () => { audit.contentRequests.push("fetch"); throw new Error("Preview content request blocked by test"); };
    XMLHttpRequest.prototype.send = function () { audit.contentRequests.push("XHR"); throw new Error("Preview content request blocked by test"); };
    for (const api of ["WebSocket", "EventSource"] as const) {
      Object.defineProperty(window, api, { configurable: true, value: class {
        constructor() { audit.contentRequests.push(api); throw new Error("Preview content request blocked by test"); }
      } });
    }
    navigator.sendBeacon = () => { audit.contentRequests.push("beacon"); return false; };
    if (denyStorage) {
      for (const name of ["localStorage", "sessionStorage"]) {
        Object.defineProperty(window, name, { configurable: true, get() { throw new DOMException("Storage denied", "SecurityError"); } });
      }
    }
  }, { denyStorage });
}

// Exercising the built bootstrap catches accidental legacy imports and effects.
test("preview_load_has_no_content_requests", async ({ page, baseURL }) => {
  const networkContent: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.name));
  page.on("request", (request) => {
    if (request.method() !== "GET" || new URL(request.url()).origin !== new URL(baseURL!).origin ||
        ["fetch", "xhr", "websocket", "eventsource"].includes(request.resourceType())) {
      networkContent.push(request.resourceType());
    }
  });
  await observePreview(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What would you like to improve?" })).toBeVisible();
  await expect(page.getByText("Sample data · Preview")).toBeVisible();
  const audit = await page.evaluate(() => window.__clickPreviewAudit);
  expect(audit.contentRequests).toEqual([]);
  expect(audit.storageWrites).toEqual([]);
  expect(audit.storageReads.every(({ storage, key }) => storage === "session" && key === "xappx_discovery")).toBe(true);
  expect(networkContent).toEqual([]);
  expect(pageErrors).toEqual([]);
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("isolated_entry_has_no_legacy_scripts", async ({ page }) => {
  await page.goto("/");
  const scripts = await page.locator("script[src]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("src")));
  expect(scripts.length).toBeGreaterThan(0);
  expect(scripts.every((src) => src?.startsWith("/assets/") && !/widget|cookies/i.test(src))).toBe(true);
  await expect(page.locator('link[href*="fonts.googleapis"], link[href*="fonts.gstatic"], iframe')).toHaveCount(0);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  for (const directive of ["connect-src", "form-action", "object-src", "base-uri", "frame-src"]) {
    expect(csp).toContain(`${directive} 'none'`);
  }
  for (const directive of ["script-src", "style-src", "img-src"]) expect(csp).toContain(`${directive} 'self'`);
});

test("preview_renders_when_storage_throws_security_error", async ({ page }) => {
  await observePreview(page, true);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What would you like to improve?" })).toBeVisible();
  expect(await page.evaluate(() => window.__clickPreviewAudit.contentRequests)).toEqual([]);
  expect(await page.evaluate(() => window.__clickPreviewAudit.storageWrites)).toEqual([]);
});
