# Retry Different Dataset — Plan Brief

> Full plan: `context/changes/retry-different-dataset/plan.md`

## What & Why

After finishing an exercise, users currently have only one option: go back to the dashboard. This plan adds a "Try with different content" button on the results page so users can immediately retry the same exercise type with the other dataset — removing friction for users who want more practice without navigating away.

## Starting Point

Each exercise type has two datasets (`dataset_1` / `dataset_2`). The dashboard auto-alternates between them on each visit using `getNextExerciseForType`. The results page (`/results/[id]`) already has the completed exercise object with `exercise_type` and `dataset_id`, but today it only renders a "Back to Dashboard" link.

## Desired End State

The results page shows two navigation buttons: the existing "Back to Dashboard" and a new secondary "Try with different content" button. The button links directly to `/exercise/[other-dataset-exercise-id]`, resolved server-side. The retry completion is stored normally in `exercise_completions`, feeding naturally into the existing alternation logic.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Retry placement | Results page only | Natural post-completion moment; no dashboard card redesign needed | Plan |
| Retry counts in history | Yes — normal completion | No schema change needed; existing alternation logic handles it | Plan |
| Navigation method | Server-side SSR link | Follows existing page-link pattern; no extra API endpoint | Plan |
| Button label | "Try with different content" | Friendlier than exposing internal "dataset" terminology | Plan |
| Exercise type scope | All active types | Consistent UX; no per-type special-casing | Plan |

## Scope

**In scope:**
- New `getAlternateExercise` helper in `exerciseService.ts`
- "Try with different content" button on `results/[id].astro`

**Out of scope:**
- Retry button on dashboard cards or exercise start page
- Dataset retry flag / schema changes
- Client-side fetch flow

## Architecture / Approach

Thin SSR change. The results page calls a new `getAlternateExercise(supabase, exerciseType, currentDatasetId)` helper that queries the `exercises` table for the same type with the opposite dataset. The ID is passed to the template and rendered as a standard Astro anchor + shadcn `Button` (variant="outline"). If no alternate exercise exists, the button is simply not rendered.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Service Helper | `getAlternateExercise` exported from `exerciseService.ts` | None — trivial DB query |
| 2. Results Page Integration | "Try with different content" button on results page | Visual layout regression in the navigation area |

**Prerequisites:** None  
**Estimated effort:** ~1 session, 2 phases

## Open Risks & Assumptions

- AnimatedPacer questions don't vary by dataset (hardcoded), so "Try with different content" navigates to a different exercise record but the user sees the same questions — acceptable per plan decision.
- Assumes both dataset_1 and dataset_2 exist for all active exercise types in the database.

## Success Criteria (Summary)

- "Try with different content" button appears on all exercise results pages.
- Button links to the correct alternate-dataset exercise and it runs/saves normally.
- Dashboard alternation logic still works correctly after a retry completion.
