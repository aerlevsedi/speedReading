<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Recommendation System

- **Plan**: context/changes/recommendation-system/plan.md
- **Scope**: All Phases (Phase 1 + Phase 2)
- **Date**: 2026-09-07
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — `.in()` filter on joined relation may be silently ignored

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/recommendationService.ts:12
- **Detail**: `.in("exercises.exercise_type", VISIBLE_EXERCISE_TYPES)` is a PostgREST embedded resource filter. Supabase JS client may silently ignore this filter depending on version, causing the query to return all exercise_completions unfiltered. This doesn't leak other users' data (RLS scopes by user_id), but corrupts the recommendation — all types get inflated counts and the badge always falls to alphabetically first. `progressService.ts` uses `.eq("exercises.exercise_type", ...)` as the battle-tested pattern.
- **Fix A ⭐ Recommended**: Replace `.in()` with a direct filter or verify the embedded filter works with an integration test
  - Strength: Consistent with `progressService.ts` pattern; eliminates the risk of silently wrong recommendations.
  - Tradeoff: Slightly more verbose query or adds a test.
  - Confidence: HIGH — `progressService.ts` already uses the safe form.
  - Blind spot: The `.in()` may actually work — we haven't verified the exact Supabase JS version behaviour.
- **Fix B**: Add an integration test that verifies the filter works correctly
  - Strength: Confirms actual runtime behaviour without changing working code.
  - Tradeoff: Test infra overhead; doesn't eliminate the risk if the filter is broken.
  - Confidence: MEDIUM — depends on test setup availability.
  - Blind spot: Test may not run in CI with local Supabase.
- **Decision**: FIXED via Fix A — usunięto `.in()`, filtrowanie odbywa się w JS przez `counts.has(type)`

### F2 — Duplicate exercise type lists — drift risk

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: src/lib/services/recommendationService.ts:3 and src/pages/dashboard.astro:51
- **Detail**: `VISIBLE_EXERCISE_TYPES` in `recommendationService.ts` and `exerciseTypes` in `dashboard.astro` are two independent declarations of the same list. If a developer adds a type to one and not the other, the recommendation badge could appear on an exercise not shown on the dashboard (or an exercise is shown but never recommended). No compile-time check prevents this drift.
- **Fix**: Export `VISIBLE_EXERCISE_TYPES` from `recommendationService.ts` and import it in `dashboard.astro` to replace the local `exerciseTypes` constant.
  - Strength: Single source of truth; compile error if the import breaks.
  - Tradeoff: Minor coupling between service and page — acceptable since they're already semantically coupled.
  - Confidence: HIGH — straightforward change.
  - Blind spot: None significant.
- **Decision**: FIXED — VISIBLE_EXERCISE_TYPES wyeksportowany z recommendationService.ts, dashboard.astro importuje zamiast lokalnej deklaracji

### F3 — Unsafe cast hides potential array shape for joined relation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/recommendationService.ts:20
- **Detail**: `result.data` is cast as `{ exercises: { exercise_type: string } }[]`. PostgREST may return the joined relation as `exercises: [{ exercise_type: string }]` (array). If so, `row.exercises.exercise_type` is `undefined` at runtime — all counts stay at 0 and recommendation always falls back to `"animated_pacer"` silently.
- **Fix**: Add a runtime shape guard or use Supabase generated types. At minimum: `const type = Array.isArray(row.exercises) ? row.exercises[0]?.exercise_type : row.exercises?.exercise_type`.
- **Decision**: FIXED — dodano runtime shape guard obsługujący zarówno object jak i array shape

### F4 — `getRecommendedExerciseType` call not covered by try/catch in dashboard.astro

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/dashboard.astro:47
- **Detail**: Every other service call in this file is wrapped in try/catch or checks `.error`. `getRecommendedExerciseType` at line 47 is called bare — if the service throws an uncaught exception, the whole page render crashes instead of degrading gracefully.
- **Fix**: Wrap line 47 in the existing try/catch block alongside the exercise fetches.
- **Decision**: FIXED — przeniesiono do try/catch, wywołanie równoległe z exercise fetches przez Promise.all

### F5 — DB errors silently swallowed in recommendationService

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/recommendationService.ts:16
- **Detail**: On `result.error`, the function returns `"animated_pacer"` without logging. `progressService.ts` and `dashboard.astro` both call `console.error(...)` before returning safe defaults. Silent failures make DB incidents harder to diagnose.
- **Fix**: Add `console.error("getRecommendedExerciseType error:", result.error)` before the early return.
- **Decision**: FIXED — dodano console.error przed early return

### F6 — `typeBadgeColor`/`typeLabel` lookups can yield `undefined` used in className

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/dashboard/ExerciseCard.tsx:13-25
- **Detail**: `typeBadgeColor` and `typeLabel` are object lookups that return `string | undefined`. Used directly in JSX without fallback — if `exercise_type` is unexpected, className gets the literal string `"undefined"`. This is a pre-existing issue, not introduced by this change.
- **Fix**: Add fallbacks: `?? "bg-gray-500/20 text-gray-300"` and `?? exercise.exercise_type`.
- **Decision**: FIXED — dodano fallbacki `?? "bg-gray-500/20 text-gray-300"` i `?? exercise.exercise_type`

### F7 — Missing JSDoc and `VISIBLE_EXERCISE_TYPES` invariant undocumented

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/recommendationService.ts:3,7
- **Detail**: Other services (`progressService.ts`, `exerciseService.ts`) have JSDoc comments on exported functions. `getRecommendedExerciseType` has none. `VISIBLE_EXERCISE_TYPES` has no comment noting it must stay in sync with `dashboard.astro`.
- **Fix**: Add a brief JSDoc to the function and a comment on `VISIBLE_EXERCISE_TYPES`.
- **Decision**: FIXED — dodano JSDoc z opisem algorytmu, fallbacku i RLS note

### F8 — `isNavigating` state not reset on browser back-navigation

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/dashboard/ExerciseCard.tsx:58-77
- **Detail**: Pre-existing issue: the `isNavigating` spinner state is set on click but never reset. If the user navigates back while the button shows the spinner, the button stays disabled permanently until remount.
- **Fix**: Add `useEffect(() => () => setIsNavigating(false), [])` cleanup, or reset on popstate.
- **Decision**: FIXED — dodano useEffect cleanup resetujący isNavigating przy unmount
