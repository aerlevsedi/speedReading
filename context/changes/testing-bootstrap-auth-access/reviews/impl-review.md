<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Bootstrap + auth/access integration tests

- **Plan**: context/changes/testing-bootstrap-auth-access/plan.md
- **Scope**: All phases (1–4)
- **Date**: 2026-06-13
- **Verdict**: NEEDS ATTENTION
- **Findings**: 1 critical · 3 warnings · 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Fixture user leak on partial beforeAll failure

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: tests/integration/rls-isolation.test.ts:13-23
- **Detail**: If createFixtureUser(User A) succeeds but createFixtureUser(User B) throws, userAId is assigned but afterAll may not clean User A up correctly. If createFixtureCompletion throws after both users exist, userACompletionId is never set and tests produce misleading assertion failures.
- **Fix**: Wrap beforeAll body in try/catch that calls deleteFixtureUsers on all IDs collected so far before re-throwing.
  - Strength: Guarantees cleanup regardless of which step fails; cheap to add.
  - Tradeoff: 3-4 extra lines in beforeAll.
  - Confidence: HIGH — standard pattern for multi-step fixture setup.
  - Blind spot: None significant.
- **Decision**: FIXED

### F2 — result.error not checked before asserting on data

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/rls-isolation.test.ts:33, 42
- **Detail**: Both tests assert on result.data without checking result.error first. Violates Lesson 2 (result variable pattern). The User B test conflates "RLS silently filtered" with "query errored" — both return data: null.
- **Fix**: Add `expect(result.error).toBeNull()` before each data assertion.
- **Decision**: FIXED

### F3 — Empty-string JWT passed to authClient for sign-in step

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/helpers/fixtures.ts:21
- **Detail**: createFixtureUser calls authClient("") injecting "Authorization: Bearer " header on the sign-in request. The endpoint ignores it today but the pattern is misleading and fragile.
- **Fix**: Use a plain createClient call without Authorization header for the sign-in step, or expose anonClient() in supabase.ts.
- **Decision**: FIXED (exposed anonClient() in supabase.ts, used in fixtures.ts)

### F4 — loadEnv loads all .env files including potentially production .env

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: vitest.config.ts:10
- **Detail**: loadEnv(mode, cwd, "") loads every env file with no prefix filter. A developer with production SUPABASE_KEY in .env could silently run tests against cloud Supabase if .env.test is missing.
- **Fix A ⭐ Recommended**: Add a guard asserting SUPABASE_TEST_URL contains "127.0.0.1" or "localhost" before any test runs.
  - Strength: Catches the dangerous case at runtime; cheap; doesn't change loadEnv approach.
  - Tradeoff: Doesn't prevent env merge — just catches the outcome.
  - Confidence: HIGH — minimal safe fix.
  - Blind spot: .env secrets still in process.env during test execution.
- **Fix B**: Replace loadEnv with dotenv and explicit path: `.env.test` only.
  - Strength: Loads only .env.test.
  - Tradeoff: dotenv not installed; adds dependency; breaks Vite-idiomatic pattern.
  - Confidence: MEDIUM.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A — guard added in tests/helpers/supabase.ts)

### F5 — Serial user deletion can stall teardown

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/helpers/fixtures.ts:57
- **Detail**: deleteFixtureUsers uses a serial for...of loop. If one deletion hangs, remaining users aren't deleted.
- **Fix**: Replace for...of with Promise.allSettled(userIds.map(...)).
- **Decision**: FIXED

### F6 — Pattern divergence between test and app Supabase client (intentional)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/helpers/supabase.ts vs src/lib/supabase.ts
- **Detail**: App's createClient returns null on missing env; test's getEnv() throws eagerly. Divergence is intentional and correct.
- **Fix**: None required.
- **Decision**: SKIPPED (intentional divergence)
