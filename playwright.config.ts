import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  webServer: process.env.CI
    ? {
        command: "npm run dev",
        url: "http://localhost:4322",
        reuseExistingServer: false,
        timeout: 60_000,
      }
    : undefined,
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:4322",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
    },
  ],
});
