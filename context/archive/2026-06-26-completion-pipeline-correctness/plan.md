# Completion Pipeline Correctness — Implementation Plan

## Overview

Write an integration test (`tests/integration/completion-pipeline.test.ts`) that proves Risk #2 — a silent DB write failure masked by a successful-looking redirect — cannot go undetected. The test POSTs to the live Astro dev server as an authenticated user (via cookie injection from a real sign-in), then queries `exercise_completions` via `adminClient()` to verify the row landed. A second test triggers an FK-violation error to prove the failure branch redirects correctly. Phase 2 closes with a cookbook entry and rollout status update.

## Current State Analysis

- **Route:** `POST /api/exercises/complete` always 302-redirects. Success → `/results/{id}`. Insert failure → `/dashboard?error=Failed+to+save+completion`. Status code alone cannot distinguish the two outcomes.
- **WPM:** Computed server-side as `Math.round(wordCount / (durationSeconds / 60))` using the fetched exercise content. Client sends only `duration_seconds` and `errors`.
- **Seeded exercise** (`a0000000-0000-0000-0000-000000000001`): `animated_pacer`, content word count = **262 words**. At `duration_seconds=60`: expected WPM = `Math.round(262 / (60/60))` = **262**.
- **Session cookies:** The Astro app uses `@supabase/ssr` cookie-based auth. The middleware calls `supabase.auth.getUser()` which reads from cookies, not the `Authorization` header. Cookie injection requires signing in via `POST /api/auth/signin` and forwarding the `Set-Cookie` response headers to subsequent requests.
- **Test infrastructure:** All Phase 1 helpers (`adminClient`, `authClient`, `createFixtureUser`, `deleteFixtureUsers`, `globalSetup`, `vitest.config.ts`) are reusable with no changes.

## Desired End State

`tests/integration/completion-pipeline.test.ts` exists with three passing tests:
1. Happy path — authenticated POST → DB row exists with exact WPM → owner can read it back via `authClient`.
2. Error branch — POST with invalid `exercise_id` (zero UUID, FK violation) → redirect to `/dashboard?error=`.
3. No authenticated session test — POST without cookies → redirect to `/auth/signin`.

Running `npm test` is green. `§3` Phase 2 is `complete`. `§6.5` cookbook is filled in.

### Key Discoveries

- `src/pages/api/exercises/complete.ts:50` — insert failure redirects to `/dashboard?error=Failed+to+save+completion`, not a 5xx. Tests that only check `response.status` will always pass even when the write silently fails.
- `src/pages/api/exercises/complete.ts:53` — success redirect is to `/results/{completion_id}`. Parsing this URL gives us the completion ID without querying the DB a second time.
- Cookie injection: POST to `/api/auth/signin` with FormData, collect `Set-Cookie` headers from the response, replay them as the `Cookie` header on the completion POST.
- FK-violation trigger: send `exercise_id = "00000000-0000-0000-0000-000000000000"` (a valid UUID format that references no row in `exercises`). The FK constraint fires, Supabase returns an error, and the route redirects to the dashboard error path.
- `tests/helpers/fixtures.ts:4` — `SEEDED_EXERCISE_ID = "a0000000-0000-0000-0000-000000000001"`.

## What We're NOT Doing

- Not testing the results page render (that's Phase 3 / cold-start).
- Not testing the `next-for-type` alternation logic (Phase 3).
- Not wiring CI gate (Phase 4).
- Not mocking the Supabase client — mock would never catch a real RLS or route-level regression.
- Not asserting WPM display in the browser — the DB-write assertion is the signal; UI rendering is a separate concern.

## Implementation Approach

Two-test file: one happy-path test with a read-back assertion, one error-branch test. Cookie injection is done by treating the dev server as a real browser would: POST credentials to `/api/auth/signin`, collect cookies, use them on the completion POST. The session sign-in and fixture user creation happen in `beforeAll`; `afterAll` deletes the fixture user (cascade removes completion).

---

## Phase 1: Completion pipeline integration test

### Overview

Create `tests/integration/completion-pipeline.test.ts` with three tests covering the happy path (DB write + exact WPM + owner read-back), the error branch (FK violation → dashboard redirect), and the unauthenticated path (no cookies → signin redirect).

### Changes Required

#### 1. New integration test file

**File:** `tests/integration/completion-pipeline.test.ts`

**Intent:** Prove that a valid authenticated POST to `/api/exercises/complete` writes a row to `exercise_completions` with the correct WPM value, and that the failure branch (invalid exercise_id) redirects to the dashboard error path rather than silently pretending to succeed.

**Contract:**

```
describe("POST /api/exercises/complete")
  beforeAll:
    - createFixtureUser("completion-pipeline@test.local", "pw-pipeline-123!")
    - POST to {BASE_URL}/api/auth/signin with FormData {email, password}
      using fetch({ redirect: "manual" }) — collect Set-Cookie response headers
      into a cookieHeader string to replay on subsequent requests
  afterAll:
    - deleteFixtureUsers(admin, [userId].filter(Boolean))

  it("inserts a completion row and redirects to /results/{id}")
    - POST {BASE_URL}/api/exercises/complete with FormData
        { exercise_id: SEEDED_EXERCISE_ID, duration_seconds: "60", errors: "0" }
      fetch({ redirect: "manual", headers: { Cookie: cookieHeader } })
    - Assert response.status === 302
    - Assert response.headers.get("location") starts with "/results/"
    - Extract completionId from location URL (last path segment)
    - adminClient().from("exercise_completions").select("*").eq("id", completionId).single()
    - Assert result.error is null
    - Assert result.data.user_id === userId
    - Assert result.data.type_data.wpm === 262   // Math.round(262 / (60/60))
    - Assert result.data.duration_seconds === 60
    - Read-back via authClient(jwt):
      authClient(jwt).from("exercise_completions").select("id").eq("id", completionId)
      Assert result.data has length 1 (owner SELECT policy allows own row)

  it("redirects to /dashboard?error= when exercise_id FK is invalid")
    - POST {BASE_URL}/api/exercises/complete with FormData
        { exercise_id: "00000000-0000-0000-0000-000000000000",
          duration_seconds: "60", errors: "0" }
      fetch({ redirect: "manual", headers: { Cookie: cookieHeader } })
    - Assert response.status === 302
    - Assert response.headers.get("location") includes "/dashboard"
    - Assert response.headers.get("location") includes "error="

  it("redirects to /auth/signin when no session cookie is present")
    - POST {BASE_URL}/api/exercises/complete with FormData
        { exercise_id: SEEDED_EXERCISE_ID, duration_seconds: "60", errors: "0" }
      fetch({ redirect: "manual" })   // no Cookie header
    - Assert response.status === 302
    - Assert response.headers.get("location") starts with "/auth/signin"
```

Cookie collection pattern:
```typescript
// After POST to /api/auth/signin:
const setCookieHeaders = signinResponse.headers.getSetCookie?.() ??
  [signinResponse.headers.get("set-cookie")].filter(Boolean);
// Strip attributes (Expires=, Path=, HttpOnly, etc.) — keep only name=value pairs
const cookieHeader = setCookieHeaders
  .map((h) => h.split(";")[0])
  .join("; ");
```

The `getSetCookie()` method (Node 18+) returns all `Set-Cookie` headers as an array; fall back to `headers.get("set-cookie")` if unavailable. `@supabase/ssr` may chunk the session across multiple cookies — collect all of them.

### Success Criteria

#### Automated Verification

- `npm test` passes with all three new tests green
- `npm run lint` passes (no new lint errors)
- `npm run typecheck` passes (no new type errors)

#### Manual Verification

- Run `npm test` against a running local Supabase (`npx supabase start`) and confirm the test output shows all three tests passing with clear descriptions
- Temporarily comment out the `adminClient()` DB read assertion and confirm the test still passes — then verify the route really does write by confirming the assertion was the only thing checking the DB (demonstrates the test would catch a silent failure if re-enabled)

**Implementation Note:** Pause after Phase 1 automated tests pass for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Cookbook §6.5 + rollout sync

### Overview

Document the cookie-injection pattern in `test-plan.md §6.5` so future contributors know how to write authenticated HTTP POST tests. Mark Phase 2 of the phased rollout as `complete` in `§3`.

### Changes Required

#### 1. Fill in §6.5 in test-plan.md

**File:** `context/foundation/test-plan.md`

**Intent:** Replace the `TBD` placeholder under `### 6.5 Completion API DB-write integration test` with a filled-in cookbook entry that documents the cookie-injection pattern, the DB-write verification approach, and the exact WPM assertion technique.

**Contract:** The entry should cover: location (`tests/integration/completion-pipeline.test.ts`), run command, the cookie-injection technique (POST to signin, collect `Set-Cookie`, strip attributes, replay as `Cookie` header), why `adminClient()` is used for DB read-back (bypasses RLS; required to read with certainty regardless of SELECT policy), how to derive the expected WPM (word count from seeded content / duration), and what regressions the test catches.

#### 2. Update §3 Phase 2 status

**File:** `context/foundation/test-plan.md`

**Intent:** Change the Phase 2 row status from `not started` to `complete` and fill in the `Change folder` cell.

**Contract:** In the `§3 Phased Rollout` table, update:
- Status: `not started` → `complete`
- Change folder: `—` → `context/changes/completion-pipeline-correctness/`

### Success Criteria

#### Automated Verification

- `npm run lint` passes
- `npm run typecheck` passes

#### Manual Verification

- Open `context/foundation/test-plan.md` and confirm §6.5 is no longer `TBD`, §3 Phase 2 row shows `complete`, and the change folder cell is filled.

---

## Testing Strategy

### Integration Tests

- `tests/integration/completion-pipeline.test.ts` — the primary deliverable. Three tests covering write path, error path, and unauthenticated path.
- Run with: `npm test` (all) or `npx vitest run tests/integration/completion-pipeline.test.ts` (single file).

### Manual Testing Steps

1. Start local Supabase: `npx supabase start`
2. Run `npm test` — all tests including Phase 1 tests must stay green.
3. Verify the new test file appears in the output with three passing assertions.
4. As a destructive verification: temporarily drop the SELECT RLS policy via Supabase Studio, re-run `npm test`, confirm the read-back assertion turns red. Restore with `npx supabase db reset`.

## References

- Research: `context/changes/completion-pipeline-correctness/research.md`
- Completion route: `src/pages/api/exercises/complete.ts`
- Seeded exercise migration: `supabase/migrations/20260605000000_create_exercises_schema.sql`
- RLS isolation test (golden pattern): `tests/integration/rls-isolation.test.ts`
- Fixture helpers: `tests/helpers/fixtures.ts`, `tests/helpers/supabase.ts`
- Phase 1 test-plan rollout row: `context/foundation/test-plan.md §3`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Completion pipeline integration test

#### Automated

- [x] 1.1 `npm test` passes with all three new tests green
- [x] 1.2 `npm run lint` passes (no new lint errors)
- [x] 1.3 `npm run typecheck` passes (no new type errors)

#### Manual

- [x] 1.4 All three tests pass against local Supabase (`npx supabase start`)
- [x] 1.5 Destructive verify: comment out DB read assertion → test still passes; re-enable → test proves the write

### Phase 2: Cookbook §6.5 + rollout sync

#### Automated

- [x] 2.1 `npm run lint` passes
- [x] 2.2 `npm run typecheck` passes

#### Manual

- [x] 2.3 §6.5 in test-plan.md is filled in (not TBD), §3 Phase 2 row shows `complete`
