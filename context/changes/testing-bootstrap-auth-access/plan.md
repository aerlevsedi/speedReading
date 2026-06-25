# RLS Isolation Integration Test — Implementation Plan

## Overview

Bootstrap Vitest as the project's test runner and write the first integration test proving that exercise_completions rows are isolated per user at the database layer (Risk #1). The test uses two real fixture users with valid JWT tokens against a local Supabase Docker instance — no mocks. This is the first test in the project; the setup it creates becomes the foundation for all future integration tests.

## Current State Analysis

No test runner, no test files, no test configuration. The project has:
- Vitest not installed
- `@supabase/supabase-js` v2 already in `dependencies` (no extra install needed for test client)
- Local Supabase configured at `http://127.0.0.1:54321` (`supabase/config.toml`)
- Path alias `@/*` → `./src/*` in `tsconfig.json` — must be reflected in Vitest config
- `src/lib/supabase.ts` uses `astro:env/server` (Astro virtual module) — tests **cannot** import the app's client factory; they need their own client built directly from `createClient` in `@supabase/supabase-js`
- RLS policy `completions_select_own` confirmed per-user: `USING ((select auth.uid()) = user_id)` — see `supabase/migrations/20260605000000_create_exercises_schema.sql:47-49`

## Desired End State

After this plan completes:
1. `npm test` runs the integration suite via Vitest
2. One test file (`tests/integration/rls-isolation.test.ts`) contains a green test proving User B cannot read User A's completion by ID
3. `context/foundation/test-plan.md §6.2` is filled in with the cookbook pattern for future RLS/access-control tests

### Key Discoveries

- `src/lib/supabase.ts` imports from `astro:env/server` — importing it in Vitest would crash. Tests must create their own Supabase clients using env vars from a `.env.test` file read by Vitest's `loadEnv`.
- Local Supabase service-role key is available via `npx supabase status` after `npx supabase start`. It must be placed in `.env.test` (gitignored) — never hardcoded.
- `afterAll` teardown (suite-level) is sufficient for local Docker — if a test run crashes, fixtures linger but `npx supabase db reset` clears them cleanly.
- The test targets the DB layer only (not the Astro page) — this is the cheapest layer that proves the RLS policy actually fires.

## What We're NOT Doing

- Not testing the `/results/[id]` Astro page via HTTP (no Astro dev server in tests)
- Not mocking the Supabase client (mock bypasses RLS policy entirely — false green)
- Not setting up Playwright or any browser automation (Risk #1 is a data property, not a UI property)
- Not testing Risk #3 or Risk #6 in this plan (those are separate test files within the same phase)
- Not generating Supabase TypeScript types (deferred — not needed for this test)

## Implementation Approach

Four sequential phases. Phase 1 is pure environment setup; without it, no test can run. Phase 2 creates reusable helpers so the test in Phase 3 stays readable. Phase 3 writes the single test that proves Risk #1. Phase 4 updates the cookbook so future contributors know where to add similar tests.

## Critical Implementation Details

**Test client vs app client:** Tests must instantiate `createClient(supabaseUrl, supabaseKey)` from `@supabase/supabase-js` directly — not the app's `createClient` from `@/lib/supabase`. The app factory depends on `astro:env/server` which is not available outside Astro's runtime.

**Anon key vs service-role key:** Fixture _creation_ (users + completions) uses the Admin client with the service-role key, which bypasses RLS. The _assertion_ query uses a regular client authenticated as User B with their JWT (anon key + signInWithPassword). This is the only setup that actually exercises the RLS policy.

**Path alias in Vitest:** The test helpers use `@/` imports if they reference app types. Vitest needs `resolve.alias` pointing `@/` to `./src/` — or test helpers avoid `@/` imports entirely (simpler for this scope).

---

## Phase 1: Vitest setup

### Overview

Install Vitest, create `vitest.config.ts`, add a `.env.test` file (gitignored) for test env vars, and wire the `test` script in `package.json`. Verify that `npm test` runs an empty suite without errors.

### Changes Required

#### 1. Install Vitest

**File**: `package.json` (devDependencies, via npm install)

**Intent**: Add Vitest as the project's test runner. `@vitest/coverage-v8` is included for future coverage needs.

**Contract**: Run `npm install --save-dev vitest @vitest/coverage-v8`. This adds both to `devDependencies`. No other packages needed — `@supabase/supabase-js` is already in `dependencies`.

#### 2. Vitest config

**File**: `vitest.config.ts` (new file at project root)

**Intent**: Configure Vitest for a Node.js environment (no browser), point it at the `tests/` directory, and resolve the `@/` path alias so test helpers can import app types if needed.

**Contract**: Config must set `environment: "node"`, `include: ["tests/**/*.test.ts"]`, and `resolve.alias` mapping `@/` to `path.resolve(__dirname, "src/")`. It should also load env vars from `.env.test` via Vitest's built-in `loadEnv` or the `envDir` option.

```ts
// vitest.config.ts — shape only; implementer writes the actual file
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: { /* populated from .env.test */ },
  },
  resolve: {
    alias: { "@/": path.resolve(__dirname, "src/") + "/" },
  },
});
```

#### 3. `.env.test` env file

**File**: `.env.test` (new file at project root, **gitignored**)

**Intent**: Store test-only Supabase credentials (local Docker URL + keys) so tests never touch the cloud project.

**Contract**: File must contain:
```
SUPABASE_TEST_URL=http://127.0.0.1:54321
SUPABASE_TEST_ANON_KEY=<anon key from npx supabase status>
SUPABASE_TEST_SERVICE_ROLE_KEY=<service_role key from npx supabase status>
```
Variable names use `_TEST_` prefix to avoid collision with the app's `SUPABASE_URL` / `SUPABASE_KEY`. Add `.env.test` to `.gitignore`.

#### 4. `test` script in package.json

**File**: `package.json`

**Intent**: Add a `test` script so `npm test` runs Vitest.

**Contract**: Add `"test": "vitest run"` to the `scripts` section. `vitest run` (not `vitest watch`) is appropriate for CI and for the plan's automated verification steps.

### Success Criteria

#### Automated Verification

- `npm test` exits 0 with output showing "0 tests passed" (empty suite, no errors)
- `npx tsc --noEmit` still passes (no type errors introduced by vitest.config.ts)

#### Manual Verification

- `.env.test` exists at project root and is not tracked by git (`git status` does not list it)
- `npx supabase start` runs without errors (Docker must be running)

**Implementation note**: Pause after Phase 1 manual verification before proceeding. Local Supabase must be running for Phases 2 and 3.

---

## Phase 2: Test helpers — Supabase clients and fixture factory

### Overview

Create `tests/helpers/supabase.ts` (client factories) and `tests/helpers/fixtures.ts` (user + completion creation/teardown). These helpers are not tests themselves — they are the reusable setup layer that keeps Phase 3's test file readable.

### Changes Required

#### 1. Supabase client factory for tests

**File**: `tests/helpers/supabase.ts` (new file)

**Intent**: Export two functions — `adminClient()` (service-role, bypasses RLS, for fixture setup) and `authClient(jwt)` (anon key + JWT, respects RLS, for assertions). Both read from `process.env` populated by `.env.test`.

**Contract**: `adminClient()` returns a Supabase client created with `SUPABASE_TEST_SERVICE_ROLE_KEY`. `authClient(jwt)` returns a client created with `SUPABASE_TEST_ANON_KEY` and the provided JWT set as the `Authorization: Bearer <jwt>` header via the `global.headers` option. Neither function imports anything from `src/`.

#### 2. Fixture factory

**File**: `tests/helpers/fixtures.ts` (new file)

**Intent**: Export `createFixtureUser(email, password)` (creates a user via Admin API, returns `{ id, email, jwt }`), `createFixtureCompletion(adminClient, userId, exerciseId)` (inserts a completion row, returns the completion id), and `deleteFixtureUsers(adminClient, userIds[])` (deletes users by id — used in `afterAll`).

**Contract**:
- `createFixtureUser` calls `adminClient.auth.admin.createUser({ email, password, email_confirm: true })` then calls `regularClient.auth.signInWithPassword({ email, password })` to get a real JWT. Returns `{ id, jwt }`.
- `createFixtureCompletion` calls `adminClient.from("exercise_completions").insert({ user_id, exercise_id, duration_seconds: 60, errors: 0, type_data: { wpm: 200 } })` and returns the inserted row's `id`.
- `deleteFixtureUsers` calls `adminClient.auth.admin.deleteUser(id)` for each id in the array.
- The factory needs one seeded exercise to reference. Use the well-known seeded exercise ID `a0000000-0000-0000-0000-000000000001` (Animated Pacer dataset_1 — seeded in the initial migration).

### Success Criteria

#### Automated Verification

- `npx tsc --noEmit` passes with test helper files included
- `npm run lint` passes on `tests/helpers/`

#### Manual Verification

- Import both helpers in a scratch REPL or temporary test file, call `adminClient()`, and verify a connection to local Supabase returns without error

---

## Phase 3: RLS isolation integration test

### Overview

Write `tests/integration/rls-isolation.test.ts` — the single test that proves the risk. The test must be green on a running local Supabase instance and must fail if the RLS SELECT policy is removed or corrupted.

### Changes Required

#### 1. RLS isolation test file

**File**: `tests/integration/rls-isolation.test.ts` (new file)

**Intent**: Prove that User B's authenticated Supabase client returns zero rows when querying `exercise_completions` by User A's completion ID — even though User B is a valid authenticated user.

**Contract**: The test follows this exact behaviour spec:

```
GIVEN: User A has one exercise_completion with a known ID
AND:   User B is authenticated (has a valid JWT for a different account)
WHEN:  User B's client queries exercise_completions WHERE id = <user_A_completion_id>
THEN:  The result contains zero rows (data is null or empty array)
```

Structure:
- One `describe("exercise_completions RLS isolation")` block
- `beforeAll`: create User A and User B via fixture factory; create one completion for User A; store the completion ID and User B's JWT
- One `it("User B cannot read User A's completion by ID")` test: uses `authClient(userB.jwt)`, queries `exercise_completions` by User A's completion ID, asserts `data` is null or `data.length === 0`
- `afterAll`: delete both fixture users via `deleteFixtureUsers`
- No mocking anywhere in this file

**Anti-pattern explicitly avoided:** Do not use `vi.mock("@supabase/supabase-js")` or any mock. The test's value is that it exercises the real PostgreSQL RLS policy. A mocked client would be green even if the policy was deleted.

**Regression caught:** A future refactor that drops the `completions_select_own` RLS policy, or changes it from `USING ((select auth.uid()) = user_id)` to `USING (true)`, will cause this test to return User A's data for User B's query — the test will fail on the empty-result assertion.

### Success Criteria

#### Automated Verification

- `npm test` passes with 1 test in 1 suite, green
- `npm run lint` passes on the new test file
- `npx tsc --noEmit` passes

#### Manual Verification

- Manually remove the `completions_select_own` policy in the local Supabase Studio (or via psql), run `npm test` — the test must turn red. Restore the policy and confirm it goes green again. This verifies the test is actually exercising the policy, not passing trivially.

**Implementation note**: The manual red/green flip is the critical verification for a security test. A test that passes regardless of the policy it's meant to check is not a test.

---

## Phase 4: Cookbook update

### Overview

Update `context/foundation/test-plan.md §6.2` with the completed cookbook pattern. After this phase, any contributor can read §6.2 to understand how to add a new RLS or access-control integration test to this project.

### Changes Required

#### 1. Update §6.2 in test-plan.md

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the `§6.2 RLS / cross-user isolation integration test` placeholder with the actual pattern, run command, file location, and reference test.

**Contract**: The updated §6.2 entry must include:
- **Location**: `tests/integration/` — all access-control integration tests live here
- **Naming**: `<subject>-isolation.test.ts` or `<subject>-access.test.ts`
- **Run command**: `npm test` (runs all integration tests) or `npx vitest run tests/integration/<file>` for a single file
- **Helper dependencies**: `tests/helpers/supabase.ts` (client factory) + `tests/helpers/fixtures.ts` (fixture factory)
- **Reference test**: `tests/integration/rls-isolation.test.ts` — describes the two-user pattern and `afterAll` teardown
- **Key rule**: Always use `authClient(jwt)` for assertions (respects RLS); use `adminClient()` only for fixture setup/teardown (bypasses RLS). Never mock the Supabase client in access-control tests.

### Success Criteria

#### Automated Verification

- `npm run lint` passes (markdown lint if configured; otherwise just confirm file is valid markdown)

#### Manual Verification

- Read `context/foundation/test-plan.md §6.2` — a new contributor should be able to understand where to add a new access-control test and how to structure it without reading any other file

---

---

## Phase 5: Astro dev server globalSetup

### Overview

Add a Vitest `globalSetup` file that spawns `astro dev` on port 4322 before any test runs and kills it in teardown. Once this phase is done, `npm test` is fully self-contained for HTTP-level integration tests — no manual server start required.

### Changes Required

#### 1. globalSetup file

**File**: `tests/globalSetup.ts` (new file)

**Intent**: Spawn `npm run dev -- --port 4322` as a child process in the `setup()` export, poll `http://127.0.0.1:4322/` until the server responds (max ~30s), and kill the process in `teardown()`.

**Contract**:
- Export two named functions: `async function setup()` and `async function teardown()`
- In `setup()`: spawn the child process, store the reference in module scope, poll every 250ms until a `fetch("http://127.0.0.1:4322/")` resolves without throwing, throw if the timeout expires
- In `teardown()`: call `child.kill()` and wait for exit; suppress ECONNRESET errors during shutdown
- Expose the base URL as `process.env.TEST_SERVER_URL = "http://127.0.0.1:4322"` so test files read from a single source

The server needs `.dev.vars` (or equivalent env vars) to start without crashing. Tests that hit the server send no auth cookie — the server's env is the same as a normal dev session.

#### 2. Wire globalSetup in vitest.config.ts

**File**: `vitest.config.ts`

**Intent**: Register the globalSetup file so Vitest runs it once before any test suite.

**Contract**: Add `globalSetup: ["tests/globalSetup.ts"]` to the `test` block. No other changes to the config.

### Success Criteria

#### Automated Verification

- `npm test` starts the Astro dev server automatically, runs the existing RLS test suite (still green), and shuts the server down on exit — all in one `npm test` call
- `npx tsc --noEmit` passes with `tests/globalSetup.ts` included

#### Manual Verification

- After `npm test` completes, no `astro dev` process remains running on port 4322 (`lsof -i :4322` returns nothing)
- If the server fails to start within 30s, `npm test` exits non-zero with a clear timeout error message

**Implementation note**: The `.dev.vars` file must exist (with valid `SUPABASE_URL` and `SUPABASE_KEY`) for the Astro dev server to start. This is a local-only requirement — the file is gitignored.

---

## Phase 6: Middleware redirect integration test

### Overview

Write `tests/integration/middleware-redirect.test.ts` — HTTP-level assertions that unauthenticated GET requests to every protected route return 302 → `/auth/signin`, and that `/auth/signin` itself returns 200 (no redirect loop).

### Changes Required

#### 1. Middleware redirect test file

**File**: `tests/integration/middleware-redirect.test.ts` (new file)

**Intent**: Prove the four oracle assertions from research using plain `fetch()` against the running Astro dev server on port 4322.

**Contract**: The test file reads the server URL from `process.env.TEST_SERVER_URL`. It uses `fetch(url, { redirect: "manual" })` so that Node does not follow the 302 automatically — the test must assert the raw 302 status and `Location` header. No cookies are set in any request. No Supabase Docker needed.

Four test cases:

```
1. GET /dashboard        → status 302, Location starts with /auth/signin
2. GET /exercise/test-id → status 302, Location starts with /auth/signin
3. GET /results/test-id  → status 302, Location starts with /auth/signin
4. GET /auth/signin      → status 200 (not a redirect — no loop)
```

Structure:
- One `describe("Middleware redirect — unauthenticated requests")` block
- `it` per route variant (four tests)
- No `beforeAll`/`afterAll` needed (server managed by globalSetup)
- No mocking

**Regressions caught:**
- `PROTECTED_ROUTES` array emptied or routes removed → protected routes return 200
- `startsWith` replaced with `===` → `/exercise/abc` bypasses protection (only `/exercise` exact would match)
- Redirect target changed to a different path → Location header assertion fails
- `/auth/signin` added to `PROTECTED_ROUTES` by mistake → test 4 returns 302 instead of 200 (loop regression)

### Success Criteria

#### Automated Verification

- `npm test` passes with 4 new tests green (total: 6 tests across 2 suites)
- `npm run lint` passes on the new test file
- `npx tsc --noEmit` passes

#### Manual Verification

- Temporarily empty the `PROTECTED_ROUTES` array in `src/middleware.ts` → re-run `npm test` → middleware redirect tests turn red; restore `PROTECTED_ROUTES` → green
- Confirm `GET /auth/signin` test stays green (status 200), ruling out a redirect loop

---

## Phase 7: Secret-leak integration test

### Overview

Write `tests/integration/secret-leak.test.ts` — two HTTP-level assertions that error responses from API routes contain no secret string values. Requires both the Astro dev server (Phase 5) and local Supabase Docker (already running for Phase 3).

### Changes Required

#### 1. Secret-leak test file

**File**: `tests/integration/secret-leak.test.ts` (new file)

**Intent**: Prove that two distinct error-branch responses contain no Supabase secrets, no Bearer tokens, and no stack traces.

**Contract**: The test reads the actual secret values at test time from `process.env.SUPABASE_TEST_ANON_KEY` and `process.env.SUPABASE_TEST_URL` (already in `.env.test`). It asserts that these strings are absent from each response body. Two requests:

```
1. GET /api/exercises/next-for-type?type=animated_pacer (no cookie)
   → expected status: 401
   → expected body: {"error":"Unauthorized"}
   → assert: body does NOT contain process.env.SUPABASE_TEST_ANON_KEY
   → assert: body does NOT contain process.env.SUPABASE_TEST_URL
   → assert: body does NOT contain "Bearer "
   → assert: body does NOT contain "Error:" or a stack trace pattern

2. GET /api/exercises/00000000-0000-0000-0000-000000000000 (no cookie needed — unprotected route)
   → expected status: 404 or 200 with error JSON (route has no auth check; exercises are public)
   → assert: body does NOT contain process.env.SUPABASE_TEST_ANON_KEY
   → assert: body does NOT contain process.env.SUPABASE_TEST_URL
   → assert: body does NOT contain "Bearer "
```

Structure:
- One `describe("Secret leak — error responses contain no secrets")` block
- `it` per endpoint (two tests)
- No fixture setup needed — both requests are unauthenticated and deterministic
- The first test requires no Supabase (401 fires before any DB call); the second needs Supabase running (the route calls the DB; it returns 404 because the UUID doesn't exist)

**Regressions caught:**
- A future refactor serializes a raw Supabase error object into a JSON response → the error object might include connection string → test fails on the anon key assertion
- Accidentally interpolating `SUPABASE_KEY` into an error message string → test fails on key assertion
- `console.error` mistakenly replaced with a response `json()` that includes the error object → caught on either endpoint

### Success Criteria

#### Automated Verification

- `npm test` passes with 2 new tests green (total: 8 tests across 3 suites)
- `npm run lint` passes on the new test file
- `npx tsc --noEmit` passes

#### Manual Verification

- In `src/pages/api/exercises/next-for-type.ts`, temporarily change the 401 response to `JSON.stringify({ error: "Unauthorized", debug: process.env.SUPABASE_TEST_ANON_KEY })` → re-run `npm test` → secret-leak test turns red; revert → green
- This confirms the test would have caught a real key-in-body regression

---

## Phase 8: Cookbook update (§6.3 and §6.4)

### Overview

Fill in `context/foundation/test-plan.md §6.3` (middleware redirect cookbook) and `§6.4` (secret-leak cookbook) with the patterns established by Phases 5–7. Also update `§3 Phase 1` status from `implementing` to `complete`.

### Changes Required

#### 1. §6.3 Middleware redirect integration test

**File**: `context/foundation/test-plan.md`

**Intent**: Document the HTTP-level integration test pattern for middleware redirect so future contributors know how to add a new protected-route assertion.

**Contract**: The §6.3 entry must include:
- **Location**: `tests/integration/middleware-redirect.test.ts`
- **Run command**: `npm test` or `npx vitest run tests/integration/middleware-redirect.test.ts`
- **Server dependency**: Requires globalSetup (`tests/globalSetup.ts`) to spawn Astro dev on port 4322; `TEST_SERVER_URL` env var holds the base URL
- **Key technique**: `fetch(url, { redirect: "manual" })` — prevents Node from auto-following 302; lets you assert `response.status === 302` and `response.headers.get("Location")`
- **No-loop assertion**: Always include a test that `/auth/signin` returns 200, proving no redirect loop exists
- **Regressions caught**: `PROTECTED_ROUTES` modification, `startsWith` → `===` regression, redirect target change, `/auth/signin` added to protected routes by mistake

#### 2. §6.4 Secret-leak integration test

**File**: `context/foundation/test-plan.md`

**Intent**: Document the secret-leak test pattern so future contributors know how to verify a new API error branch doesn't expose secrets.

**Contract**: The §6.4 entry must include:
- **Location**: `tests/integration/secret-leak.test.ts`
- **Run command**: `npm test` or `npx vitest run tests/integration/secret-leak.test.ts`
- **Key technique**: Read actual secret value from `process.env.SUPABASE_TEST_ANON_KEY` at test time; assert `expect(body).not.toContain(secretValue)` — do not hardcode the key in the test
- **Trigger selection**: Use error paths that are deterministic without a session (401 from session-check branch) and with a session (404 from DB-query branch)
- **What to assert absent**: anon key string, `SUPABASE_TEST_URL` string, `"Bearer "` substring, stack trace pattern
- **Red/green verification**: Temporarily add the key to a response body → test turns red; revert → green

#### 3. §3 Phase 1 status update

**File**: `context/foundation/test-plan.md`

**Intent**: Mark Phase 1 as `complete` in the rollout table now that all three risks (#1, #3, #6) are covered.

**Contract**: Change the `Status` cell for Phase 1 from `implementing` to `complete`.

### Success Criteria

#### Automated Verification

- `npm run lint` passes (test-plan.md valid markdown)

#### Manual Verification

- §6.3 is filled in: a new contributor can add a protected-route assertion without reading `middleware-redirect.test.ts`
- §6.4 is filled in: a new contributor can add a secret-leak assertion for a new API route without reading `secret-leak.test.ts`
- §3 Phase 1 row shows `complete`

---

## References

- Research: `context/changes/testing-bootstrap-auth-access/research.md`
- RLS migration: `supabase/migrations/20260605000000_create_exercises_schema.sql:44-54`
- App Supabase client (do not import in tests): `src/lib/supabase.ts`
- Vitest docs: https://vitest.dev/config/

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Vitest setup

#### Automated

- [x] 1.1 `npm test` exits 0 with "0 tests passed" (empty suite) — 39e54b8
- [x] 1.2 `npx tsc --noEmit` passes with vitest.config.ts present — 39e54b8

#### Manual

- [x] 1.3 `.env.test` exists at project root and is not tracked by git — 39e54b8
- [x] 1.4 `npx supabase start` runs without errors (Docker running) — 39e54b8

### Phase 2: Test helpers

#### Automated

- [x] 2.1 `npx tsc --noEmit` passes with test helper files included — 6ba7b95
- [x] 2.2 `npm run lint` passes on `tests/helpers/` — 6ba7b95

#### Manual

- [x] 2.3 `adminClient()` connects to local Supabase without error (verified manually) — 6ba7b95

### Phase 3: RLS isolation integration test

#### Automated

- [x] 3.1 `npm test` passes — 1 test green — 2b2d3e7
- [x] 3.2 `npm run lint` passes on the new test file — 2b2d3e7
- [x] 3.3 `npx tsc --noEmit` passes — 2b2d3e7

#### Manual

- [x] 3.4 Remove `completions_select_own` policy locally → `npm test` turns red; restore → green — 2b2d3e7

### Phase 4: Cookbook update

#### Automated

- [x] 4.1 `npm run lint` passes (test-plan.md valid markdown) — 67bac9c

#### Manual

- [x] 4.2 §6.2 in test-plan.md is filled in with location, naming, run command, and reference test — 67bac9c

### Phase 5: Astro dev server globalSetup

#### Automated

- [x] 5.1 `npm test` starts the Astro dev server automatically (port 4322), runs all existing tests green, and shuts the server down on exit — 482d8af
- [x] 5.2 `npx tsc --noEmit` passes with `tests/globalSetup.ts` included — 482d8af

#### Manual

- [x] 5.3 After `npm test` completes, no process remains on port 4322 (`lsof -i :4322` returns nothing) — 482d8af
- [x] 5.4 If server fails to start within 30s, `npm test` exits non-zero with a clear timeout error — 482d8af

### Phase 6: Middleware redirect integration test

#### Automated

- [x] 6.1 `npm test` passes — 4 new middleware tests green (total ≥6 across 2+ suites) — 9ae2d26
- [x] 6.2 `npm run lint` passes on `tests/integration/middleware-redirect.test.ts` — 9ae2d26
- [x] 6.3 `npx tsc --noEmit` passes — 9ae2d26

#### Manual

- [x] 6.4 Empty `PROTECTED_ROUTES` in `src/middleware.ts` → `npm test` turns red on middleware tests; restore → green — 9ae2d26
- [x] 6.5 `/auth/signin` test stays 200 (no redirect loop confirmed) — 9ae2d26

### Phase 7: Secret-leak integration test

#### Automated

- [x] 7.1 `npm test` passes — 2 new secret-leak tests green (total ≥8 across 3 suites) — eb5e91a
- [x] 7.2 `npm run lint` passes on `tests/integration/secret-leak.test.ts` — eb5e91a
- [x] 7.3 `npx tsc --noEmit` passes — eb5e91a

#### Manual

- [x] 7.4 Temporarily inject `process.env.SUPABASE_TEST_ANON_KEY` into the 401 response body → `npm test` turns red; revert → green — eb5e91a

### Phase 8: Cookbook update (§6.3 and §6.4)

#### Automated

- [x] 8.1 `npm run lint` passes (test-plan.md valid markdown)

#### Manual

- [x] 8.2 §6.3 filled in — middleware redirect pattern documented for future contributors
- [x] 8.3 §6.4 filled in — secret-leak pattern documented for future contributors
- [x] 8.4 §3 Phase 1 row shows `complete`
