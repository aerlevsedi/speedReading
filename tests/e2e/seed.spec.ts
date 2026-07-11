// seed.spec.ts — exemplar for all E2E tests in this project.
// Risk: #3 — unauthenticated request reaches protected route due to middleware regression.
// Conventions demonstrated:
//   - getByRole as primary locator (never CSS/XPath)
//   - wait for state, not time (waitForURL, toBeVisible — no waitForTimeout)
//   - test independence: no shared state, no assumptions about prior tests
//   - cleanup: stateless (redirect test leaves no DB records)
//   - test name bound to the risk from test-plan.md §2 Risk Map #3
//
// Why /exercise/test-id and not /dashboard:
//   /dashboard has its own page-level auth redirect to /auth/signin?error=Unauthorized.
//   /exercise/[id] redirects unauthenticated users to /dashboard (not /auth/signin),
//   so only the middleware can produce a clean redirect to /auth/signin for /exercise/*.
//   This makes the test verify the middleware specifically, not page-level fallback.
//
// storageState: undefined — overrides the global storageState so this test runs without
// a session cookie, testing the unauthenticated path specifically.
import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("unauthenticated request to /exercise/* redirects to /auth/signin via middleware", async ({ page }) => {
  // Step 1: navigate to a protected route without a session cookie (storageState cleared above)
  await page.goto("/exercise/00000000-0000-0000-0000-000000000000");

  // Step 2: wait for middleware redirect to land — state, not time
  await page.waitForURL("**/auth/signin");

  // Step 3: assert the URL has no error param (middleware redirect is clean, no ?error=)
  expect(page.url()).not.toContain("error=");

  // Step 4: confirm we are on the sign-in page
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

  // No cleanup needed — no data was created
});
