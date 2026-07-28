<!-- PLAN-REVIEW-REPORT -->
# Plan Review: All Exercise Types Implementation Plan

- **Plan**: context/changes/all-exercise-types/plan.md
- **Mode**: Deep
- **Date**: 2026-06-07
- **Verdict**: SOUND (after fixes)
- **Findings**: 1 critical, 4 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding
5/5 paths ✓, 3/3 symbols ✓, brief↔plan ✓

## Findings

### F1 — AnimatedPacer signature mismatch breaks integration

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 6 — ExerciseFlow Type Routing
- **Detail**: Plan assumes all exercise components call `onComplete(duration, errors)` but AnimatedPacer.tsx:32 currently calls `onComplete(durationSeconds)` with only 1 argument. The quiz errors come from ComprehensionQuiz afterward (line 18-19 of ExerciseFlow). Plan proposes making each component "self-contained" but doesn't specify updating AnimatedPacer to calculate its own errors or changing its signature.
- **Fix A ⭐ Recommended**: Update AnimatedPacer to include quiz internally
  - Strength: Makes it self-contained as stated in plan; quiz is part of the "Animated Pacer" exercise per archived plan context/archive/.../first-exercise-completion/plan.md.
  - Tradeoff: AnimatedPacer becomes larger; quiz logic duplicated if other exercise types also need comprehension checks.
  - Confidence: HIGH — this matches the "self-contained" architecture the plan describes. ComprehensionQuiz can be reused internally by importing it into AnimatedPacer.
  - Blind spot: Current hard-coded 2 questions in ExerciseFlow.tsx:16-32 need to be moved into AnimatedPacer component.
- **Fix B**: Change all components to pass `errors` even if 0
  - Strength: Minimal changes; AnimatedPacer just passes `errors: 0`.
  - Tradeoff: Contradicts "self-contained" claim — AnimatedPacer doesn't actually calculate errors, just hardcodes 0.
  - Confidence: HIGH — works but architecturally dishonest.
  - Blind spot: Doesn't address what happens to ComprehensionQuiz.tsx.
- **Decision**: FIXED (Fix A applied)

### F2 — Server-to-server HTTP fetch anti-pattern

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Architectural Fitness
- **Location**: Phase 6 — Dashboard Query Logic
- **Detail**: Plan proposes dashboard.astro (server-side) calls its own API via HTTP fetch (lines 467-473). Current pattern uses Supabase client directly (dashboard.astro:16). Astro SSR context has full database access — HTTP round-trip adds latency, serialization overhead, and an unnecessary network hop (localhost:4321 → localhost:4321).
- **Fix A ⭐ Recommended**: Extract dataset selection to shared function
  - Strength: Clean separation — business logic in src/lib/services/, reusable by both dashboard.astro and the API endpoint. Matches the "service layer extraction" pattern mentioned in "What We're NOT Doing" but this is a targeted helper, not a full service layer. Zero HTTP overhead.
  - Tradeoff: Adds one new file (e.g., src/lib/services/exerciseService.ts).
  - Confidence: HIGH — this is the standard pattern for shared SSR/API logic.
  - Blind spot: None significant.
- **Fix B**: Keep HTTP fetch as proposed
  - Strength: API endpoint becomes the single source of truth.
  - Tradeoff: 4 HTTP round-trips on every dashboard load (even though the server has direct DB access). Harder to test (need running server). More failure modes (API down, network).
  - Confidence: HIGH — works but architecturally wasteful.
  - Blind spot: Error handling gets complex — what if 1 of 4 fetches fails?
- **Decision**: FIXED (Fix A applied)

### F3 — Manual navigation bypasses dataset alternation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Dataset Selection API
- **Detail**: Plan's dataset alternation works only when users click dashboard cards (which call /api/exercises/next-for-type). Users can bookmark /exercise/<id> or navigate directly (browser back button, URL bar). The /exercise/[id].astro page (lines 21-27) fetches exercise by ID, not by type — no dataset selection logic. User can repeat dataset_1 indefinitely by refreshing /exercise/<dataset_1_id>.
- **Fix**: Document as accepted limitation for MVP
  - Strength: Zero implementation work. Manual navigation is an edge case — most users follow dashboard → exercise flow. Dataset alternation still works for primary flow.
  - Tradeoff: Power users can game the system (repeat easy datasets).
  - Confidence: HIGH — this is a scope decision, not a technical flaw.
  - Blind spot: If this matters post-MVP, fix by redirecting /exercise/<id> to dashboard with error "Please select exercise from dashboard" or adding dataset selection to the /exercise/[id] page itself.
- **Decision**: FIXED (documented in "What We're NOT Doing")

### F4 — Missing database index for dataset selection query

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Dataset Selection API
- **Detail**: Plan's dataset selection query (line 185) joins exercise_completions to exercises and filters by exercise_type. The existing index (idx_exercise_completions_user_date) covers (user_id, completed_at) but NOT the JOIN to exercises.exercise_type. The query will scan all of a user's completions to filter by type.
- **Fix**: Accept as-is — existing index is sufficient for MVP scale
  - Strength: The query is LIMIT 1 and most users have <100 completions. Seq scan on small result sets is fast. Index exists for the expensive part (user_id + ORDER BY completed_at DESC).
  - Tradeoff: None for MVP. If users have 1000+ completions, add a composite index later: (user_id, exercise_type, completed_at).
  - Confidence: HIGH — Performance Considerations section (line 585) already notes "query is scoped to one exercise type and LIMIT 1, so performance is constant-time" which is approximately true given existing index + small data.
  - Blind spot: None significant.
- **Decision**: ACCEPTED

### F5 — Orphaned ComprehensionQuiz.tsx after refactor

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 6 — ExerciseFlow Type Routing
- **Detail**: Plan says "Remove ComprehensionQuiz import" (line 512) from ExerciseFlow but doesn't specify what happens to the component. Currently only ExerciseFlow imports it. After removal, it becomes orphaned code (dead file in the repo).
- **Fix**: Clarify intent — delete or repurpose ComprehensionQuiz.tsx
  - Strength: If deleted: clean up. If repurposed (e.g., imported by AnimatedPacer and SmartQuestions for reuse): document this in Phase 6. Current plan is ambiguous.
  - Tradeoff: None — just a clarity edit to the plan.
  - Confidence: HIGH — this is a documentation gap, not a logic flaw.
  - Blind spot: None.
- **Decision**: FIXED (clarified in F1 fix — AnimatedPacer and SmartQuestions import ComprehensionQuiz internally)
