<!-- PLAN-REVIEW-REPORT -->
# Plan Review: First Exercise Completion Implementation Plan

- **Plan**: context/changes/first-exercise-completion/plan.md
- **Mode**: Deep
- **Date**: 2026-06-05
- **Verdict**: SOUND (after fixes applied)
- **Findings**: 1 critical, 2 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS (after fix) |
| Blind Spots | PASS (after fix) |
| Plan Completeness | PASS (after fix) |

## Grounding
7/7 paths ✓, 3/3 symbols ✓, brief↔plan ✓

## Findings

### F1 — Client-controlled user_id in form submission

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 — ExerciseFlow component, Phase 4 — Completion API
- **Detail**: Plan passed user_id as a hidden form field (plan.md:638, 691), allowing malicious users to submit completions for other users by modifying the form data. The completion API trusted the client-provided user_id without verifying it matched the authenticated session (plan.md:719).
- **Fix A ⭐ Recommended**: Remove user_id from form, derive from session server-side
  - Strength: Eliminates security hole — server gets user_id from context.locals.user.id (already authenticated via middleware). Follows the auth pattern in SignInForm (doesn't pass user identity via form).
  - Tradeoff: Requires adding user auth check to completion API route.
  - Confidence: HIGH — middleware already resolves user; completion API has access to context.locals.user per existing pattern.
  - Blind spot: None significant.
- **Fix B**: Validate user_id matches session in completion API
  - Strength: Keeps form submission simple; validation happens server-side.
  - Tradeoff: Still passes unnecessary data through client; fails late (after form submit) instead of preventing tampering.
  - Confidence: MEDIUM — adds validation step but doesn't prevent the attack vector.
  - Blind spot: User gets better error message than silent data corruption, but the hidden field is misleading to implementers.
- **Decision**: FIXED (Fix A applied — removed user_id from form, API derives from context.locals.user)

### F2 — Button styling pattern diverges from existing code

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — ExerciseCard, Phase 3 — AnimatedPacer
- **Detail**: Plan uses shadcn Button with variant/size props (e.g., size="lg" at plan.md:237). Existing code (SubmitButton.tsx:15-32) completely overrides Button with custom className, ignoring the variant system. This creates two incompatible styling approaches.
- **Fix**: Document the pattern choice in plan.md Phase 2 contract. Either: (a) follow SubmitButton pattern (custom className everywhere), or (b) establish variant/size as the new standard and note that SubmitButton will need refactoring in a future change for consistency.
- **Decision**: FIXED (documented in Phase 2 contract that variant/size is the new pattern, SubmitButton inconsistency noted for future refactor)

### F3 — Hard-coded quiz questions block scalability

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — ExerciseFlow component
- **Detail**: Plan hard-codes 2 quiz questions in ExerciseFlow component (plan.md:598-614). The plan-brief.md correctly flags this as a risk (line 77): "S-02 will need a scalable question storage mechanism." However, the plan doesn't specify WHERE to put questions for the seeded exercise — should they be in the migration seed, or is hard-coding acceptable for MVP?
- **Fix**: Add a note to Phase 3 contract clarifying that hard-coding is intentional for single-exercise MVP, and reference the plan-brief risk. Alternatively, add questions to the seed data's JSONB config field now to avoid rework in S-02.
- **Decision**: FIXED (documented in Phase 3 contract that hard-coding is intentional for MVP, references plan-brief risk)

## Triage Summary

- **Fixed**: F1 (Fix A), F2, F3 (3 findings)
- **Skipped**: None
- **Accepted**: None
- **Dismissed**: None

**Verdict after fixes**: SOUND — all critical and warning findings addressed; plan is ready for implementation.
