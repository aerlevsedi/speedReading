# Intro and Instructions — Plan Brief

> Full plan: `context/changes/intro-and-instructions/plan.md`

## What & Why

Add per-exercise-type intro modals and a persistent `?` button to the exercise page (PRD FR-007, FR-008). First-time users need context on what each exercise trains and how they're scored before they start — without this, they're dropped into an unfamiliar exercise with no orientation. Returning users need always-accessible instructions via the `?` icon.

## Starting Point

All 3 exercise types (Animated Pacer, Focus Sprint, Speed Scan) already route through a single `ExerciseFlow.tsx` component. No modal/dialog UI component exists yet. No user preference persistence exists beyond `user_goals`; a new `user_intro_views` table is needed.

## Desired End State

On first visit to each exercise type, a modal gates the start — explaining the purpose, mechanics, and scoring. A "Don't show this again" checkbox lets users opt out of future intros for that type (persisted to Supabase). A `?` button in the top-right corner is always visible and re-opens the same modal on demand without resetting the exercise.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| "Don't show again" persistence | Supabase `user_intro_views` table | Cross-device consistency; matches existing persistence pattern in the app | Plan |
| Component injection point | `ExerciseFlow.tsx` only | All 3 exercise types pass through it — inject once, no per-component duplication | Plan |
| Modal hard gate | Yes — backdrop click disabled | Ensures first-time users read the intro; matches onboarding UX intent from FR-007 | Plan |
| `?` button visibility | Always visible (top-right) | FR-008 says instructions must be accessible in subsequent sessions, not just pre-start | Plan |
| Timer gate strategy | Exercise component not mounted while first-time gate is open | Prevents timer accumulating during intro read; mid-exercise `?` re-open keeps component mounted | Plan |
| `seenIntros` fetch | SSR in `exercise/[id].astro` | No client-side loading flicker; auth is already resolved server-side | Plan |

## Scope

**In scope:**
- `user_intro_views` migration + RLS
- `/api/intros/mark-seen` POST endpoint
- `ExerciseIntroModal` component with content for AnimatedPacer, FocusSprint, SpeedScan
- shadcn Dialog install
- `ExerciseFlow` integration: gate + `?` button + API call

**Out of scope:**
- `smart_questions` intro (deprecated, not routed)
- Per-dataset intros (type-level only)
- Timer pause when `?` modal is open
- Multi-step / animated walkthrough

## Architecture / Approach

`exercise/[id].astro` (SSR) queries `user_intro_views` for the current user and passes `seenIntros: string[]` down to `ExerciseFlow` as a prop. `ExerciseFlow` checks `seenIntros.includes(exercise_type)` to set initial gate state. The `ExerciseIntroModal` is a shadcn Dialog with hard-gate behavior. On dismiss with checkbox ticked, `ExerciseFlow` fires a `fetch` POST to `/api/intros/mark-seen`. The exercise component is conditionally mounted (only after the first-time gate clears) to prevent premature timer start.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Data Layer | Migration + API endpoint + SSR query + types | New table must have RLS that mirrors `user_goals` pattern |
| 2. Intro Modal Component | shadcn Dialog install + `ExerciseIntroModal` with content for all 3 types | Content authoring — intro text must be accurate and concise |
| 3. ExerciseFlow Integration | Gate logic + `?` button + API wiring | Timer gate state machine must not unmount the exercise component on `?` re-open |

**Prerequisites:** Local Supabase running (`npx supabase start`)
**Estimated effort:** ~2 sessions across 3 phases

## Open Risks & Assumptions

- `seenIntros` query in `exercise/[id].astro` fails silently (defaults to `[]`) — worst case is user sees intro again, not a crash.
- `fetch` to `/api/intros/mark-seen` is fire-and-forget (no error handling in UI) — failure means user sees intro again next time, which is acceptable.

## Success Criteria (Summary)

- First-time visit to each exercise type shows the intro modal before the exercise starts
- Ticking "Don't show this again" and dismissing persists the preference; modal does not reappear for that type
- `?` button always opens the modal without resetting exercise state
