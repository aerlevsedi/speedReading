<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Bootstrap + auth/access integration tests

- **Plan**: context/changes/testing-bootstrap-auth-access/plan.md
- **Scope**: All phases (1–8)
- **Date**: 2026-06-25
- **Verdict**: NEEDS ATTENTION (all findings resolved during triage)
- **Findings**: 1 critical  4 warnings  4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — No auth guard on /api/exercises/[id]

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/exercises/[id].ts:5–26
- **Detail**: Endpoint has no authentication check. Exercises are publicly readable by design (RLS USING true, research doc confirms). The absence is intentional but was undocumented in code.
- **Fix Applied**: Fix A — added code comment documenting that exercise content is publicly readable by design, pointing to the RLS policy and the condition for when both must change together.
- **Decision**: FIXED (Fix A)

### F2 — Vacuous assertion when SUPABASE_TEST_ANON_KEY is unset

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/secret-leak.test.ts:11–12, 27–28
- **Detail**: `?? ""` fallback makes `expect(body).not.toContain("")` always pass when env var is unset — silently vacuous. Developer running without .env.test gets no warning.
- **Fix Applied**: Replaced `?? ""` with module-level const + early throw if env var is missing. Both `anonKey` and `supabaseUrl` now throw `Error` with clear message if unset.
- **Decision**: FIXED

### F3 — secret-leak second test allows [404, 200] but not 500

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/secret-leak.test.ts:23–24
- **Detail**: `expect([404, 200]).toContain(response.status)` excludes 500 which the route can return on server misconfiguration. Confusing failure message.
- **Fix Applied**: Changed to `expect(response.status, "Expected 404 ... if 500, check .dev.vars").toBe(404)`.
- **Decision**: FIXED

### F4 — globalSetup spawn error is swallowed; setup hangs 60 seconds

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: tests/globalSetup.ts:34–36
- **Detail**: `throw` inside an EventEmitter `error` handler doesn't propagate to the async `setup()`. Setup hangs until the 60-second timeout with a generic error.
- **Fix Applied**: Added module-level `spawnError: Error | null = null`; error handler stores to it; `waitForServer` poll loop checks `if (spawnError) throw spawnError` on each iteration.
- **Decision**: FIXED

### F5 — double resolve() in teardown

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/globalSetup.ts:47–59
- **Detail**: `resolve()` called unconditionally in both `close` handler and `setTimeout` — timer not cleared on normal shutdown.
- **Fix Applied**: Reordered: `proc.kill("SIGTERM")` first, then `const t = setTimeout(...)`, then `proc.on("close", () => { clearTimeout(t); resolve(); })`.
- **Decision**: FIXED

## Observations (no action taken)

### O1 — globalSetup starts dev server for all suites including RLS
- **Location**: tests/globalSetup.ts:11
- **Note**: Intentional trade-off. If suite grows, consider vitest `project` configs.

### O2 — Stack-trace assertion oracle not traceable to requirement
- **Location**: tests/integration/secret-leak.test.ts:17–18
- **Note**: Correct assertion; a comment referencing PRD §Privacy would help future maintainers.

### O3 — Redirect status 302 assumed without explicit comment
- **Location**: tests/integration/middleware-redirect.test.ts:11
- **Note**: Astro `context.redirect()` defaults to 302 — confirmed correct.

### O4 — fixtures.ts deleteFixtureUsers swallows deletion failures with console.warn
- **Location**: tests/helpers/fixtures.ts:84–93
- **Note**: Intentional — teardown should not mask original test failures. Acceptable for local Docker.

## Plan Adherence Notes

Drifts that are improvements or neutral adaptations (no action needed):
- vitest.config.ts uses `loadEnv(mode, cwd, "")` — loads .env.test in practice via vitest's `--mode test` convention
- globalSetup.ts spawns `npx astro dev` directly vs planned `npm run dev -- --port 4322` — functionally equivalent
- globalSetup.ts TIMEOUT_MS = 60s vs planned ~30s — more robust for slow CI
- TEST_SERVER_URL uses `localhost` vs planned `127.0.0.1` — minor
- secret-leak.test.ts second endpoint accepts [404, 200] vs planned 401 — correct, route has no auth gate by design (now asserts 404 explicitly after F3 fix)
- rls-isolation.test.ts adds "User A can read own row" it — positive addition
- supabase.ts adds `anonClient()` — used internally by fixtures.ts
