---
project: Speed-Reading Training App
version: 1
created: 2026-06-13
status: active
---

# Quality Contract — Speed-Reading Training App

> This document is the durable quality contract. §1–§5 are frozen after first write; §3 status cells are updated by `/10x-test-plan` as phases ship; §6 fills in as each rollout phase completes.

---

## §1 Strategy

Three load-bearing principles that govern every test decision in this project:

1. **Cost × signal.** Every test must answer: *what is the cheapest test that gives a real signal for this risk?* Do not promote to e2e because it "feels safer." Do not add a vision model on top of a deterministic assertion that already catches the regression.

2. **User concerns are evidence.** Risks the team has lived through — or explicitly fears — carry the same weight as PRD lines or hot-spot data. Interview Q1 ("data leakage is the worst") and Q3 ("auth middleware is my lowest-confidence area") are primary inputs, not background color.

3. **Risks are scenarios, not code locations.** §2 cites *evidence that raised the risk* — PRD lines, interview answers, hot-spot directories — never a file path or function name as an "anchor." File:line anchors are `/10x-research`'s output, produced per rollout phase against current code. Any §2 Source cell that contains `src/foo/bar.ts:42` or a specific function name violates this principle and must be cleaned.

---

## §2 Risk Map

### Top Risks

| # | Risk (failure scenario, user/business terms) | Impact | Likelihood | Source(s) — evidence, not anchors |
|---|---|---|---|---|
| 1 | Authenticated user reads another user's exercise completions due to RLS policy gap | High | Medium | PRD §Privacy; Interview Q1 ("accessing another user's data is the worst thing"); lessons.md (never trust client user_id); hot-spot dir `src/pages/api/exercises` 5 commits/30d |
| 2 | Exercise completion silently not persisted — results page shows success but DB write never landed | High | Medium | PRD FR-010; lessons.md (null-check createClient — this class of bug already documented); hot-spot dir `src/pages/api/exercises` 5 commits/30d |
| 3 | Unauthenticated request reaches protected route (`/dashboard`, `/exercise/[id]`) due to middleware regression | High | Medium | PRD §Access Control (authenticated-only is a hard requirement); Interview Q3 ("auth middleware is my lowest-confidence area"); hot-spot `src/middleware.ts` 2 commits/30d |
| 4 | Dataset alternation always returns same dataset — retry mechanic broken for all users | Medium | Medium | PRD FR-012; roadmap S-06; hot-spot dir `src/pages/api/exercises` 5 commits/30d |
| 5 | Dashboard or results page crashes for new user with empty completion history (cold-start null propagation) | High | Medium | PRD §Cold-start handling; FR-005/FR-014/FR-015 Socrates notes (each flags a cold-start edge case); hot-spot dir `src/pages` 7 commits/30d |
| 6 | Supabase API key, session token, or user PII exposed in a server error response body | High | Low | PRD §Privacy; abuse/security lens (secret leakage class); roadmap Baseline (observability absent — no structured error handling wired) |

### Risk Response Guidance

| Risk # | What would prove protection | Must challenge | Context needed from research | Likely cheapest layer | Anti-pattern to avoid |
|---|---|---|---|---|---|
| 1 | User A's completion rows cannot be fetched by User B's authenticated session — even with a direct ID | "The RLS `WITH CHECK` on SELECT is enough" — verify SELECT policy is actually per-user, not per-authenticated-user | RLS policy text for SELECT on `exercise_completions`; whether API route derives user_id from session or accepts it as input | Integration test (real Supabase or local Docker instance, two fixture users) | Mocking RLS — the mock will never catch a malformed policy |
| 2 | A completion record exists in `exercise_completions` after the API route returns 200 | "The results page shows = the save worked" — verify DB write, not page render | What the API route returns on Supabase error; whether `createClient` null-path returns 200 or 5xx | Integration test against local Supabase (real DB write + query back) | Asserting response body only — never verifies DB state |
| 3 | A GET to `/dashboard` with no session cookie returns a redirect (3xx) to `/auth/signin`, not a 200 | "Middleware runs on every request" — verify the protected-routes list actually covers all relevant paths | Which routes are in `PROTECTED_ROUTES`; what the middleware returns for missing vs expired sessions | Integration test (HTTP client, no cookie jar) | Mocking the middleware — defeats the purpose entirely |
| 4 | Given User A completed `dataset_1` last, the next-for-type API returns `dataset_2`; given no prior completions, returns `dataset_1` | "The dashboard shows different exercise = alternation works" — verify the API, not the UI, because the UI re-uses whatever the API returns | SQL query logic in next-for-type endpoint; how it handles tie-breaking and cold-start | Unit test (SQL function or service function with fixture data) or integration test against local Supabase | Testing only the happy path — must cover cold-start and already-completed-both-datasets states |
| 5 | Dashboard renders without throwing when `exercise_completions` query returns an empty array; results page renders without throwing when previous-session data is absent | "Cold-start is handled" — verify actual render path, not the comment in code | Which data shapes the pages receive when history is empty; whether null vs empty-array is handled differently | Integration test (render page with authenticated session that has 0 completions) | Unit-testing a helper in isolation — must test the actual page or component receiving the empty shape |
| 6 | A forced 500 error response body does not contain the string value of `SUPABASE_KEY`, `SUPABASE_URL`, or a `Bearer ` token | "We don't log secrets" — verify the actual response body under an error path, not intent | How errors are currently surfaced to the client (raw Supabase error message, stack trace, custom wrapper); which env vars are in scope in API routes | Integration test (trigger deliberate error, assert response body) | Asserting the happy path only — must force the error branch |

---

## §3 Phased Rollout

Status vocabulary (parser literals): `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`

| # | Phase name | Goal | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Bootstrap + auth/access integration | Wire test runner; prove RLS isolation, middleware redirect, and no-secret-leak via first integration tests | #1, #3, #6 | Integration (real local Supabase + HTTP); test runner bootstrap | complete | context/changes/testing-bootstrap-auth-access/ |
| 2 | Completion pipeline correctness | Prove completion record lands in DB and WPM value is in a sane range after API returns 200 | #2 | Integration (real DB write + query back) | not started | — |
| 3 | Dataset alternation and cold-start | Prove dataset rotation algorithm is correct and pages survive empty history without crashing | #4, #5 | Unit / integration (algorithm + page render with empty fixture) | not started | — |
| 4 | Quality-gates wiring | Add test run step to CI so all of the above is enforced on every push | all | CI gate (GitHub Actions workflow update) | not started | — |

---

## §4 Stack

**Runtime:** Astro 6 SSR (`output: "server"`), React 19 islands, Cloudflare Workers  
**Database:** Supabase (PostgreSQL 17 local Docker; cloud for prod). RLS is mandatory on all tables (CLAUDE.md).  
**Auth:** Supabase Auth, cookie-based sessions via `@supabase/ssr`, middleware route protection  
**CI:** GitHub Actions (`.github/workflows/ci.yml`), auto-deploy on merge to `main`  
**Test base profile:** `none` — no test runner config, 0 test files. Phase 1 must bootstrap runner + first tests.

**Stack grounding tools (current session):**
- Docs: Context7 — available; Astro 6, Vitest, Playwright docs accessible; checked: 2026-06-13
- Search: Web search MCP — available; used to verify tool currency; checked: 2026-06-13
- Runtime/browser: Playwright MCP — not confirmed in session; not used
- Provider/platform: Supabase — no MCP connector confirmed in session; local Docker Supabase used as integration test target per existing project setup

**Recommended test runner:** Vitest (TypeScript-native, works without a browser runtime for integration tests; compatible with Astro projects; well-documented in Context7). For e2e if ever needed: Playwright (first-class Astro support).

**Key constraints from codebase:**
- Lessons.md: never accept `user_id` from client input; use `result` variable pattern for Supabase queries; null-check `createClient` before use
- CLAUDE.md: RLS mandatory; API routes export uppercase `GET`/`POST`; Supabase migrations in `supabase/migrations/`
- Local Supabase via Docker (`npx supabase start`) is the integration test target — no remote DB needed for tests

---

## §5 Quality Gates

| Gate | Type | Required/Recommended | Target CI step | Status |
|---|---|---|---|---|
| Lint (`npm run lint`) | Static analysis | Required now | Already in CI (`ci.yml`) | Wired |
| Type check (`npm run typecheck` / `tsc --noEmit`) | Static analysis | Required now | Already in CI (`ci.yml` build step) | Wired |
| Unit + integration tests | Functional | Required — after §3 Phase 1 | Add after Phase 1 ships | Not wired |
| E2e on critical flows | Functional | Recommended — after §3 Phase 3 | Add after Phase 3 ships, if e2e layer is chosen | Not wired |
| Post-edit hook (lint + typecheck) | Local developer gate | Recommended local | husky pre-commit (already configured via lint-staged) | Wired |
| Multimodal visual review | Selective visual | Not applicable for MVP | — | Not applicable |

---

## §6 Cookbook

Fills in as each rollout phase ships. Each entry will answer: "how do I add a test for X in this project?"

### 6.1 Test runner setup

TBD — see §3 Phase 1 (Bootstrap + auth/access integration)

### 6.2 RLS / cross-user isolation integration test

**Location:** `tests/integration/` — all access-control integration tests live here.

**Naming:** `<subject>-isolation.test.ts` or `<subject>-access.test.ts`

**Run command:**
- All integration tests: `npm test`
- Single file: `npx vitest run tests/integration/<file>`

**Helper dependencies:**
- `tests/helpers/supabase.ts` — `adminClient()` (service-role, bypasses RLS) and `authClient(jwt)` (anon key + JWT, respects RLS)
- `tests/helpers/fixtures.ts` — `createFixtureUser`, `createFixtureCompletion`, `deleteFixtureUsers`

**Reference test:** `tests/integration/rls-isolation.test.ts`

The reference test uses a two-user pattern:
1. `beforeAll` — create User A and User B via `createFixtureUser`; insert a completion for User A via `adminClient()` + `createFixtureCompletion`
2. First `it` — User A's `authClient(jwt)` must return the row (proves the policy allows own data)
3. Second `it` — User B's `authClient(jwt)` queries the same row by ID and must get 0 results (proves isolation)
4. `afterAll` — `deleteFixtureUsers(admin, [userAId, userBId].filter(Boolean))` cleans up both users; `ON DELETE CASCADE` removes their completions

**Key rule:** Always use `authClient(jwt)` for assertions — it respects RLS. Use `adminClient()` only for fixture setup/teardown — it bypasses RLS. **Never mock the Supabase client** in access-control tests: a mock is always green even if the policy is deleted.

**Red/green verification:** Remove the SELECT policy in Supabase Studio → `npm test` turns red on the "User A can read their own completion" assertion. Restore via `npx supabase db reset` → green. This confirms the test exercises the real policy.

### 6.3 Middleware redirect integration test

**Location:** `tests/integration/middleware-redirect.test.ts`

**Run command:**
- All integration tests: `npm test`
- Single file: `npx vitest run tests/integration/middleware-redirect.test.ts`

**Server dependency:** Requires `tests/globalSetup.ts` — Vitest runs it once before any suite. It spawns `astro dev` on port 4322 and exposes the base URL via `process.env.TEST_SERVER_URL`. No manual server start needed.

**Key technique:** Use `fetch(url, { redirect: "manual" })` — this prevents Node from auto-following the 302. Lets you assert `response.status === 302` and `response.headers.get("Location")` in a single request.

**No-loop assertion:** Always add a test that `GET /auth/signin` returns `200` (not a redirect). This proves no redirect loop exists — if `/auth/signin` ever lands in `PROTECTED_ROUTES` by mistake, the test turns red.

**Adding a new protected-route assertion:**
1. Add an `it` block inside the existing `describe`.
2. `fetch(`${BASE_URL}/your-new-route`, { redirect: "manual" })`.
3. Assert `response.status === 302` and `response.headers.get("Location")?.startsWith("/auth/signin")`.
4. No `beforeAll`/`afterAll` needed — globalSetup manages the server.

**Regressions caught:**
- `PROTECTED_ROUTES` array modified (routes removed or renamed) → protected route returns 200 instead of 302
- `startsWith("/")` replaced with `===` exact match → `/exercise/abc` bypasses protection (only `/exercise` exact would match)
- Redirect target changed to a different path → `Location` header assertion fails
- `/auth/signin` added to `PROTECTED_ROUTES` by mistake → test 4 returns 302 instead of 200 (loop regression)

### 6.4 Secret-leak integration test

**Location:** `tests/integration/secret-leak.test.ts`

**Run command:**
- All integration tests: `npm test`
- Single file: `npx vitest run tests/integration/secret-leak.test.ts`

**Key technique:** Read the actual secret value from `process.env.SUPABASE_TEST_ANON_KEY` at test time. Assert `expect(body).not.toContain(secretValue)`. Do **not** hardcode the key in the test — hardcoding defeats the assertion when keys rotate and creates a false sense of coverage.

**Trigger selection:** Pick one error path that fires without a session (session-check branch, e.g. 401) and one that fires with a DB call (e.g. 404 for a non-existent resource). Together they cover the two distinct error branches most likely to accidentally surface raw Supabase error objects.

**What to assert absent in each response body:**
- `process.env.SUPABASE_TEST_ANON_KEY` — the anon key string
- `process.env.SUPABASE_TEST_URL` — the Supabase instance URL
- `"Bearer "` — any bearer token substring
- Stack trace pattern (e.g. `"Error:"`, `"at Object."`)

**Adding a new secret-leak assertion for a new API route:**
1. Add an `it` block inside the existing `describe`.
2. Trigger the error path (remove cookie, pass a bad ID, etc.).
3. `const body = await response.text()`.
4. Assert `expect(body).not.toContain(anonKey)` and `expect(body).not.toContain(supabaseUrl)`.
5. No fixture setup needed if the error fires before any DB call.

**Red/green verification:** Temporarily add the key to the error response body (e.g. `JSON.stringify({ error: "Unauthorized", debug: process.env.SUPABASE_TEST_ANON_KEY })`) → `npm test` turns red. Revert → green. This confirms the test would catch a real key-in-body regression.

### 6.5 Completion API DB-write integration test

TBD — see §3 Phase 2 (Completion pipeline correctness)

### 6.6 Dataset alternation unit/integration test

TBD — see §3 Phase 3 (Dataset alternation and cold-start)

### 6.7 Cold-start render integration test

TBD — see §3 Phase 3 (Dataset alternation and cold-start)

---

## §7 Negative Space

What this project deliberately does NOT test, and why:

| Area | Reason |
|---|---|
| Exercise UI visual rendering (AnimatedPacer, FocusSprint, SpeedScan components) | Interview Q5: user explicitly said not worth it. Visual correctness is subjective; logic (scoring, timer) is covered at the API/integration layer. |
| Auth pages static markup (signin.astro, signup.astro) | Interview Q5: trivial markup with no business logic. Changes here are low-risk and purely visual. |
| Supabase SDK internals (`createClient` itself) | Testing third-party SDK setup is testing the vendor, not the product. The null-check pattern (lessons.md) is what we own and what we test. |
| Smart Questions dead code (SmartQuestions.tsx, seeds 011/012) | Parked per roadmap; not surfaced to users; not worth test budget until the feature is un-parked. |
| Leaderboard | Explicitly out of MVP scope (PRD §Non-Goals). |
| Auto-logout after 1 hour inactivity (FR-003) | Roadmap flags as potentially deferred per `top_blocker: time`; if not shipped, nothing to test. |
| Admin surfaces | No admin roles or admin UI in MVP (PRD §User model: flat). |
