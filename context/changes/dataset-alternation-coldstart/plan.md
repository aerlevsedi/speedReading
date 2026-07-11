# Dataset Alternation and Cold-Start — Implementation Plan

## Overview

Write integration tests proving Risk #4 (dataset alternation broken) and Risk #5 (cold-start crash) cannot go undetected. Two test files are added; `tests/helpers/fixtures.ts` gains exercise ID constants. A cookbook entry and rollout sync closes the phase.

## Current State Analysis

- **Alternation algorithm:** `src/lib/services/exerciseService.ts:9-49` — single function, one Supabase query for last completion history, simple ternary alternation, defaults to `dataset_1` on no history.
- **HTTP endpoint:** `GET /api/exercises/next-for-type?type=<exerciseType>` — delegates directly to the service. Requires authentication. Returns full `Exercise` JSON (including `dataset_id` from `select("*")`).
- **Dashboard cold-start path:** `src/pages/dashboard.astro:21-34` calls the service directly (server-side import, not HTTP). Filter nulls + `exercises.length > 0` guard prevent crash. Seeds in DB → exercises always returned for a new user.
- **Missing in test helpers:** No named constants for dataset-specific exercise IDs. `createFixtureCompletion(admin, userId, exerciseId?)` is sufficient if the caller passes a specific `exerciseId`; no new helper function needed.
- **Pattern to reuse:** Cookie injection from `tests/integration/completion-pipeline.test.ts:39-48` — sign in via `POST /api/auth/signin`, strip cookie attributes, replay as `Cookie` header.

## Desired End State

- `tests/integration/dataset-alternation.test.ts` exists with 4 passing tests covering the full alternation oracle and per-type isolation.
- `tests/integration/dashboard-coldstart.test.ts` exists with 1 passing test proving dashboard renders without crash for a brand-new user.
- `tests/helpers/fixtures.ts` exports named constants for all 6 surfaced exercise IDs (both datasets, three types).
- `npm test` is green. `§3` Phase 3 is `complete`. `§6.6` and `§6.7` cookbook entries are filled in.

### Key Discoveries

- `src/lib/services/exerciseService.ts:24-33` — alternation is a ternary on `lastDataset`; the only DB state that matters is the `dataset_id` of the most-recent completion for the given exercise type.
- Alternation is **per exercise type** — completions for `animated_pacer` have no effect on the next exercise returned for `focus_sprint`.
- `tests/helpers/fixtures.ts:63` — `createFixtureCompletion` accepts an optional `exerciseId` defaulting to `SEEDED_EXERCISE_ID` (animated_pacer dataset_1). Passing a different exercise ID is all that's needed to seed alternation state.
- Smart Questions (IDs `011`, `012`) are seeded in DB but never surfaced in UI — excluded from tests per historical decision in `context/changes/all-exercise-types/plan.md:79-100`.
- Cold-start test requires HTTP (not a unit test of the service): dashboard calls the service server-side; only an HTTP render test proves the full path including guards.

## What We're NOT Doing

- Not testing `focus_sprint` or `speed_scan` alternation end-to-end — the algorithm is identical for all types; one type is sufficient.
- Not testing Smart Questions type — removed from UI, not a live risk.
- Not testing the results page cold-start — it is only reachable after a completion; not a cold-start entry point.
- Not mocking the Supabase client — mock would lie about DB state, defeating the purpose of these tests.
- Not wiring CI gate — that is Phase 4 (separate change).

## Implementation Approach

Phase 1 adds exercise ID constants and writes `dataset-alternation.test.ts` with three alternation `it()` blocks and one per-type isolation block, all sharing a single fixture user and using `adminClient()` to insert completions. A `beforeEach` deletes the user's completions so each `it()` starts from a clean state. Cookie injection follows the existing pattern from `completion-pipeline.test.ts`.

Phase 2 writes `dashboard-coldstart.test.ts` — creates a fixture user with no completions, sends `GET /dashboard` with session cookies, asserts 200 and presence of at least one `/exercise/` href in the HTML body.

Phase 3 fills in `§6.6` and `§6.7` in `test-plan.md` and advances `§3 Phase 3` to `complete`.

---

## Phase 1: Exercise ID constants + alternation integration tests

### Overview

Add named exercise ID constants to `tests/helpers/fixtures.ts`, then write `tests/integration/dataset-alternation.test.ts` with four tests that drive the full alternation oracle via the HTTP endpoint.

### Changes Required

#### 1. Exercise ID constants

**File:** `tests/helpers/fixtures.ts`

**Intent:** Add named constants for all six surfaced exercise IDs so test files can reference datasets by name rather than raw UUIDs.

**Contract:** Append after `SEEDED_EXERCISE_ID` (line 4):

```ts
// Seeded exercise IDs by type and dataset (smart_questions excluded — not surfaced in UI)
export const ANIMATED_PACER_DATASET1_ID = "a0000000-0000-0000-0000-000000000001";
export const ANIMATED_PACER_DATASET2_ID = "a0000000-0000-0000-0000-000000000002";
export const FOCUS_SPRINT_DATASET1_ID   = "a0000000-0000-0000-0000-000000000021";
export const FOCUS_SPRINT_DATASET2_ID   = "a0000000-0000-0000-0000-000000000022";
export const SPEED_SCAN_DATASET1_ID     = "a0000000-0000-0000-0000-000000000031";
export const SPEED_SCAN_DATASET2_ID     = "a0000000-0000-0000-0000-000000000032";
```

`SEEDED_EXERCISE_ID` stays as-is (same value as `ANIMATED_PACER_DATASET1_ID`) for backward compatibility with existing tests.

#### 2. Alternation integration test file

**File:** `tests/integration/dataset-alternation.test.ts`

**Intent:** Prove via HTTP that the next-for-type endpoint alternates datasets correctly and that per-type isolation holds.

**Contract:**

```
describe("GET /api/exercises/next-for-type — dataset alternation")
  beforeAll:
    - createFixtureUser("alternation@test.local", "pw-alternation-123!")
    - POST {BASE_URL}/api/auth/signin (FormData) with redirect:"manual"
    - Collect Set-Cookie headers → cookieHeader string (same pattern as completion-pipeline.test.ts:39-48)

  afterAll:
    - deleteFixtureUsers(admin, [userId].filter(Boolean))

  beforeEach:
    - adminClient().from("exercise_completions").delete().eq("user_id", userId)
      (clears completions so each it() starts from a known state)

  it("returns dataset_1 when user has no completions for animated_pacer")
    - GET {BASE_URL}/api/exercises/next-for-type?type=animated_pacer
      fetch({ redirect: "manual", headers: { Cookie: cookieHeader } })
    - Assert response.status === 200
    - const body = await response.json()
    - Assert body.dataset_id === "dataset_1"

  it("returns dataset_2 after a dataset_1 completion for animated_pacer")
    - adminClient().from("exercise_completions").insert({
        user_id: userId,
        exercise_id: ANIMATED_PACER_DATASET1_ID,
        duration_seconds: 60, errors: 0, type_data: { wpm: 200 }
      })
    - GET {BASE_URL}/api/exercises/next-for-type?type=animated_pacer
    - Assert response.status === 200
    - Assert body.dataset_id === "dataset_2"

  it("returns dataset_1 after a dataset_2 completion for animated_pacer")
    - adminClient().from("exercise_completions").insert({
        user_id: userId,
        exercise_id: ANIMATED_PACER_DATASET2_ID,
        duration_seconds: 60, errors: 0, type_data: { wpm: 200 }
      })
    - GET {BASE_URL}/api/exercises/next-for-type?type=animated_pacer
    - Assert response.status === 200
    - Assert body.dataset_id === "dataset_1"

  it("animated_pacer completions do not affect focus_sprint result")
    - adminClient().from("exercise_completions").insert({
        user_id: userId,
        exercise_id: ANIMATED_PACER_DATASET1_ID,   // animated_pacer dataset_1 completion
        duration_seconds: 60, errors: 0, type_data: { wpm: 200 }
      })
    - GET {BASE_URL}/api/exercises/next-for-type?type=focus_sprint
      (focus_sprint has no completions)
    - Assert response.status === 200
    - Assert body.dataset_id === "dataset_1"   // cold-start default, unaffected by animated_pacer history
```

**Note on beforeEach cleanup:** `delete().eq("user_id", userId)` removes all completions for the fixture user between tests. This is intentional — each `it()` proves one oracle rule in isolation. `adminClient()` bypasses RLS for cleanup.

### Success Criteria

#### Automated Verification

- `npm test` passes with 4 new tests green
- `npm run lint` passes (no new lint errors)
- `npm run typecheck` passes (no new type errors)

#### Manual Verification

- All 4 tests pass against local Supabase (`npx supabase start`)
- Destructive verify: change `"dataset_1"` to `"dataset_2"` in the cold-start `it()` assertion → test turns red; restore → green

---

## Phase 2: Cold-start dashboard integration test

### Overview

Write `tests/integration/dashboard-coldstart.test.ts` proving that a brand-new authenticated user (0 completions) sees a functional dashboard — not a crash.

### Changes Required

#### 1. Cold-start dashboard test file

**File:** `tests/integration/dashboard-coldstart.test.ts`

**Intent:** Prove that `GET /dashboard` with an authenticated session and zero completions returns 200 and renders at least one exercise card — not a 500 or empty page.

**Contract:**

```
describe("GET /dashboard — cold-start (0 completions)")
  beforeAll:
    - createFixtureUser("coldstart@test.local", "pw-coldstart-123!")
    - POST {BASE_URL}/api/auth/signin (FormData) → collect cookieHeader
    (no completions inserted — user stays at 0 throughout)

  afterAll:
    - deleteFixtureUsers(admin, [userId].filter(Boolean))

  it("renders dashboard with exercise cards for a brand-new user")
    - GET {BASE_URL}/dashboard
      fetch({ redirect: "manual", headers: { Cookie: cookieHeader } })
    - Assert response.status === 200
    - const html = await response.text()
    - Assert html.includes("/exercise/")    // at least one exercise card link
    - Assert !html.includes("Error:")       // no unhandled error in body
    - Assert !html.includes("at Object.")   // no stack trace in body
```

**Why `/exercise/` in href:** The dashboard renders `ExerciseCard` components that link to `/exercise/[id]`. Presence of this pattern in the HTML proves the seed data was fetched and at least one card was rendered — a stronger signal than status 200 alone.

### Success Criteria

#### Automated Verification

- `npm test` passes with 1 new cold-start test green
- `npm run lint` passes
- `npm run typecheck` passes

#### Manual Verification

- Test passes against local Supabase
- Destructive verify: temporarily break the dashboard service call (e.g., pass wrong user ID) → test turns red on the `/exercise/` assertion; restore → green

---

## Phase 3: Cookbook §6.6 + §6.7 + rollout sync

### Overview

Fill in the two TBD cookbook entries in `test-plan.md` and advance Phase 3 rollout status to `complete`.

### Changes Required

#### 1. Cookbook §6.6 — Dataset alternation integration test

**File:** `context/foundation/test-plan.md`

**Intent:** Replace the TBD placeholder in §6.6 with a recipe explaining how to add future alternation tests.

**Contract:** Fill in the section under `### 6.6 Dataset alternation unit/integration test` describing: file location, test pattern (beforeAll/beforeEach/afterAll), the per-type isolation technique, cookie injection reference, and the red/green destructive verify.

#### 2. Cookbook §6.7 — Cold-start render integration test

**File:** `context/foundation/test-plan.md`

**Intent:** Replace the TBD placeholder in §6.7 with a recipe for cold-start page render tests.

**Contract:** Fill in under `### 6.7 Cold-start render integration test`: file location, fixture user with no completions, `html.includes("/exercise/")` pattern, why HTTP render is required (dashboard calls service server-side, not through endpoint), and red/green verify.

#### 3. §3 Phase 3 rollout status

**File:** `context/foundation/test-plan.md`

**Intent:** Update the Phase 3 row from `not started` to `complete` and fill in the change folder cell.

**Contract:** In the `§3 Phased Rollout` table, change Phase 3 row: Status → `complete`, Change folder → `context/changes/dataset-alternation-coldstart/`.

### Success Criteria

#### Automated Verification

- `npm run lint` passes
- `npm run typecheck` passes

#### Manual Verification

- Open `context/foundation/test-plan.md` — §6.6 and §6.7 are no longer TBD; §3 Phase 3 row shows `complete`

---

## Testing Strategy

### Integration Tests

- `tests/integration/dataset-alternation.test.ts` — 4 tests: cold-start, d1→d2, d2→d1, per-type isolation.
- `tests/integration/dashboard-coldstart.test.ts` — 1 test: authenticated GET /dashboard with 0 completions.
- Run with: `npm test` (all) or `npx vitest run tests/integration/<file>` (single file).

### Manual Testing Steps

1. Start local Supabase: `npx supabase start`
2. Start dev server: `npm run dev`
3. `npm test` — all 5 new tests must be green.
4. Destructive verify for alternation: edit the cold-start assertion to `"dataset_2"` → red; restore → green.
5. Destructive verify for cold-start: break the dashboard service call temporarily → red on `/exercise/` assertion; restore → green.

## References

- Research: `context/changes/dataset-alternation-coldstart/research.md`
- Alternation service: `src/lib/services/exerciseService.ts:9-49`
- HTTP endpoint: `src/pages/api/exercises/next-for-type.ts`
- Dashboard: `src/pages/dashboard.astro:21-34`
- Cookie injection pattern: `tests/integration/completion-pipeline.test.ts:39-48`
- Existing fixtures: `tests/helpers/fixtures.ts`
- Prior phase: `context/changes/completion-pipeline-correctness/plan.md`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Exercise ID constants + alternation integration tests

#### Automated

- [x] 1.1 `npm test` passes with 4 new alternation tests green
- [x] 1.2 `npm run lint` passes (no new lint errors)
- [x] 1.3 `npm run typecheck` passes (no new type errors)

#### Manual

- [x] 1.4 All 4 tests pass against local Supabase (`npx supabase start`)
- [x] 1.5 Destructive verify: change cold-start assertion to `"dataset_2"` → test turns red; restore → green

### Phase 2: Cold-start dashboard integration test

#### Automated

- [ ] 2.1 `npm test` passes with 1 new cold-start test green
- [ ] 2.2 `npm run lint` passes
- [ ] 2.3 `npm run typecheck` passes

#### Manual

- [ ] 2.4 Test passes against local Supabase
- [ ] 2.5 Destructive verify: break dashboard service call → test turns red on `/exercise/` assertion; restore → green

### Phase 3: Cookbook §6.6 + §6.7 + rollout sync

#### Automated

- [ ] 3.1 `npm run lint` passes
- [ ] 3.2 `npm run typecheck` passes

#### Manual

- [ ] 3.3 §6.6 and §6.7 in test-plan.md are filled in (not TBD); §3 Phase 3 row shows `complete`
