<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: All Exercise Types

- **Plan**: context/changes/all-exercise-types/plan.md
- **Scope**: All phases (1-6)
- **Date**: 2026-06-08
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical | 5 warnings | 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — useExerciseTimer pause doesn't stop duration tracking

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/lib/hooks/useExerciseTimer.ts:22-27
- **Detail**: Plan specified pause/resume with cumulative duration tracking, but implementation's pause() method only sets isRunning flag without stopping time accumulation. getDuration() always calculates from original startTimeRef to Date.now(), so pausing for 5 minutes still counts those 5 minutes in final duration.
- **Fix A ⭐ Recommended**: Document that pause() is cosmetic only
  - Strength: Matches actual usage - no exercise component uses pause functionality. Prevents confusion about hook's contract.
  - Tradeoff: Misleading API remains in code; future developers might expect it to work.
  - Confidence: HIGH — grep shows pause() is never called in any exercise.
  - Blind spot: None significant.
- **Fix B**: Implement proper pause with accumulated duration tracking
  - Strength: Fulfills original plan contract; enables future pause feature if needed.
  - Tradeoff: Adds complexity for unused feature; requires tracking pausedDuration and subtracting from getDuration().
  - Confidence: MEDIUM — straightforward implementation but adds code for zero current value.
  - Blind spot: Unclear if pause/resume will ever be a real feature.
- **Decision**: FIXED (via Fix A - documented cosmetic pause behavior)

### F2 — Missing dataset validation in question lookups

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/exercise/FocusSprint.tsx:83, SpeedScan.tsx:74
- **Detail**: Both components look up questions by dataset_id with fallback to dataset_1, but don't validate the dataset exists in the map. If someone creates exercise with dataset_id='dataset_3', it silently uses dataset_1 questions (wrong content).
- **Fix A ⭐ Recommended**: Add runtime validation with explicit error
  - Strength: Fails fast with clear error message instead of silently using wrong questions. Easy to debug in development.
  - Tradeoff: Throws error for unexpected dataset instead of graceful fallback; could crash user session.
  - Confidence: HIGH — fail-fast is better for data integrity issues.
  - Blind spot: None significant - only 2 datasets exist per migration.
- **Fix B**: Log warning but continue with fallback
  - Strength: Graceful degradation - user can still complete exercise even with wrong questions.
  - Tradeoff: Silent data corruption - user answers wrong questions, results are meaningless but recorded.
  - Confidence: LOW — silent failures are harder to detect and debug.
  - Blind spot: How often would this happen in production?
- **Decision**: FIXED (via Fix A - added validation with explicit error in both components)

### F3 — Dashboard crashes on service function errors

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard.astro:24-28
- **Detail**: Dashboard calls getNextExerciseForType for 3 types with Promise.all but no try/catch. If any query throws (network error, DB failure), entire page crashes instead of showing error banner. Service function returns null for "not found" but could throw for DB errors.
- **Fix**: Wrap Promise.all in try/catch with error redirect
  - Strength: Graceful degradation - user sees error message instead of blank crash page. Matches existing error patterns in other Astro pages.
  - Tradeoff: Entire dashboard fails if one query fails, even though other 2 types might load successfully.
  - Confidence: HIGH — error handling pattern used consistently across auth pages and results page.
  - Blind spot: Could show partial dashboard (working types only) but adds UI complexity for rare edge case.
- **Decision**: FIXED (wrapped Promise.all in try/catch with error redirect)

### F4 — Type assertion could crash on unexpected query structure

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/exerciseService.ts:29
- **Detail**: Uses type assertion to extract dataset_id from nested join: `(historyResult.data.exercises as unknown as { dataset_id }).dataset_id`. Assumes exercises!inner join worked correctly. If Supabase returns unexpected structure, crashes with "Cannot read property dataset_id of undefined" instead of graceful fallback.
- **Fix**: Add null check before accessing nested property
  - Strength: Prevents crash, falls back to dataset_1 (cold-start behavior) which is safe default.
  - Tradeoff: Silently ignores query structure mismatches instead of alerting developer to problem.
  - Confidence: HIGH — `?.dataset_id ?? 'dataset_1'` is one-line change.
  - Blind spot: None significant.
- **Decision**: FIXED (added optional chaining and nullish coalescing)

### F5 — Missing prerender directive in API route

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/exercises/next-for-type.ts
- **Detail**: Missing `export const prerender = false;` directive. CLAUDE.md specifies "API routes must export const prerender = false." All 3 existing API routes have it. Not a functional bug since SSR is default, but violates project convention.
- **Fix**: Add prerender directive after imports
  - Strength: Matches established pattern in /api/exercises/[id].ts and /api/exercises/complete.ts. Makes SSR explicit.
  - Tradeoff: None - purely additive.
  - Confidence: HIGH — copy existing pattern from sibling files.
  - Blind spot: None significant.
- **Decision**: SKIPPED (prerender directive already present - false positive)

### F6 — SmartQuestions component exists but is unreachable

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/exercise/SmartQuestions.tsx
- **Detail**: Component is fully implemented but dashboard filters it out (only fetches 3 types). Database has smart_questions seeds (IDs 011, 012) but they're never surfaced. This is intentional per plan "Design Decisions" section - Smart Questions was removed mid-implementation for being incomplete/redundant.
- **Fix**: Document or delete for clarity
  - Strength: Removes dead code confusion. Plan already documents the decision but code cleanup prevents future questions.
  - Tradeoff: Loses implemented work; requires migration comment to explain unused DB rows.
  - Confidence: MEDIUM — purely cleanup, no functional impact.
  - Blind spot: Might want to resurrect Smart Questions later as standalone quiz feature.
- **Decision**: SKIPPED (intentional - documented dead code for potential future use)

### F7 — Focus Sprint missing countdown/pressure from plan

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/exercise/FocusSprint.tsx
- **Detail**: Plan Phase 4 specified countdown timer with visual pressure cues (red background, pulsing timer, progress bar). Implementation has none of that - it's "read at own pace + quiz" with no time pressure. This was intentional redesign documented in plan lines 101-102.
- **Note**: Intentional design change documented in plan. No fix needed - this is recorded for transparency about drift from original spec.
- **Decision**: SKIPPED (intentional design change - already documented in plan)

### F8 — Results page hard-codes question counts

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/results/[id].astro:42-49
- **Detail**: Results page has hard-coded questionCountByType map. If component question counts change, must remember to update this map or results show wrong "X/Y correct". Source of truth is component code, but results page duplicates it.
- **Fix**: Move question arrays to shared constants file
  - Strength: Single source of truth; components and results import same data.
  - Tradeoff: Adds indirection; components become less self-contained.
  - Confidence: MEDIUM — pattern works but costs simplicity.
  - Blind spot: Question counts are unlikely to change frequently.
- **Decision**: SKIPPED (acceptable for MVP - pattern works in React 19)

### F9 — ExerciseFlow auto-submit fragile to React changes

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/exercise/ExerciseFlow.tsx:44
- **Detail**: Uses ref callback `ref={(el) => el?.click()}` to auto-submit form. Works but assumes button renders and ref fires before form unmounts. If React batching changes, could race. No error handling if POST fails - user sees blank screen.
- **Fix**: Replace with useEffect + formRef pattern
  - Strength: More robust to React version changes; ensures form is mounted before submit().
  - Tradeoff: Slightly more verbose (3 lines vs 1).
  - Confidence: HIGH — useEffect pattern is React best practice.
  - Blind spot: Current pattern works fine in React 19; only matters for future upgrades.
- **Decision**: PENDING

### F10 — Dashboard shows 3 types instead of planned 4

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/pages/dashboard.astro:23
- **Detail**: Dashboard fetches only 3 exercise types (animated_pacer, focus_sprint, speed_scan) instead of the originally planned 4. Smart Questions is excluded. This is intentional per design decision to remove Smart Questions (documented in plan lines 79-101).
- **Note**: Intentional design change documented in plan. Comment on line 22 explains removal. No fix needed - recorded for transparency.
- **Decision**: PENDING
