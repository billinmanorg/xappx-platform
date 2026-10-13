import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test/click-preview",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  outputDir: "./test-results/click-preview",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    // Optional local fallback when the Playwright browser download is unavailable.
    launchOptions: { executablePath: process.env.CLICK_PREVIEW_BROWSER_PATH },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build:click-preview && npm run check:click-preview && vite preview --config vite.click-preview.config.ts --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
