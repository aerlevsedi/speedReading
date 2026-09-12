# Peripheral Vision Grid Implementation Plan

## Overview

Add a 4th exercise type — **Peripheral Vision Grid** — to the Speed-Reading Training App. The user sees a 3×4 grid of numbers 1–12 placed randomly, with a green dot at the center. They tap numbers 1→12 in sequence while keeping their gaze on the center dot. After 30 seconds the exercise ends and the results page shows how many full grids they completed.

## Current State Analysis

The app has 3 visible exercise types (`animated_pacer`, `focus_sprint`, `speed_scan`) routed through `ExerciseFlow.tsx`. All share a common completion pipeline: `onComplete(durationSeconds, errorCount)` → hidden form POST → `/api/exercises/complete` → redirect to `/results/[id]`.

The new type plugs into every layer of this pipeline with targeted additions — no structural changes to the pipeline itself.

### Key Discoveries

- **CHECK constraint** — `supabase/migrations/20260605000000_create_exercises_schema.sql:7` lists the 4 allowed exercise_type values; must be extended via a new migration.
- **Type union** — `src/types.ts:4` Exercise.exercise_type union and `ExerciseIntroModal.tsx:5` Props.exerciseType union both need `"peripheral_vision_grid"` added.
- **ExerciseComponentMap** — `src/components/exercise/ExerciseFlow.tsx:14-19` — new entry required; `INTRO_SUPPORTED_TYPES:21` also needs the new type.
- **Recommendation service** — `src/lib/services/recommendationService.ts:3` `VISIBLE_EXERCISE_TYPES` array needs the new type.
- **ExerciseCard** — `src/components/dashboard/ExerciseCard.tsx:20-37` — color badge and label maps need entries.
- **complete.ts** — `src/pages/api/exercises/complete.ts:26-33` — WPM is always calculated from `content`; needs a type-guard to skip this for `peripheral_vision_grid` and instead read `grids_completed` from FormData.
- **results/[id].astro** — needs a `grids_completed` display branch (no WPM, no comprehension questions for this type).
- **Seed pattern** — `supabase/migrations/20260607000000_seed_remaining_exercises.sql` — 2 datasets per type; `content` can be a short placeholder string.
- **Lessons file** — use `result` variable pattern for Supabase queries; always null-check `createClient`; never accept `user_id` from client.

## Desired End State

A user can navigate to the dashboard, see the Peripheral Vision Grid card in the rotation, open the intro modal on first visit, complete the 30-second exercise (with 3-2-1 countdown before the grid appears), and land on a results page showing Duration and Grids Completed. All 3 existing exercise types are unaffected. The `peripheral_vision_grid` type participates in the recommendation rotation.

### Key Discoveries (continued)

- `type_data` column in `exercise_completions` is JSONB — extensible; store `{ grids_completed: number }` there (WPM stored as null/omitted).
- The results page uses `totalQuestions = questionCountByType[exercise.exercise_type] ?? 0` — 0 for this type means the comprehension card is hidden automatically (already correct behavior).
- No new API route needed — extend `complete.ts` with a type guard.
- Desktop-only check: component detects `window.innerWidth < 1024` on mount and shows a notice instead of the grid.
- Start flow: 3-2-1 countdown overlay renders before the grid; timer starts after countdown ends.

## What We're NOT Doing

- Variable grid size (4×4, 5×5) — fixed 3×4 for MVP
- Variable exercise duration — fixed 30 seconds
- Gaze tracking / eye-tracking API
- Wrong-tap visual feedback (wrong taps silently ignored)
- Mobile support for this exercise
- Separate `grids_completed` DB column — reuses `type_data` JSONB
- Unit tests for shuffle logic — manual testing only
- Progress chart for this exercise type (no equivalent to focus_sprint WPM trend)

## Implementation Approach

Bottom-up: DB migration → types → new React component → ExerciseFlow wiring → API completion fix → results display fix → dashboard registration (ExerciseCard labels/colors + recommendationService) → seed data. Each layer is independently verifiable.

## Critical Implementation Details

**Completion submit flow**: `ExerciseFlow.tsx` submits via a hidden form with `duration_seconds`, `errors`, and `exercise_id`. For this type, `errors` is always 0 (no questions), and a 4th hidden field `grids_completed` carries the score. In `complete.ts`, add a branch: if `exercise_type === 'peripheral_vision_grid'`, read `grids_completed` from FormData, store `type_data: { grids_completed }`, and skip the WPM calculation entirely. Omit WPM from `type_data` for this type.

**Timer starts after countdown**: The 30-second timer must not start during the 3-2-1 countdown. The countdown is purely cosmetic state (`countdownValue: 3 | 2 | 1 | null`); the timer `useEffect` only starts when `countdownValue === null`.

**Shuffle collision avoidance**: After each grid completion, re-shuffle until the new arrangement differs from the current one. Since there are 12! arrangements, the chance of collision is negligible — a simple `while (arraysEqual(newArr, currentArr)) reshuffle()` loop suffices.

---

## Phase 1: Database Migration

### Overview

Extend the `exercise_type` CHECK constraint to include `peripheral_vision_grid` and seed 2 exercise instances.

### Changes Required

#### 1. New migration file

**File**: `supabase/migrations/20260912100000_add_peripheral_vision_grid_type.sql`

**Intent**: Drop and re-create the CHECK constraint on `exercises.exercise_type` to include `peripheral_vision_grid`, then INSERT 2 seed records (dataset_1 and dataset_2).

**Contract**: The migration must be idempotent-safe as a forward-only migration (no rollback needed). UUIDs follow the existing pattern: `a0000000-0000-0000-0000-000000000041` (dataset_1) and `a0000000-0000-0000-0000-000000000042` (dataset_2). The `content` field stores a short placeholder string: `'Peripheral vision drill — 3×4 number grid'`. `config` is `{}`. `difficulty` is `null`. `estimated_duration_seconds` is `30`. Titles: `'Peripheral Vision Grid — Session 1'` and `'Peripheral Vision Grid — Session 2'`.

The CHECK constraint drop/re-add pattern follows no existing migration (the original just created it). Use:
```sql
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_exercise_type_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_exercise_type_check
  CHECK (exercise_type IN ('animated_pacer', 'smart_questions', 'focus_sprint', 'speed_scan', 'peripheral_vision_grid'));
```

### Success Criteria

#### Automated Verification

- Migration applies cleanly via `npx supabase db reset` or incremental `npx supabase migration up`
- `SELECT exercise_type FROM exercises WHERE exercise_type = 'peripheral_vision_grid'` returns 2 rows

#### Manual Verification

- Run `npx supabase db reset` locally — no errors
- Verify 2 seed records exist in Supabase Studio or via psql

**Implementation Note**: Pause after Phase 1 for manual confirmation before proceeding.

---

## Phase 2: Types and Shared Interfaces

### Overview

Update TypeScript type definitions to include the new exercise type and extend the `Completion` interface.

### Changes Required

#### 1. Exercise type union — src/types.ts

**File**: `src/types.ts`

**Intent**: Add `"peripheral_vision_grid"` to the `Exercise.exercise_type` union (line 4) so TypeScript accepts the new type everywhere.

**Contract**: The union becomes `"animated_pacer" | "smart_questions" | "focus_sprint" | "speed_scan" | "peripheral_vision_grid"`.

#### 2. Completion type_data — src/types.ts

**File**: `src/types.ts`

**Intent**: Extend `Completion.type_data` (line 39-42) to include `grids_completed?: number` alongside the existing `wpm?: number`.

**Contract**: `type_data: { wpm?: number; grids_completed?: number; }`.

### Success Criteria

#### Automated Verification

- `npm run lint` passes with no new type errors

#### Manual Verification

- No TypeScript errors in editor after saving

---

## Phase 3: PeripheralVisionGrid React Component

### Overview

Create the self-contained exercise component with all game logic, countdown, and viewport check.

### Changes Required

#### 1. New exercise component

**File**: `src/components/exercise/PeripheralVisionGrid.tsx`

**Intent**: Implement the full exercise — 3-2-1 countdown, 3×4 grid with shuffled numbers 1–12, green center dot, 30-second countdown timer, tap sequence tracking, grid reset on completion, viewport guard for small screens, and `onComplete` call when timer expires.

**Contract**: Props interface: `{ exercise: Exercise; onComplete: (durationSeconds: number, errorCount: number, gridsCompleted: number) => void }`. Note the 3rd parameter `gridsCompleted` — this differs from the existing `onComplete(durationSeconds, errorCount)` signature used by other components; `ExerciseFlow` will need to handle this (see Phase 4).

State:
- `phase: "countdown" | "running" | "done"` — controls rendering
- `countdownValue: 3 | 2 | 1` — ticks down at 1s intervals while phase is `"countdown"`
- `timeLeft: number` (30 → 0) — ticks down at 1s intervals while phase is `"running"`
- `grid: number[]` — 12-element array (shuffled 1–12), indices map to cell positions
- `nextNumber: number` (1–12) — the number that must be tapped next
- `gridsCompleted: number`
- `isSmallViewport: boolean` — set on mount via `window.innerWidth < 1024`

Grid layout: CSS grid `grid-cols-3` × 4 rows (12 cells). Each cell is a button. The green dot is a centered `div` with `position: absolute` overlaid on the grid container using `pointer-events: none` so it doesn't intercept taps.

Shuffle: Fisher-Yates in a helper function inside the file. On grid reset, loop until new arrangement differs from current.

Timer: single `useEffect` that counts down `timeLeft` each second while phase is `"running"`. When `timeLeft` reaches 0: call `onComplete(30, 0, gridsCompleted)`.

Countdown: separate `useEffect` for phase `"countdown"` that ticks `countdownValue` down every second and transitions to `"running"` when it reaches 0.

Viewport check: `useEffect` with empty deps on mount — sets `isSmallViewport` from `window.innerWidth`. If true, render a simple notice instead of the grid.

Wrong taps: silently ignored (no state change, no animation).

### Success Criteria

#### Automated Verification

- `npm run lint` passes

#### Manual Verification

- Component renders in isolation (can be tested by temporarily hardwiring it in a dev page or via the exercise route once seeded)
- 3-2-1 countdown displays and transitions to the grid
- Numbers 1–12 appear in the 3×4 grid in random positions
- Green dot is visible at the center of the grid
- Tapping the wrong number does nothing
- Tapping the correct next number advances the sequence
- Tapping 12 resets the grid with a new arrangement and increments the counter shown
- At 30 seconds (or when timer reads 0), `onComplete` is called
- On a viewport < 1024px wide, a notice is shown instead of the grid

---

## Phase 4: ExerciseFlow Integration

### Overview

Wire `PeripheralVisionGrid` into `ExerciseFlow.tsx` — component map, intro types, and updated `handleComplete` to handle the 3rd `gridsCompleted` parameter.

### Changes Required

#### 1. Import and register component

**File**: `src/components/exercise/ExerciseFlow.tsx`

**Intent**: Import `PeripheralVisionGrid` and add it to `ExerciseComponentMap`.

**Contract**: New entry: `peripheral_vision_grid: PeripheralVisionGrid`. The `ExerciseComponentMap` type is `as const` — adding the new key makes TypeScript enforce it.

#### 2. Add to INTRO_SUPPORTED_TYPES

**File**: `src/components/exercise/ExerciseFlow.tsx`

**Intent**: Add `"peripheral_vision_grid"` to `INTRO_SUPPORTED_TYPES` (line 21) so the modal and `?` button render for this exercise type.

**Contract**: `INTRO_SUPPORTED_TYPES = ["animated_pacer", "focus_sprint", "speed_scan", "peripheral_vision_grid"] as const`.

#### 3. Update handleComplete to forward gridsCompleted

**File**: `src/components/exercise/ExerciseFlow.tsx`

**Intent**: The existing `handleComplete(durationSeconds, errorCount)` signature must be extended to accept an optional 3rd `gridsCompleted` parameter and store it in state for form submission.

**Contract**: Add `gridsCompleted` to ExerciseFlow state (default 0). Update `handleComplete` signature to `(durationSeconds: number, errorCount: number, gridsCompleted = 0)`. Render a 5th hidden input `<input type="hidden" name="grids_completed" value={gridsCompleted} />` in the completion form (lines 60-67) when `gridsCompleted > 0`. Existing exercise components call `onComplete(duration, errors)` — the default `0` ensures backward compatibility.

#### 4. Update ExerciseIntroModal prop type

**File**: `src/components/exercise/ExerciseIntroModal.tsx`

**Intent**: Add `"peripheral_vision_grid"` to the `exerciseType` union in Props (line 5) and add the new type's content entry to `INTRO_CONTENT`.

**Contract**: Props type: `exerciseType: "animated_pacer" | "focus_sprint" | "speed_scan" | "peripheral_vision_grid"`. New `INTRO_CONTENT` entry:
```typescript
peripheral_vision_grid: {
  title: "Peripheral Vision Grid",
  purpose: "Train your peripheral vision — the ability to perceive and locate information without directly fixating on it. This skill underpins all reading exercises.",
  howItWorks: [
    "A 3×4 grid of numbers 1–12 appears with a green dot at the center.",
    "Keep your gaze fixed on the green dot throughout the exercise.",
    "Without looking away from the center dot, tap numbers 1, 2, 3 … 12 in sequence using your peripheral vision.",
    "When you tap 12, the grid resets with a new arrangement. Repeat for 30 seconds.",
  ],
  whatsMeasured: "Number of complete 1→12 sequences (grids) finished within 30 seconds. Higher is better.",
}
```

### Success Criteria

#### Automated Verification

- `npm run lint` passes with no TypeScript errors

#### Manual Verification

- Navigating to a `peripheral_vision_grid` exercise URL renders the component (not a blank screen or error)
- The `?` button appears and re-opens the intro modal
- The intro modal shows correct Peripheral Vision Grid content

---

## Phase 5: API Completion Fix

### Overview

Extend `/api/exercises/complete` to handle `peripheral_vision_grid` — skip WPM calculation and store `grids_completed` in `type_data`.

### Changes Required

#### 1. Type-guard in complete.ts

**File**: `src/pages/api/exercises/complete.ts`

**Intent**: After reading FormData, check if the exercise is `peripheral_vision_grid`. If so, skip the WPM calc, read `grids_completed` from FormData, and store `{ grids_completed }` in `type_data`. For all other types, keep the existing WPM path.

**Contract**: After the existing `exerciseId`/`durationSeconds`/`errors` reads, add:
```typescript
const gridsCompleted = parseInt(formData.get("grids_completed") as string ?? "0", 10);
```
Then fetch the exercise to get `exercise_type` (extend the existing `.select("content")` to `.select("content, exercise_type")`). Branch:
- If `exercise_type === "peripheral_vision_grid"`: `type_data = { grids_completed: isNaN(gridsCompleted) ? 0 : gridsCompleted }`, skip WPM entirely.
- Else: existing WPM path unchanged.

Uses `result` variable pattern for Supabase queries (lessons.md rule).

### Success Criteria

#### Automated Verification

- `npm run lint` passes

#### Manual Verification

- Completing a Peripheral Vision Grid exercise redirects to `/results/[id]`
- The `exercise_completions` row for that completion has `type_data = { grids_completed: N }` and `errors = 0`
- Completing an existing exercise type (e.g., Speed Scan) still works and stores WPM correctly

---

## Phase 6: Results Page Display

### Overview

Add a Grids Completed metric card to the results page for `peripheral_vision_grid` completions.

### Changes Required

#### 1. Grids Completed display — results/[id].astro

**File**: `src/pages/results/[id].astro`

**Intent**: Add a display branch for `peripheral_vision_grid` that shows a "Grids Completed" metric card instead of WPM or comprehension score.

**Contract**: After line 43 (`const wpm = completion.type_data.wpm ?? 0`), add:
```typescript
const gridsCompleted = completion.type_data.grids_completed ?? 0;
const showGridsCompleted = exercise.exercise_type === "peripheral_vision_grid";
```
In the metrics grid JSX (line 96): When `showGridsCompleted` is true, render a 2-card layout (Duration + Grids Completed) instead of the default layout. The Grids Completed card mirrors the Duration card style:
- Icon: `Grid3X3` from lucide-react (or `LayoutGrid` — choose whichever is available)
- Value: `{gridsCompleted}`
- Label: `Grids Completed`

The `totalQuestions = questionCountByType[exercise.exercise_type] ?? 0` already returns 0 for unknown types, so the comprehension card is already hidden. No change needed there.

`showWpm` and `showGoalComparison` are already false for this type (neither branch name includes `peripheral_vision_grid`). No changes needed to those branches.

### Success Criteria

#### Automated Verification

- `npm run lint` passes

#### Manual Verification

- The results page for a Peripheral Vision Grid completion shows: Duration card + Grids Completed card
- No WPM card, no comprehension card, no goal comparison section, no progress chart
- The results page for a Focus Sprint completion still shows WPM + goal comparison + progress chart

---

## Phase 7: Dashboard Registration

### Overview

Make `peripheral_vision_grid` visible on the dashboard: add badge/label to ExerciseCard, add to recommendation rotation.

### Changes Required

#### 1. ExerciseCard color and label

**File**: `src/components/dashboard/ExerciseCard.tsx`

**Intent**: Add `peripheral_vision_grid` to the `typeBadgeColor` map (line 20-27) and `typeLabel` map (line 29-37).

**Contract**:
- Badge color: `"bg-teal-500/20 text-teal-300"` (distinct from existing blue/green/orange)
- Label: `"Peripheral Vision"`

#### 2. recommendationService.ts

**File**: `src/lib/services/recommendationService.ts`

**Intent**: Add `"peripheral_vision_grid"` to `VISIBLE_EXERCISE_TYPES` (line 3) so it participates in the least-used recommendation algorithm.

**Contract**: `VISIBLE_EXERCISE_TYPES = ["animated_pacer", "focus_sprint", "speed_scan", "peripheral_vision_grid"] as const`. The `ExerciseType` type on line 5 is derived from this array, so it updates automatically. The `counts` Map and fallback return value (`"animated_pacer"`) are unchanged.

#### 3. Verify dashboard.astro fetches the new type

**File**: `src/pages/dashboard.astro`

**Intent**: Check whether the dashboard query hard-codes exercise types or uses `VISIBLE_EXERCISE_TYPES` from the service. If hard-coded, add `peripheral_vision_grid` there too.

**Contract**: This is a verification step — read `src/pages/dashboard.astro` and check the exercises query. If it uses `VISIBLE_EXERCISE_TYPES` already, no change needed. If it has a hard-coded array, extend it to include `"peripheral_vision_grid"`.

### Success Criteria

#### Automated Verification

- `npm run lint` passes

#### Manual Verification

- Dashboard shows 2 Peripheral Vision Grid cards (dataset_1, dataset_2) with teal badge labeled "Peripheral Vision"
- If user has not completed any Peripheral Vision Grid, it is shown as "Recommended"
- All 3 existing exercise type cards still appear correctly

---

## Testing Strategy

### Manual Testing Steps

1. **Dashboard**: Navigate to `/dashboard` — confirm 2 Peripheral Vision Grid cards appear with teal badge. Confirm one is "Recommended" if no prior completions.
2. **Intro modal (first visit)**: Click a Peripheral Vision Grid card — confirm intro modal opens. Read content, click "Start Exercise". Check "Don't show again", dismiss. Confirm `user_intro_views` gets a record.
3. **Exercise flow**: Countdown 3-2-1 displays, then grid renders with 12 numbers and a green center dot. Tap wrong number — nothing happens. Tap correct sequence 1–12 — grid resets. Counter increments. Timer visible counting down from 30.
4. **Completion**: Let timer expire. Confirm redirect to results page. Confirm results page shows Duration + Grids Completed (correct number). Confirm no WPM card, no comprehension card.
5. **DB verification**: Check `exercise_completions` row — `type_data = { grids_completed: N }`, `errors = 0`.
6. **Regression — existing types**: Complete one each of Animated Pacer, Focus Sprint, Speed Scan. Confirm they work identically to before.
7. **Small viewport**: Resize browser to < 1024px wide, navigate to Peripheral Vision Grid — confirm notice shown instead of grid.
8. **Intro re-open**: While on the exercise page, click the `?` button — confirm intro modal re-opens.

## Performance Considerations

Grid re-render on each tap must be < 50ms (FR requirement). React's synchronous state updates for a 12-cell grid are well within this budget — no memoization needed.

## Migration Notes

The DB migration extends the CHECK constraint via `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`. This is a non-destructive DDL change safe to apply to a live database with no existing `peripheral_vision_grid` rows.

## References

- Shape notes: `context/foundation/shape-notes-peripheral-vision.md`
- Seed pattern: `supabase/migrations/20260607000000_seed_remaining_exercises.sql`
- ExerciseFlow: `src/components/exercise/ExerciseFlow.tsx`
- Lessons: `context/foundation/lessons.md`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database Migration

#### Automated

- [x] 1.1 Migration applies cleanly (`npx supabase db reset` or `migration up`) — 44007f0
- [x] 1.2 2 seed records exist with `exercise_type = 'peripheral_vision_grid'` — 44007f0

#### Manual

- [x] 1.3 Confirm in Supabase Studio or psql that both seed rows are present — 44007f0

### Phase 2: Types and Shared Interfaces

#### Automated

- [x] 2.1 `npm run lint` passes with no new type errors — 523ea2d

#### Manual

- [x] 2.2 No TypeScript errors in editor after saving types.ts — 523ea2d

### Phase 3: PeripheralVisionGrid React Component

#### Automated

- [x] 3.1 `npm run lint` passes — 267b486

#### Manual

- [x] 3.2 3-2-1 countdown displays and transitions to grid — 267b486
- [x] 3.3 Grid renders 12 numbers in random positions with green center dot — 267b486
- [x] 3.4 Wrong taps are silently ignored — 267b486
- [x] 3.5 Correct sequence advances and resets grid on 12 — 267b486
- [x] 3.6 Timer expires and `onComplete` fires — 267b486
- [x] 3.7 Small viewport (<1024px) shows notice instead of grid — 267b486

### Phase 4: ExerciseFlow Integration

#### Automated

- [x] 4.1 `npm run lint` passes with no TypeScript errors

#### Manual

- [x] 4.2 Peripheral Vision Grid exercise URL renders the component
- [x] 4.3 `?` button re-opens intro modal with correct content

### Phase 5: API Completion Fix

#### Automated

- [ ] 5.1 `npm run lint` passes

#### Manual

- [ ] 5.2 Completing a Peripheral Vision Grid exercise redirects to results page
- [ ] 5.3 DB row has `type_data = { grids_completed: N }`, `errors = 0`
- [ ] 5.4 Existing exercise types still store WPM correctly

### Phase 6: Results Page Display

#### Automated

- [ ] 6.1 `npm run lint` passes

#### Manual

- [ ] 6.2 Results page for Peripheral Vision Grid shows Duration + Grids Completed
- [ ] 6.3 No WPM card, comprehension card, or goal section on Peripheral Vision Grid results
- [ ] 6.4 Focus Sprint results page still shows WPM, goal, and progress chart

### Phase 7: Dashboard Registration

#### Automated

- [ ] 7.1 `npm run lint` passes

#### Manual

- [ ] 7.2 Dashboard shows 2 Peripheral Vision Grid cards with teal badge
- [ ] 7.3 "Recommended" badge appears on Peripheral Vision Grid for a new user
- [ ] 7.4 All 3 existing exercise type cards render correctly
