# Retry Different Dataset Implementation Plan

## Overview

Add a "Try with different content" button to the results page so users can immediately retry with the other dataset after completing an exercise, without returning to the dashboard.

## Current State Analysis

- `src/lib/services/exerciseService.ts` — `getNextExerciseForType` fetches the alternated-dataset exercise based on completion history. No equivalent function to look up the other dataset for a *known* exercise (same type, other dataset).
- `src/pages/results/[id].astro` — shows completion metrics and a single "Back to Dashboard" link. Has the completed `exercise` object (including `exercise_type` and `dataset_id`) available server-side.
- All active exercise types (`animated_pacer`, `focus_sprint`, `speed_scan`) have exactly two datasets: `dataset_1` and `dataset_2`.
- Retry counts as a normal completion (no schema change needed). The existing alternation logic in `getNextExerciseForType` handles it correctly.

## Desired End State

After completing any exercise, the results page shows two navigation options:
1. "Back to Dashboard" (existing)
2. "Try with different content" — a direct link to `/exercise/[other-dataset-exercise-id]`

The link is resolved server-side. If no alternate exercise exists (data gap), the button is simply not rendered.

### Key Discoveries

- `exerciseService.ts:9` — existing function signature; the new helper mirrors it but takes a known `exercise_type` + `current_dataset_id` instead of looking up history.
- `results/[id].astro:40` — `exercise.exercise_type` and `exercise.dataset_id` are already available; no extra query needed to know the current dataset.
- `types.ts:4` — `dataset_id: string`, values are `"dataset_1"` / `"dataset_2"`.
- Button style: follow the existing `<a href="/dashboard"><Button>Back to Dashboard</Button></a>` pattern using shadcn `Button` with `variant="outline"`.

## What We're NOT Doing

- No retry-specific flag in `exercise_completions` (retry counts as a normal completion).
- No retry button on the dashboard cards or exercise start page.
- No client-side fetch/redirect flow — server-side link only.
- No changes to the dataset alternation algorithm in `getNextExerciseForType`.

## Implementation Approach

1. Add `getAlternateExercise(supabase, exerciseType, currentDatasetId)` to `exerciseService.ts` — queries the `exercises` table for the same type with the opposite dataset.
2. Call this helper in `results/[id].astro` during SSR and pass the resulting exercise ID (or `null`) to the template.
3. Render "Try with different content" button conditionally when the alternate exercise was found.

## Phase 1: Service Helper

### Overview

Add a new exported function to `exerciseService.ts` that fetches the alternate-dataset exercise given a known exercise type and current dataset ID. This keeps the data-access pattern consistent with the existing service.

### Changes Required

#### 1. `getAlternateExercise` in exerciseService

**File**: `src/lib/services/exerciseService.ts`

**Intent**: Export a new function `getAlternateExercise` so the results page (and any future caller) can resolve the other-dataset exercise without duplicating query logic.

**Contract**: `getAlternateExercise(supabase: SupabaseClient, exerciseType: Exercise["exercise_type"], currentDatasetId: string): Promise<Exercise | null>` — returns the exercise whose `exercise_type` matches and whose `dataset_id` is the opposite of `currentDatasetId` (`"dataset_1"` ↔ `"dataset_2"`), or `null` if not found.

### Success Criteria

#### Automated Verification

- TypeScript compiles without errors: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification

- Function is importable from `@/lib/services/exerciseService` without errors.

**Implementation Note**: After completing this phase, automated checks must pass before proceeding to Phase 2.

---

## Phase 2: Results Page Integration

### Overview

Update the results page to call `getAlternateExercise` and conditionally render the "Try with different content" button alongside the existing "Back to Dashboard" button.

### Changes Required

#### 1. Add alternate exercise lookup in `results/[id].astro` frontmatter

**File**: `src/pages/results/[id].astro`

**Intent**: After loading the completion and exercise, call `getAlternateExercise` to find the other-dataset exercise so we can link to it. Store result as `alternateExercise: Exercise | null`.

**Contract**: Import `getAlternateExercise` from `@/lib/services/exerciseService`. Call it with the existing `supabase` client, `exercise.exercise_type`, and `exercise.dataset_id`. Assign result to `alternateExercise`. Null means no alternate found — button is hidden.

#### 2. Render "Try with different content" button

**File**: `src/pages/results/[id].astro`

**Intent**: Show the alternate-dataset link below the existing navigation area. The button should use the `outline` variant to visually distinguish it as secondary to "Back to Dashboard".

**Contract**: Within the `<!-- Navigation -->` div, add a second `<a>` wrapping a `<Button variant="outline">Try with different content</Button>` rendered conditionally when `alternateExercise` is not null. The link target is `/exercise/{alternateExercise.id}`. Apply `gap-3` (or similar) to the container so both buttons sit inline with consistent spacing.

### Success Criteria

#### Automated Verification

- Production build succeeds: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification

- After completing any exercise, results page shows "Try with different content" button.
- Clicking the button navigates to the exercise page for the other dataset.
- The new exercise runs and completes normally (saved to `exercise_completions`).
- After completing both datasets for a type, the dashboard still correctly alternates (points to dataset_1 after dataset_2, etc.).
- "Back to Dashboard" button still works and unchanged.
- No visual regression on the results page layout.

---

## Testing Strategy

### Manual Testing Steps

1. Complete a **Focus Sprint** exercise → verify "Try with different content" appears on results page.
2. Click button → verify navigates to a Focus Sprint with the other dataset.
3. Complete the second Focus Sprint → verify "Try with different content" appears again (pointing back to the first dataset).
4. Complete an **AnimatedPacer** → verify button appears and links to alternate dataset.
5. Complete a **SpeedScan** → same verification.
6. Return to dashboard after completing both datasets for a type → verify alternation still works correctly from dashboard.

## Performance Considerations

One additional DB query per results page load (`getAlternateExercise`). The `exercises` table is small and this is a simple indexed lookup (`exercise_type` + `dataset_id`). No caching or optimization needed.

## References

- Exercise service: `src/lib/services/exerciseService.ts`
- Results page: `src/pages/results/[id].astro`
- Types: `src/types.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Service Helper

#### Automated

- [x] 1.1 TypeScript compiles without errors: `npm run build` — f1be617
- [x] 1.2 Lint passes: `npm run lint` — f1be617

#### Manual

- [x] 1.3 Function is importable from `@/lib/services/exerciseService` without errors

### Phase 2: Results Page Integration

#### Automated

- [x] 2.1 Production build succeeds: `npm run build`
- [x] 2.2 Lint passes: `npm run lint`

#### Manual

- [x] 2.3 After completing any exercise, results page shows "Try with different content" button
- [x] 2.4 Clicking the button navigates to the exercise page for the other dataset
- [x] 2.5 The new exercise runs and completes normally (saved to `exercise_completions`)
- [x] 2.6 After completing both datasets for a type, the dashboard still correctly alternates
- [x] 2.7 "Back to Dashboard" button still works and unchanged
- [x] 2.8 No visual regression on the results page layout
