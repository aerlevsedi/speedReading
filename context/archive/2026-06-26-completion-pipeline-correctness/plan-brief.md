# Completion Pipeline Correctness — Plan Brief

> Full plan: `context/changes/completion-pipeline-correctness/plan.md`
> Research: `context/changes/completion-pipeline-correctness/research.md`

## What & Why

Write an integration test that proves Risk #2 (silent completion write failure) cannot hide behind a successful-looking redirect. The core problem: `POST /api/exercises/complete` redirects on both success and failure — the only way to distinguish the two is to query the database directly.

## Starting Point

Phase 1 test infrastructure is fully in place: Vitest wired, `adminClient`/`authClient`/`createFixtureUser`/`deleteFixtureUsers` helpers exist, globalSetup spawns the Astro dev server on port 4322. Three integration tests already pass (RLS isolation, middleware redirect, secret-leak).

## Desired End State

`tests/integration/completion-pipeline.test.ts` exists with three passing tests. `npm test` is green. `test-plan.md §3` Phase 2 status is `complete` and `§6.5` cookbook is filled in with the cookie-injection pattern.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Test mechanism | HTTP POST with session cookie injection | Direct Supabase insert bypasses the route — the route's null-check, WPM computation, and redirect logic would never be exercised | Plan |
| WPM assertion precision | Exact expected value (262 WPM) | Range assertions survive mutants that corrupt the formula; exact assertion (262 words / 60s = 262 wpm) kills them | Plan |
| Error branch coverage | FK-violation test included | Proves the failure path redirects to `/dashboard?error=`, not silently to `/results/` | Plan |
| Read-back assertion | Via `authClient(jwt)` after successful write | Proves the SELECT RLS policy allows the inserting user to read their own completion | Plan |
| Cookie injection method | POST to `/api/auth/signin`, collect `Set-Cookie` headers | Middleware reads only cookies (not Authorization header); replaying real Set-Cookie is browser-accurate and cookie-name-agnostic | Research |

## Scope

**In scope:**
- `tests/integration/completion-pipeline.test.ts` (new file, 3 tests)
- `context/foundation/test-plan.md` §6.5 cookbook entry + §3 Phase 2 status update

**Out of scope:**
- Results page rendering / cold-start (Phase 3)
- Dataset alternation (Phase 3)
- CI gate wiring (Phase 4)
- Any changes to production code

## Architecture / Approach

The test signs in a fixture user via the real HTTP signin endpoint (collecting cookies), then POSTs to the completion endpoint with a real session cookie and the seeded exercise ID. Success is verified by querying `exercise_completions` via `adminClient()` (bypasses RLS for certainty) and asserting the row exists with exact WPM. The owner read-back via `authClient(jwt)` confirms the SELECT RLS policy works. The error branch sends a zero UUID as `exercise_id` to trigger an FK violation and verifies the redirect target is the dashboard error path.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Completion pipeline integration test | 3 passing tests: write path, error path, unauth path | Cookie injection complexity — `@supabase/ssr` may chunk the session across multiple cookies; `getSetCookie()` array must be collected and replayed in full |
| 2. Cookbook §6.5 + rollout sync | §6.5 filled in; §3 Phase 2 = `complete` | None — documentation-only |

**Prerequisites:** Local Supabase running (`npx supabase start`); `.env.test` with `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`, `SUPABASE_TEST_SERVICE_ROLE_KEY`; `.dev.vars` with `SUPABASE_URL` and `SUPABASE_KEY` for the Astro dev server.

**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- `@supabase/ssr` may write the session as multiple chunked cookies. The cookie-collection logic must use `response.headers.getSetCookie()` (returns all values as array) rather than `headers.get("set-cookie")` (returns only the first). If the runtime doesn't support `getSetCookie()`, fall back to collecting all `set-cookie` values manually.
- The seeded exercise content is assumed stable (word count = 262). If the migration seed is ever updated, the expected WPM assertion (262) will need updating — this is intentional; that's a meaningful regression signal.

## Success Criteria (Summary)

- `npm test` passes with all three new tests showing in output
- Running tests after deliberately dropping the SELECT RLS policy turns the read-back assertion red (proves the test exercises real policy, not a mock)
- `test-plan.md §3` Phase 2 row reads `complete`
