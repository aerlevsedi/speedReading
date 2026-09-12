---
project: Speed-Reading Training App — Peripheral Vision Grid exercise
context_type: brownfield
product_type: web-app
target_scale:
  users: small
created: 2026-09-12
updated: 2026-09-12
timeline_budget:
  delivery_weeks: 2
  hard_deadline: null
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  frs_drafted: 7
  quality_check_status: accepted
---

# Shape Notes: Peripheral Vision Grid — new exercise type

## Current System

**Existing system:** Speed-Reading Training App — Astro 6 SSR + React 19 islands, Tailwind 4, Supabase, Cloudflare Workers. Has 3 exercise types (Animated Pacer, Focus Sprint, Speed Scan), all routed through `ExerciseFlow.tsx`. Exercises are stored in a Supabase `exercises` table; completions in a `exercise_completions` table with a `score` column (used for WPM). An intro modal system (`ExerciseIntroModal.tsx`) shows first-time instructions per exercise type.

**Tech stack:** Astro 6, React 19, Tailwind 4, Supabase, Cloudflare Workers, shadcn/ui.

**Users:** Authenticated developers (18–50) using the app to improve reading speed.

**Pain / gap:** All 3 existing exercises are text-reading based. There is no exercise that trains peripheral vision — the ability to perceive and locate information without directly fixating on it. This is a distinct visual skill from reading speed that benefits from dedicated, game-like practice.

**Must preserve:** Existing ExerciseFlow router, auth flow, dashboard, results page, recommendation system (least-used algorithm), intro modal system, completion storage pipeline. The new exercise type plugs into all of these unchanged.

## Vision & Problem Statement

**Change:** Add a 4th exercise type — **Peripheral Vision Grid** — to the Speed-Reading Training App. This exercise trains the user's ability to use peripheral vision by requiring them to locate and tap numbers in sequence while keeping their gaze fixed on a central anchor point.

**Why now:** The existing 3 types cover reading mechanics (pacing, timed reading, scanning). Peripheral vision span is a prerequisite skill for all of them — users who can't use their peripheral field will plateau regardless of how much they practice the reading exercises. Adding a game-like peripheral exercise fills this gap and differentiates the app from generic speed-reading tools.

**Change category:** New module — a new React exercise component + new exercise_type DB record + intro modal content + seeded exercise instances.

## User & Persona

Same primary persona as the existing app: developers (18–50) who use the app to improve reading speed. The Peripheral Vision Grid is an additional exercise they encounter in the regular rotation.

No new user roles or personas introduced.

## Access Control

No changes. Existing flat auth model (email + password / OAuth, authenticated users only). The new exercise type is accessible to any authenticated user, same as the existing 3 types.

**No changes planned — current model preserved.**

## Success Criteria

### Primary

A user can:

1. See the Peripheral Vision Grid exercise card on the dashboard (in regular rotation, eligible for "recommended" marking)
2. Select it, see the first-time intro modal explaining the mechanic
3. Start the exercise — a 3×4 grid of numbers 1–12 (randomly placed) appears with a green dot at the center
4. Tap numbers 1→12 in sequence while keeping their gaze on the green dot; wrong taps are ignored; when 12 is tapped correctly the grid resets with a new random arrangement and the counter increments
5. After 30 seconds the exercise ends automatically
6. See the results page showing grids completed (the score for this exercise type)

### Secondary

Progress chart on the results page reflects grids_completed over time for this exercise type (same chart component, different metric label).

### Guardrails

1. **No regression in existing exercises:** Animated Pacer, Focus Sprint, and Speed Scan must continue to work unchanged. ExerciseFlow.tsx integration must not break the existing routing.
2. **No auth or data contract changes:** The completions table stores `score = grids_completed` (integer); WPM is null/0 for this type. No schema changes beyond seeding a new exercise_type value.

## Functional Requirements

### Peripheral Vision Grid exercise mechanic

- FR-021: User can see the Peripheral Vision Grid on the dashboard and select it. Priority: must-have. Change: new.

  > Socrates: Counter-argument considered: "Adding a 4th exercise type dilutes the recommendation rotation." Resolution: kept; more variety is the explicit product goal (PRD FR-018). The least-used algorithm handles rotation automatically.

- FR-022: User sees a first-time intro modal for Peripheral Vision Grid explaining the purpose, mechanics, and scoring before the exercise starts. Priority: must-have. Change: new.

  > Socrates: Counter-argument considered: "The mechanic is obvious — numbers in a grid, tap in order." Resolution: kept; the CENTER DOT constraint is non-obvious and must be explained. Without the intro, users will just look around the grid freely and miss the point of the exercise.

- FR-023: User sees a 3×4 grid of numbers 1–12 placed randomly in cells, with a green dot displayed in the center of the grid. Priority: must-have. Change: new.

  > Socrates: Counter-argument considered: "A green dot is a weak gaze anchor — users will still look around." Resolution: kept for MVP; the dot is a convention in peripheral vision training tools. Stronger anchors (e.g., animated dot, gaze tracking) are post-MVP enhancements.

- FR-024: User taps numbers 1–12 in ascending sequence; only the correct next number in sequence registers as a tap (wrong taps are ignored silently). Priority: must-have. Change: new.

  > Socrates: Counter-argument considered: "Silent wrong-tap ignoring gives no feedback — user doesn't know if the device missed a tap or they tapped wrong." Resolution: kept for MVP simplicity. A brief visual highlight on wrong taps (no penalty, no score impact) is noted as a post-MVP refinement.

- FR-025: When the user correctly taps 12, the grid resets with a new random arrangement of 1–12, and the completed-grid counter increments by 1. Priority: must-have. Change: new.

  > Socrates: No counter-argument; it stands as written. Immediate reset (no animation pause) keeps the flow game-like and maintains time pressure.

- FR-026: The exercise runs for 30 seconds from the moment the first grid appears; when time expires the exercise ends and the user sees the results page showing grids completed. Priority: must-have. Change: new.

  > Socrates: Counter-argument considered: "30 seconds is arbitrary — might be too short for slow users or too easy for fast ones." Resolution: kept for MVP; 30 seconds is a standard peripheral vision drill duration. Variable duration is a post-MVP refinement (noted in Non-Goals).

- FR-027: The system stores the exercise completion with `score = grids_completed` (integer); WPM is null/0 for this exercise type. Priority: must-have. Change: new (data: new exercise_type record + seeded instances).

  > Socrates: Counter-argument considered: "Storing grids_completed in the WPM score column is semantically confusing for future queries." Resolution: kept for now — the score column is already generic (it holds a number, not "wpm" explicitly). A future migration to add a grids_completed column is noted as a post-MVP schema improvement.

## User Stories

### US-02: Complete a Peripheral Vision Grid session

**As a** user on the dashboard
**I want to** select the Peripheral Vision Grid exercise, keep my gaze on the center dot, and tap numbers 1–12 in order as fast as I can
**So that** I can train my peripheral vision and see how many full grids I completed in 30 seconds.

**Given** I am on the dashboard and the Peripheral Vision Grid exercise card is visible
**When** I select it, see the intro modal (first time), start the exercise, and tap 1–12 in sequence on one or more grids within 30 seconds
**Then** the exercise ends at 30 seconds and I see a results page showing the number of grids I completed.

## Business Logic

**Core domain rule (no change to existing rule):** The recommendation system (least-used algorithm) now includes Peripheral Vision Grid as a 4th exercise type. The rule itself is unchanged — the exercise type the user has completed the fewest times is recommended.

**New mechanic rule:** During the exercise, only taps on the number that is exactly `current_sequence_position + 1` register. All other taps are no-ops. When position reaches 12, the grid resets to a new random arrangement and `grids_completed` increments. The timer is the sole termination condition.

**Scoring:** `score = grids_completed` (integer count of fully completed 1→12 sequences within 30 seconds). Higher is better. This replaces WPM for this exercise type; WPM is not applicable.

## Non-Functional Requirements

1. **Grid randomness:** Each new grid arrangement must be a fresh Fisher-Yates shuffle of 1–12. No two consecutive grids should have the same arrangement (re-shuffle on collision).

2. **Tap responsiveness:** Tap/click registration must feel immediate — no perceptible lag between the correct tap and the grid reset. Target: < 50ms from tap event to grid re-render.

3. **Desktop-first:** Grid cells must be large enough on desktop (≥ 1280px viewport) that the peripheral vision constraint is meaningful — center dot to outermost cell corners should span > 10° of visual angle at a typical monitor distance. Mobile is not a target for this exercise.

## Constraints & Preserved Behavior

- `ExerciseFlow.tsx` routing must continue to work for all 3 existing exercise types unchanged.
- `ExerciseIntroModal.tsx` content map gains a new entry for `peripheral_vision_grid` — existing entries untouched.
- `exercise_completions` table: no column changes. `score` stores `grids_completed` as integer; `wpm` column (if present) is null.
- The new exercise type value `peripheral_vision_grid` must be added to the DB's `exercise_type` check constraint (or enum) via migration.
- 2 seeded exercise instances (2 datasets) must be added, consistent with the existing seeding pattern for other types.

## Non-Goals

1. **Variable grid size** (e.g., 4×4 or 5×5 difficulty tiers) — fixed 3×4 for MVP. Grid size progression is a post-MVP enhancement.
2. **Variable exercise duration** — fixed 30 seconds for MVP. Configurable duration is post-MVP.
3. **Gaze tracking / eye-tracking API** — the center dot is a behavioral anchor only; no browser eye-tracking is used or planned.
4. **Wrong-tap visual feedback** — wrong taps are silently ignored in MVP. A brief highlight animation is a post-MVP UX refinement.
5. **Mobile support for this exercise** — desktop-only. The peripheral vision effect requires sufficient screen size.
6. **Separate `grids_completed` DB column** — reuses existing `score` column for MVP. Schema cleanup is post-MVP.

## Quality cross-check

All elements present. No warnings.

- Access Control: present — no changes, existing model preserved.
- Business Logic: present — recommendation rule unchanged, new mechanic rule captured.
- Project artifacts: present.
- Timeline-cost ack: present — 2-week delivery, after-hours, within scope.
- Non-Goals: present — 6 explicit non-goals.
- Preserved behavior: present — ExerciseFlow, intro modal, completions pipeline all explicitly preserved.
