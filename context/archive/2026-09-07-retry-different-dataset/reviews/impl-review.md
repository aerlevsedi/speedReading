<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Retry Different Dataset

- **Plan**: context/changes/retry-different-dataset/plan.md
- **Scope**: Full plan (Phase 1 + Phase 2 of 2)
- **Date**: 2026-09-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Unplanned vite alias added to astro.config.mjs

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: astro.config.mjs:16-21
- **Detail**: `resolve.alias: { "@": fileURLToPath(...) }` was added as an unplanned change. It was a necessary bug fix (island hydration 404 in dev mode — `@/` alias existed only in tsconfig, not in Vite's resolver) that unblocked the feature, but it's outside the plan's stated scope.
- **Fix**: Accept as-is; document the fix in the plan's Overview as a note.
- **Decision**: ACCEPTED — vite alias fix was necessary to unblock island hydration; no code change needed.

### F2 — getAlternateExercise returns null silently on DB error

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/results/[id].astro:77
- **Detail**: `getAlternateExercise` returns `null` on DB error (by design), but the caller logs nothing. The button simply doesn't appear, which is correct UX but hides DB errors. `dashboard.astro:27` logs errors from similar optional queries (`console.error(...)`).
- **Fix**: Add `if (!alternateExercise) console.error(...)` — or accept silent null as intentional given the graceful degradation is the specified behavior.
- **Decision**: FIXED — added console.error in getAlternateExercise for unexpected DB errors (skips PGRST116 "no rows" which is expected).

### F3 — Pre-existing: historyResult error not checked in getNextExerciseForType

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/exerciseService.ts:15-22
- **Detail**: Pre-existing in `getNextExerciseForType` — `historyResult` error is not checked before accessing `.data`. A DB error silently falls through to cold-start default. This predates this change and is not introduced by it. Noted for completeness.
- **Fix**: Out of scope for this review. Tracked for a separate fix.
- **Decision**: FIXED — added console.error before the data access guard in getNextExerciseForType.
