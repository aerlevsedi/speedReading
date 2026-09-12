<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Intro and Instructions

- **Plan**: context/changes/intro-and-instructions/plan.md
- **Scope**: All Phases (1, 2, 3 of 3)
- **Date**: 2026-09-12
- **Verdict**: NEEDS ATTENTION
- **Findings**: 1 critical, 2 warnings, 3 observations

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

### F1 — `smart_questions` exercise type crashes React tree

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/exercise/ExerciseFlow.tsx:68 + src/components/exercise/ExerciseIntroModal.tsx:51
- **Detail**: `Exercise.exercise_type` includes `"smart_questions"` but `ExerciseIntroModal` only accepts `"animated_pacer" | "focus_sprint" | "speed_scan"`. Line 68 of `ExerciseFlow` uses an `as` cast to suppress the TypeScript error. When a `smart_questions` exercise is opened, `INTRO_CONTENT["smart_questions"]` returns `undefined`, and the subsequent access to `.title`, `.purpose`, etc. throws `TypeError: Cannot read properties of undefined`, crashing the React tree. The plan explicitly excluded `smart_questions` intros but did not specify a runtime guard.
- **Fix A ⭐ Recommended**: Add a guard in `ExerciseIntroModal` — `if (!content) return null;` after line 51 — and gate the modal from opening in `ExerciseFlow` when the exercise type is not in the supported set (replace the `as` cast with a real check). This handles the runtime crash safely without adding `smart_questions` content.
  - Strength: No content needed; handles the deprecated type gracefully. Removes the dangerous `as` cast.
  - Tradeoff: Two-file edit, minimal scope.
  - Confidence: HIGH — the plan explicitly says `smart_questions` gets no intro; a null-guard is the right implementation of that decision.
  - Blind spot: Need to confirm `smart_questions` exercises are still reachable (plan says deprecated/not on dashboard, but they may still be accessible by URL).
- **Fix B**: Add `smart_questions` entry to `INTRO_CONTENT` and expand the prop type union.
  - Strength: Eliminates the gap entirely rather than guarding around it.
  - Tradeoff: Requires authoring content for a deprecated exercise type; perpetuates a feature the plan explicitly excluded.
  - Confidence: LOW — contradicts plan decision.
  - Blind spot: None.
- **Decision**: FIXED via Fix A — guard in ExerciseIntroModal + supportsIntro gate in ExerciseFlow; as cast scoped to IntroSupportedType

### F2 — Fire-and-forget API call has no error handling

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/exercise/ExerciseFlow.tsx:45
- **Detail**: `void fetch("/api/intros/mark-seen", ...)` has no `.catch()`. If the request fails (network error, 401, 500), `markedAsSeen` is already set to `true` in local state so the modal won't re-open this session — but the DB row was never written. On next page load, the SSR query finds no row and shows the modal again, silently undoing the user's "don't show again" preference with no diagnostic signal.
- **Fix**: Add `.catch((err) => console.error("[mark-seen]", err))` to the fetch call, and consider rolling back `markedAsSeen` to `false` on error so the preference can be retried next visit.
- **Decision**: FIXED — added .catch with console.error + setMarkedAsSeen(false) rollback on error

### F3 — `?` button positioned inline rather than absolute top-right overlay

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/exercise/ExerciseFlow.tsx:78-87
- **Detail**: Plan specified `className="absolute top-3 right-3 z-10 h-7 w-7 text-sm"` with a parent `className="relative"` wrapper. Actual implementation places the button inline in an `inline-flex items-center gap-2` row beside the exercise title — no `absolute`, no `z-10`, `h-6 w-6` and `text-xs` instead of `h-7 w-7` and `text-sm`. Functional behavior (re-opens modal) is correct; only the visual placement deviates from the plan.
- **Fix**: Either (a) update the button to match the plan spec (`absolute top-3 right-3 z-10`) with a parent `relative` wrapper, or (b) accept the inline placement as a deliberate UX improvement and update the plan. No code defect — purely a visual deviation from spec.
- **Decision**: FIXED — button moved to absolute top-3 right-3 z-10 overlay, parent div gets relative, title row simplified

### F4 — Unbounded `user_intro_views` query has no `.limit()`

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/exercise/[id].astro:35
- **Detail**: `supabase.from("user_intro_views").select("exercise_type").eq("user_id", user.id)` has no `.limit()`. In practice bounded by the number of distinct exercise types (~4), but violates safe query hygiene. No `.limit()` is consistent with the canonical `user_goals` pattern in this codebase, so this is a shared gap rather than a new deviation.
- **Fix**: Add `.limit(20)` as a defensive ceiling, or add a brief inline comment acknowledging the implicit bound.
- **Decision**: FIXED — added .limit(20)

### F5 — API accepts arbitrary strings for `exercise_type` (no allowlist)

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/intros/mark-seen.ts:15
- **Detail**: `exerciseType` is taken directly from FormData with only a null/empty check. Parameterized query prevents SQL injection, but an authenticated user can write arbitrary strings to the `exercise_type` column (e.g., very long strings, garbage values). The canonical `goals/set.ts` validates its input numerically. The DB has no constraint on the `exercise_type` value beyond `NOT NULL`.
- **Fix**: Add an allowlist check before the upsert: `const VALID_TYPES = ["animated_pacer", "smart_questions", "focus_sprint", "speed_scan"]; if (!VALID_TYPES.includes(exerciseType)) return 400`.
- **Decision**: FIXED — added VALID_TYPES allowlist check returning 400 on unknown values

### F6 — RLS UPDATE policy missing `WITH CHECK`

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260910000000_create_user_intro_views.sql
- **Detail**: `CREATE POLICY "Users can update own intro views" ON public.user_intro_views FOR UPDATE USING (auth.uid() = user_id)` lacks a `WITH CHECK` clause. Without `WITH CHECK`, a user could update their row and change `user_id` to another user's UUID — the `USING` clause only filters which rows are visible for update, not the post-update state. The canonical `user_goals` migration has the same gap, so this is a shared pattern issue, not unique to this change.
- **Fix**: Add `WITH CHECK (auth.uid() = user_id)` to the UPDATE policy.
- **Decision**: FIXED — new migration 20260912000000_fix_user_intro_views_rls_update.sql adds WITH CHECK
