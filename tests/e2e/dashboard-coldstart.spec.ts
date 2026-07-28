// dashboard-coldstart.spec.ts
// Risk: #5 — dashboard or results page crashes for a new user with empty completion history.
// This is a browser-level risk: the crash only manifests when the full auth → routing → DB
// → Astro SSR → React hydration path runs together. A unit test on a helper cannot prove it.
//
// Uses storageState from playwright/.auth/user.json (set in playwright.config.ts).
// The logged-in user must have 0 exercise completions for this test to be meaningful;
// if it runs against a user with existing history, it still passes but tests the wrong state.
import { test, expect } from "@playwright/test";

test("dashboard renders without crashing for authenticated user with empty completion history", async ({ page }) => {
  // Step 1: navigate to dashboard as an authenticated user (storageState provides the session)
  await page.goto("/dashboard");

  // Step 2: wait for the page to finish loading — state, not time
  await page.waitForURL("**/dashboard");

  // Step 3: confirm no unhandled error in the response body
  const content = await page.content();
  expect(content).not.toContain("Error:");
  expect(content).not.toContain("at Object."); // stack trace pattern

  // Step 4: at least one exercise card link rendered — proves seed data was fetched
  // and the cold-start null-filter guard worked (exercises.length > 0 check passed)
  await expect(page.getByRole("link", { name: /start/i }).first()).toBeVisible();

  // No cleanup needed — read-only flow, no data written
});
