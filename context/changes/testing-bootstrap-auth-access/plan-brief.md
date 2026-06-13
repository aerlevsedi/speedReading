# RLS Isolation Integration Test — Plan Brief

> Full plan: `context/changes/testing-bootstrap-auth-access/plan.md`
> Research: `context/changes/testing-bootstrap-auth-access/research.md`

## What & Why

Bootstrap Vitest and write the project's first integration test proving that exercise_completions rows are isolated per user at the database layer. This is rollout Phase 1 for Risk #1 from the quality contract: an authenticated User B must not be able to read User A's exercise completion data — even with a direct completion ID.

## Starting Point

No test runner exists. The project has `@supabase/supabase-js` v2 already in dependencies and local Supabase configured on port 54321, but zero test files, no Vitest config, and no test scripts. The RLS policy is confirmed correct in the migration SQL — it has simply never been verified by an automated test.

## Desired End State

`npm test` runs a green integration test suite. One test in `tests/integration/rls-isolation.test.ts` proves the RLS SELECT policy (`USING ((select auth.uid()) = user_id)`) is active and enforced — using two real fixture users with real JWT tokens against local Supabase Docker. `context/foundation/test-plan.md §6.2` is filled in with the cookbook pattern so future contributors know how to add access-control tests.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Test runner | Vitest | TypeScript-native, no browser runtime needed, compatible with Astro projects | Research |
| Test location | `tests/` at project root | Clean separation from application code; conventional for integration tests | Plan |
| Test layer | DB layer only (no Astro server) | Cheapest layer that proves the real failure mode — browser is irrelevant for a data isolation property | Research |
| Client in tests | Direct `@supabase/supabase-js` createClient | App's factory uses `astro:env/server` — unavailable outside Astro runtime | Research |
| Env vars | `.env.test` (gitignored, `_TEST_` prefix) | Avoids collision with app env vars; keeps cloud credentials out of test runs | Plan |
| Fixture teardown | `afterAll` (suite-level) | One Admin API round-trip per suite; sufficient for local Docker | Plan |
| No mocks | Hard rule | Mock bypasses the SQL policy entirely — test would be green even if RLS was deleted | Research |

## Scope

**In scope:**
- Vitest install + `vitest.config.ts`
- `.env.test` for local Supabase credentials
- `tests/helpers/supabase.ts` — Admin and auth client factories
- `tests/helpers/fixtures.ts` — user + completion creation/teardown
- `tests/integration/rls-isolation.test.ts` — the RLS isolation test
- `context/foundation/test-plan.md §6.2` cookbook update

**Out of scope:**
- Risk #3 (middleware redirect) and Risk #6 (secret leakage) tests — separate files, same phase
- Astro page HTTP-level test for `/results/[id]`
- Playwright or any browser automation
- Supabase TypeScript type generation
- CI wiring (test step in GitHub Actions) — Phase 4 of the rollout

## Architecture / Approach

Two separate Supabase clients are used: an Admin client (service-role key, bypasses RLS) for fixture setup and teardown, and an auth client (anon key + User B's JWT) for the actual assertion. The test calls the Supabase JS client directly — not the Astro page — so the assertion exercises the RLS policy and the DB layer with no HTTP or browser overhead.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Vitest setup | `npm test` runs, empty suite, no errors | `astro:env/server` must not be imported by Vitest |
| 2. Test helpers | Client factories + fixture factory reusable across all future integration tests | Service-role key must come from `.env.test`, never hardcoded |
| 3. RLS isolation test | One green test proving User B cannot read User A's completion | Test must actually fail when RLS policy is removed (manual flip verification) |
| 4. Cookbook update | §6.2 filled in for future contributors | — |

**Prerequisites:** Docker running, `npx supabase start` succeeds, service-role key available from `npx supabase status`  
**Estimated effort:** ~1 session across 4 phases
