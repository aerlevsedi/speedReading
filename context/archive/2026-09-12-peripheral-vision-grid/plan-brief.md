# Peripheral Vision Grid — Plan Brief

> Full plan: `context/changes/peripheral-vision-grid/plan.md`
> Shape notes: `context/foundation/shape-notes-peripheral-vision.md`

## What & Why

Add a 4th exercise type — Peripheral Vision Grid — to the Speed-Reading Training App. Users tap numbers 1–12 in sequence while keeping their gaze on a central green dot, training the peripheral vision span that underpins all three existing reading exercises.

## Starting Point

The app has 3 visible exercise types routed through `ExerciseFlow.tsx` with a shared completion pipeline: `onComplete(duration, errors)` → hidden form POST → `/api/exercises/complete` → `/results/[id]`. Exercise types are registered in a CHECK constraint, a TypeScript union, a component map, and a recommendation service array — each needs a coordinated update.

## Desired End State

The dashboard shows 2 Peripheral Vision Grid cards (dataset_1/2) with a teal badge. A new user sees a first-time intro modal explaining the center-dot mechanic. The exercise presents a 3-2-1 countdown, then a 3×4 grid of randomized 1–12 numbers. After 30 seconds the results page shows Duration and Grids Completed. All 3 existing exercises are unaffected.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Completion submit flow | Extend existing `complete.ts` with a type guard | Zero new endpoints; consistent with existing pipeline | Plan |
| Score storage | `type_data: { grids_completed }` | Reuses extensible JSONB column; avoids schema change | Shape notes |
| Results display | Duration + Grids Completed (2 cards) | Matches success criteria exactly; no WPM or comprehension | Plan |
| Start UX | 3-2-1 countdown before grid | Gives user a moment to focus on center dot before clock starts | Plan |
| Component architecture | All logic in `PeripheralVisionGrid.tsx` | Consistent with existing single-file exercise components | Plan |
| Seed content | Short placeholder string | `content` is never read for this type; avoids misleading WPM calc | Plan |
| Mobile | Show notice on <1024px, don't render grid | Peripheral vision effect requires sufficient screen size | Shape notes |
| Testing | Manual only (golden path + regression) | No automated tests exist for exercise components | Plan |

## Scope

**In scope:**
- DB migration extending CHECK constraint + 2 seed records
- `PeripheralVisionGrid.tsx` React component with full game logic
- ExerciseFlow wiring (component map, intro types, grids_completed passthrough)
- ExerciseIntroModal content for the new type
- `complete.ts` type guard to skip WPM and store `grids_completed`
- Results page Grids Completed metric card
- Dashboard: ExerciseCard badge/label + recommendationService registration

**Out of scope:**
- Variable grid size or duration
- Gaze tracking
- Wrong-tap visual feedback
- Mobile support
- Separate DB column for grids_completed
- Automated tests

## Architecture / Approach

New exercise component → wired into existing ExerciseFlow → completion path extended with a type guard in the API → results page adds a new display branch. No new routes, no new tables, no new services. Every layer adds one conditional for the new type; all existing paths are unchanged.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. DB Migration | CHECK constraint extended + 2 seed records | Constraint drop/re-add must not affect existing rows |
| 2. Types | TypeScript unions updated | Type errors cascade until this is done |
| 3. PeripheralVisionGrid component | Full game logic, countdown, viewport guard | `onComplete` signature adds 3rd param — must not break existing callers |
| 4. ExerciseFlow integration | Component routed, intro modal wired | `handleComplete` must default `gridsCompleted = 0` for backward compat |
| 5. API fix | `complete.ts` stores grids_completed, skips WPM | Must not break WPM calc for existing types |
| 6. Results display | Grids Completed metric card | Results page already conditionally shows WPM — must not regress |
| 7. Dashboard registration | Card visible, recommendation rotation | `VISIBLE_EXERCISE_TYPES` change affects recommendation algorithm |

**Prerequisites:** Local Supabase running (`npx supabase start`); dev server available (`npm run dev`)
**Estimated effort:** ~2–3 focused sessions across 7 phases

## Open Risks & Assumptions

- The `exercises_exercise_type_check` constraint name is assumed from the migration — verify actual name before `DROP CONSTRAINT IF EXISTS`.
- `dashboard.astro` may have a hard-coded exercise type array; Phase 7 includes a verification step to check this.
- `Grid3X3` / `LayoutGrid` lucide icon availability in current version — verify before use; fall back to any available grid icon.

## Success Criteria (Summary)

- User can start a Peripheral Vision Grid session from the dashboard, see the intro modal on first visit, complete the 30-second exercise, and see their Grids Completed score on the results page
- All 3 existing exercise types work identically after the change
- `exercise_completions` row for this type has `type_data = { grids_completed: N }` and `errors = 0`
