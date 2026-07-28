---
date: 2026-06-26T00:00:00+02:00
researcher: claude-sonnet-4-6
git_commit: 477ae315213b3a9d00ba3ff81b3a98e1793b9500
branch: main
repository: aerlevsedi/speedReading
topic: "Completion pipeline correctness — integration test oracle and test design"
tags: [research, codebase, exercise-completions, supabase, api, wpm, integration-testing]
status: complete
last_updated: 2026-06-26
last_updated_by: claude-sonnet-4-6
---

# Research: Completion pipeline correctness

**Date**: 2026-06-26  
**Researcher**: claude-sonnet-4-6  
**Git Commit**: 477ae315213b3a9d00ba3ff81b3a98e1793b9500  
**Branch**: main  
**Repository**: aerlevsedi/speedReading

## Research Question

What does the completion pipeline actually do? What should a Phase 2 integration test prove, and what is the oracle — the authoritative expected behaviour from non-implementation sources?

Risk #2 from `test-plan.md §2`: **Exercise completion silently not persisted — results page shows success but DB write never landed.**

---

## Summary

The completion pipeline is a single POST endpoint (`/api/exercises/complete`) that: validates the session, fetches the exercise content, computes WPM server-side, and inserts into `exercise_completions`. On success it 302-redirects to `/results/{id}`. On Supabase write failure it also 302-redirects — but to `/dashboard?error=Failed+to+save+completion` — making the failure invisible to the client unless the test explicitly queries the DB.

**Oracle (from PRD FR-010 + domain rules, not from implementation):**
1. After the API returns a redirect to `/results/{id}`, the DB row with that `id` MUST exist in `exercise_completions`.
2. The row's `user_id` MUST equal the authenticated user's session ID (RLS INSERT policy enforces this at the DB level too).
3. `type_data.wpm` MUST be a non-negative integer, computed as `Math.round(wordCount / (durationSeconds / 60))`.
4. For speed-reading exercise types (`animated_pacer`, `focus_sprint`), `wpm > 0` when `duration_seconds > 0`.

**Cheapest test that gives a real signal:** One integration test that:
- Creates a fixture user with an authenticated session
- POSTs to `POST /api/exercises/complete` via `fetch` with real `FormData`
- Follows the redirect to extract the completion ID from the `Location` header
- Queries `exercise_completions` via `adminClient()` to verify the row exists
- Asserts `type_data.wpm` is within a sane range

This test catches the "route returns 302 but DB write silently failed" class of bug (Risk #2) — which no response-body assertion can catch.

---

## Detailed Findings

### Completion API route

**File:** `src/pages/api/exercises/complete.ts`

- Exported method: `POST` (line 4)
- URL: `/api/exercises/complete`
- Request format: `FormData` with fields `exercise_id`, `duration_seconds`, `errors` (lines 11–14)
- Auth: `context.locals.user` from middleware — `user_id` is **never accepted from client body** (line 5). Lessons.md rule honoured.
- `createClient` null-check present at lines 20–23. Returns redirect to dashboard on failure — not a JSON 500. This matters for the test: the route never throws; it always redirects.
- Exercise content fetched server-side to count words (line 26)
- WPM computed: `Math.round(wordCount / (durationSeconds / 60))` — returns `0` if `durationSeconds <= 0` (line 33)
- Insert into `exercise_completions` (lines 36–46): `user_id`, `exercise_id`, `duration_seconds`, `errors`, `type_data: { wpm }`
- **Success response:** 302 to `/results/{completion_id}` (line 53) — the completion ID is embedded in the redirect URL
- **Insert failure response:** 302 to `/dashboard?error=Failed+to+save+completion` (line 50) — still a redirect, no 5xx. Tests MUST verify the DB row, not just the response code.

### exercise_completions schema

**File:** `supabase/migrations/20260605000000_create_exercises_schema.sql` (lines 30–54)

```sql
CREATE TABLE exercise_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  duration_seconds INTEGER NOT NULL,
  errors INTEGER NOT NULL DEFAULT 0,
  type_data JSONB NOT NULL DEFAULT '{}',
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE exercise_completions ENABLE ROW LEVEL SECURITY;
-- SELECT: (select auth.uid()) = user_id
-- INSERT: WITH CHECK ((select auth.uid()) = user_id)
```

No UPDATE or DELETE policies — authenticated users cannot modify or delete their own completions. Only service role can. This means `adminClient()` is required for teardown in tests (consistent with Phase 1 pattern).

**Index:** `idx_exercise_completions_user_date ON (user_id, completed_at DESC)` — fast history queries.

### WPM oracle and sane range

WPM is computed entirely server-side from the exercise's `content` field, not from any client-supplied value. The client only sends `duration_seconds` and `errors`.

**Formula:** `wpm = Math.round(wordCount / (durationSeconds / 60))`  
where `wordCount = content.split(/\s+/).length`

**Sane range from PRD (prd.md:165):**
- Beginner: 200–250 wpm
- Intermediate: 300–350 wpm
- Advanced: 400+ wpm
- Default AnimatedPacer target: 250 wpm

For the test assertion, a range of **50–2000 wpm** is a defensible sane-range gate: below 50 is physically implausible for any real text; above 2000 would require reading a full novel in seconds and indicates a timing bug. This is an oracle-from-domain-knowledge assertion, not mirrored from the implementation.

**Exercise types that store meaningful WPM:** `animated_pacer`, `focus_sprint`. The `speed_scan` and `smart_questions` types store `wpm` in `type_data` too (the route always computes it), but the results page only displays it for the reading types.

The seeded exercise (`SEEDED_EXERCISE_ID = "a0000000-0000-0000-0000-000000000001"`) is reused by Phase 1 fixtures. Its content length determines the word count for WPM calculation. The test should use the same seeded exercise so the word count is predictable.

### How to submit the completion via HTTP (test mechanism)

The route consumes `FormData` (Astro's `context.request.formData()` pattern), not JSON. The test must send an actual `multipart/form-data` or `application/x-www-form-urlencoded` POST — a plain JSON body will fail the `parseInt` extraction on lines 12–14.

The route always redirects (302). To follow the redirect and capture the completion ID:
```
fetch(url, { method: "POST", body: formData, redirect: "follow" })
```
The final URL after following will be `/results/{id}` — parse `id` from `response.url`.

Or use `redirect: "manual"` and read the `Location` header directly.

For the authenticated POST the test must supply a session cookie. The cleanest approach: sign the fixture user in via `authClient(jwt)`, but HTTP fetch to the dev server needs the session cookie. **Alternative:** use `supabase.auth.signIn` via `authClient`, retrieve the session cookie name from the `@supabase/ssr` layer, and set it on the `fetch` call. This is the approach used in `rls-isolation.test.ts` but for Supabase queries, not HTTP requests.

**Simpler alternative that avoids cookie plumbing:** Call the Supabase insert directly via `authClient(jwt)` in the test, bypassing the HTTP layer. This is cheaper and still exercises the real DB + RLS, but does NOT catch route-level bugs (e.g., the createClient null-path redirecting instead of inserting). The test-plan calls for proving the pipeline — which implies the API route must be in the chain.

**Recommended approach for Phase 2:** Direct `authClient` insert test to prove DB write + RLS + WPM calculation works, PLUS a separate HTTP-layer test to catch redirect-instead-of-insert failures. The HTTP layer test can assert that the redirect target is `/results/...` (not `/dashboard?error=...`), which distinguishes success from silent failure without cookie plumbing. Cookie injection approach can be added as a stretch goal.

### Existing test infrastructure — reusable components

**File:** `tests/helpers/supabase.ts`
- `adminClient()` — service-role client, bypasses RLS. Use for setup/teardown and for reading back inserted rows.
- `authClient(jwt)` — anon-key client + Bearer JWT, respects RLS. Use for asserting own-data access.
- `anonClient()` — unauthenticated, no JWT. Useful for testing unauthenticated paths.

**File:** `tests/helpers/fixtures.ts`
- `createFixtureUser(email, password)` → `{ id, jwt }` — creates a confirmed user + signs in. Reuse as-is.
- `createFixtureCompletion(admin, userId, exerciseId?)` → `completionId` — inserts a row with `duration_seconds=60, errors=0, type_data: { wpm: 200 }`. Useful for Phase 2 read-path tests (results page). For write-path test, the API route does the insert.
- `deleteFixtureUsers(admin, userIds)` — safe batch cleanup. Reuse in `afterAll`.
- Seeded exercise ID constant: `SEEDED_EXERCISE_ID = "a0000000-0000-0000-0000-000000000001"` (fixtures.ts line 4).

**File:** `tests/globalSetup.ts` — spawns Astro dev server on port 4322, sets `TEST_SERVER_URL`. Already wired in `vitest.config.ts`. No changes needed.

**File:** `vitest.config.ts` — hookTimeout 60s, env from `.env.test`, global setup already configured. No changes needed.

---

## Code References

- `src/pages/api/exercises/complete.ts:1–57` — Full completion POST handler
- `src/pages/api/exercises/complete.ts:33` — WPM formula: `Math.round(wordCount / (durationSeconds / 60))`
- `src/pages/api/exercises/complete.ts:50` — Insert failure redirect path (critical: not a 5xx)
- `src/pages/api/exercises/complete.ts:53` — Success redirect to `/results/{id}`
- `src/pages/results/[id].astro:26–31` — Results page query (SELECT + user_id filter)
- `src/pages/results/[id].astro:53` — WPM display condition: only for `animated_pacer` and `focus_sprint`
- `src/types.ts:33–44` — `Completion` interface
- `src/components/exercise/ExerciseFlow.tsx:40–48` — Hidden form that POSTs to `/api/exercises/complete`
- `supabase/migrations/20260605000000_create_exercises_schema.sql:30–54` — Table + RLS
- `tests/helpers/fixtures.ts:4` — `SEEDED_EXERCISE_ID`
- `tests/helpers/fixtures.ts:60–82` — `createFixtureCompletion` (fields inserted)
- `tests/integration/rls-isolation.test.ts` — Golden pattern for beforeAll/tests/afterAll

---

## Architecture Insights

**Route always redirects — never throws or returns JSON.** Every error branch (no user, null client, exercise not found, insert failure) is a 302 redirect. This is consistent with Astro SSR form-submission idioms where the client is a browser. For tests, this means: asserting `response.status === 200` proves nothing; you must parse the `Location` header or query the DB to distinguish success from failure.

**RLS INSERT policy enforces `user_id = auth.uid()`.** Even if the API route had a bug that passed a wrong `user_id`, the Supabase insert would be rejected by the DB. The test should use `authClient(jwt)` for the insert assertion to prove the RLS-compliant path works — and verify `user_id` in the returned row equals the fixture user's ID.

**WPM is computed from exercise content, not from client timing.** The client sends `duration_seconds`; the server fetches the content and counts words. This means: a test that inserts a completion with a known `duration_seconds` value and a known exercise (seeded exercise with predictable word count) can assert an exact WPM. No need to accept a range — unless the content word count is uncertain.

**`createFixtureCompletion` uses fixed values (wpm: 200).** This is fine for RLS tests that just need a row to exist. For Phase 2's DB-write test, the API route does the insert, so the fixture function is not the right tool for the write-path test — but is the right tool for testing the read-path (results page query).

---

## Historical Context (from prior changes)

- `context/changes/testing-bootstrap-auth-access/plan.md` — Phase 1 plan that established the integration test pattern, helpers, and cookbook. The `createFixtureCompletion` function was written specifically to support Phase 2 setup (fixtures were written with forward-compatibility in mind).
- `context/archive/2026-06-05-first-exercise-completion/` — Early work on the exercise completion feature itself; the schema and route were built here.

---

## Open Questions

1. **Cookie injection for HTTP-layer POST test.** The cleanest Phase 2 test would POST to the Astro dev server as an authenticated user. This requires setting the Supabase session cookie on the fetch call. The cookie name is `sb-<project-ref>-auth-token`. The cookie value is the serialised session. This is doable but requires reading from `authClient.auth.getSession()` after `createFixtureUser`. If this is too complex, the fallback is: test the DB write via `authClient` directly (bypasses the route) + separately test the route redirect target via an unauthenticated request (proves the redirect logic without cookie plumbing). Recommendation: spike the cookie approach in Phase 2 plan — it's high signal for the risk.

2. **Which exercise type to use in the write-path test?** The seeded exercise (`a0000000-0000-0000-0000-000000000001`) is an `animated_pacer` type. Using it means WPM will be computed and stored — which is the richest assertion path. No reason to use a different exercise.

3. **WPM exact assertion or range?** If we know the seeded exercise's word count, we can compute the exact expected WPM for a given `duration_seconds`. Alternatively, assert `wpm >= 50 && wpm <= 2000`. The exact assertion is stronger (kills more mutants). This should be resolved in the plan step by reading the seeded exercise's content.
