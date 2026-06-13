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

- [x] 3.1 `npm test` passes — 1 test green
- [x] 3.2 `npm run lint` passes on the new test file
- [x] 3.3 `npx tsc --noEmit` passes

#### Manual

- [x] 3.4 Remove `completions_select_own` policy locally → `npm test` turns red; restore → green

### Phase 4: Cookbook update

#### Automated

- [ ] 4.1 `npm run lint` passes (test-plan.md valid markdown)

#### Manual

- [ ] 4.2 §6.2 in test-plan.md is filled in with location, naming, run command, and reference test
