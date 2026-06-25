# Bootstrap + auth/access integration tests — Plan Brief

> Full plan: `context/changes/testing-bootstrap-auth-access/plan.md`
> Research: `context/changes/testing-bootstrap-auth-access/research.md`

## What & Why

Wire Vitest and prove, via real integration tests, that: RLS isolates exercise completions per user (Risk #1), middleware redirects unauthenticated requests (Risk #3), and server error responses never expose Supabase secrets (Risk #6). Phases 1–4 are complete (RLS test passing); Phases 5–8 add the HTTP-level tests for Risks #3 and #6.

## Starting Point

Vitest is installed and configured. Test helpers (`tests/helpers/`) and the first integration test (`tests/integration/rls-isolation.test.ts`, 2 passing tests) are in place. No `globalSetup` exists yet — there is no mechanism to spin up an Astro dev server inside `npm test`.

## Desired End State

`npm test` is fully self-contained: it starts an Astro dev server on port 4322, runs 8 tests across 3 suites, and shuts the server down. `test-plan.md §3 Phase 1` is marked `complete`. §6.3 and §6.4 are filled in with the HTTP integration test patterns.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Test runner | Vitest | TypeScript-native, no browser needed, Astro-compatible | Research |
| Test layer (Risk #1) | DB layer only (Supabase JS client) | Cheapest layer that proves the RLS policy actually fires | Research |
| Test layer (Risk #3, #6) | HTTP fetch against running Astro server | Middleware runs inside Astro's request pipeline — unreachable without an actual server | Research |
| Server startup | `globalSetup.ts` spawns `astro dev` | Self-contained `npm test` — no manual pre-step | Plan |
| Test server port | 4322 | Avoids collision with a normally-running dev server on 4321 | Plan |
| Risk #6 error triggers | 401 (session-check) + 404 (DB-query) | Covers two distinct error branches; 401 needs no Supabase | Research + Plan |
| Secret assertion technique | `expect(body).not.toContain(process.env.SUPABASE_TEST_ANON_KEY)` | Reads actual key at test time; catches any response serialization that includes it | Research |
| No mocks | Hard rule | Mocking middleware or the Supabase client defeats the purpose of both tests | Research |

## Scope

**In scope:**
- `tests/globalSetup.ts` — spawn/teardown Astro dev on port 4322
- `vitest.config.ts` — wire `globalSetup`
- `tests/integration/middleware-redirect.test.ts` — 4 tests (3 protected routes redirect, 1 auth page returns 200)
- `tests/integration/secret-leak.test.ts` — 2 tests (401 body + 404 body checked for secrets)
- `test-plan.md` §6.3, §6.4 cookbook entries + §3 Phase 1 status → `complete`

**Out of scope:**
- Risk #2, #4, #5 — separate phases
- E2e browser tests
- CI wiring — Phase 4 of the test plan (separate change)

## Architecture / Approach

A single `globalSetup.ts` manages the Astro dev server for the entire test run. The RLS test talks to Supabase directly (no server needed). The two new test files use plain `fetch()` — no Supabase client or fixture users required. Middleware redirect uses `{ redirect: "manual" }` to inspect the raw 302. Secret-leak reads the actual key from `process.env` and asserts its absence from response bodies.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1–4 (complete) | Vitest wired; helpers; RLS isolation test; §6.2 cookbook | — |
| 5. Astro dev server globalSetup | `npm test` self-contained; Astro on port 4322 | Wrangler dev startup time; must not leave zombie processes |
| 6. Middleware redirect test | 4 assertions: 3 redirects + 1 no-loop | Depends on Phase 5 server being up |
| 7. Secret-leak test | 2 assertions: 401 body + 404 body contain no secret strings | 404 path needs Supabase running |
| 8. Cookbook + status update | §6.3, §6.4 filled in; Phase 1 marked complete | — |

**Prerequisites:** Docker running, `npx supabase start` succeeds, `.dev.vars` present with valid `SUPABASE_URL`/`SUPABASE_KEY` for the Astro server to boot  
**Estimated effort:** ~1 session across Phases 5–8

## Open Risks & Assumptions

- Astro dev (Cloudflare workerd) may take 10–15s to start; globalSetup poll timeout must be ≥30s
- The 404 trigger for secret-leak assumes Supabase is running; error message should clearly state the dependency if it isn't

## Success Criteria (Summary)

- `npm test` runs 8 tests green with no manual steps beyond `npx supabase start`
- Emptying `PROTECTED_ROUTES` causes middleware tests to turn red; restoring makes them green
- Injecting the anon key into a 401 response body causes the secret-leak test to turn red; reverting makes it green
