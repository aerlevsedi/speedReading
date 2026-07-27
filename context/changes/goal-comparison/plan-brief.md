# Goal Setting and Comparison — Plan Brief

> Full plan: `context/changes/goal-comparison/plan.md`

## What & Why

Users can't set a reading speed target and have no way to measure whether they're improving toward a goal. S-03 adds a global WPM goal (set once on the dashboard) and a progress bar on Animated Pacer results showing actual vs. target — closing the "visible progress" gap identified in the PRD Vision.

## Starting Point

No goal storage exists anywhere in the app — no `user_goals` table, no profiles table, no API endpoints. The results page (`src/pages/results/[id].astro`) already computes and displays WPM for Animated Pacer and Focus Sprint, giving us the actual value; we just need to fetch and compare the target.

## Desired End State

Users see a goal widget in the dashboard header showing their current WPM target and their most recent Animated Pacer result, with an inline edit that accepts 50–1000 wpm and shows beginner/intermediate/advanced hint ranges. After completing an Animated Pacer exercise, the results page shows a filled progress bar ("250 wpm / 400 wpm — 62.5%"); if no goal is set, a CTA prompts them to set one. Focus Sprint and Speed Scan results are unaffected.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Goal scope | Single global WPM per user | PRD specifies one reading speed goal; per-type goals add UI complexity without PRD backing | Plan |
| Goal applies to | Animated Pacer only | Animated Pacer is the canonical speed-measurement exercise; Focus Sprint WPM is time-pressured and would distort the goal baseline | Plan |
| Goal entry location | Dashboard header, inline edit | Discoverable on every visit; no new page needed; fits existing header card pattern | Plan |
| Dashboard also shows | Goal + latest Animated Pacer WPM | Instant progress check without completing a new exercise | Plan |
| Results cold-start | "Set your goal" CTA | Guides feature discovery without blocking; one conditional branch | Plan |
| API design | POST /api/goals/set (upsert) | One endpoint regardless of whether goal exists; avoids client knowing whether to POST vs PATCH | Plan |
| Server validation | 50–1000 wpm range | Prevents garbage data; matches hint ranges shown in UI | Plan |
| Goal guidance | Hint text with ranges | Addresses PRD Socrates note: users don't know what's realistic | Plan |

## Scope

**In scope:**
- `user_goals` DB table (one row per user, unique on user_id) with RLS
- `UserGoal` TypeScript interface in `src/types.ts`
- `POST /api/goals/set` (upsert, 50–1000 validation, user_id from session)
- Dashboard `GoalWidget` React island (display + inline edit + hint ranges)
- Animated Pacer results: progress bar + percentage or "Set goal" CTA

**Out of scope:**
- Goals for Focus Sprint, Speed Scan, or future exercise types
- Per-exercise-type goals
- Goal change history
- Progress chart across sessions (S-05)
- Client-side GET of goals (always server-side fetched in Astro pages)

## Architecture / Approach

New `user_goals` table (one row per user) is the only schema addition. The dashboard fetches goal + latest Animated Pacer WPM server-side, passes them as props to a React island (`GoalWidget`) that handles inline editing. The results page fetches the goal server-side and renders the comparison section as static Astro — no React island needed because the comparison display has no client interactivity.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. DB Migration and Types | `user_goals` table + RLS + `UserGoal` type | Migration must apply cleanly before any app code uses the table |
| 2. Goal API Endpoint | POST /api/goals/set with upsert and validation | Upsert ON CONFLICT requires the unique index from Phase 1 |
| 3. Dashboard Goal Widget | Inline-editable goal + latest WPM on dashboard | React island adds client:load — verify it doesn't break dashboard SSR |
| 4. Results Page Comparison | Progress bar + percentage or CTA on Animated Pacer results | shadcn Progress component must be installed; gate must not leak to other exercise types |

**Prerequisites:** S-01 done (completions table exists, WPM computed and stored). Local Supabase running for migration testing.
**Estimated effort:** ~2-3 sessions across 4 phases.

## Open Risks & Assumptions

- shadcn Progress component may not be installed — verify before Phase 4 and install with `npx shadcn@latest add progress` if absent.
- S-02 (all-exercise-types) is in-progress — the Animated Pacer type gate is stable regardless of S-02 completion state.

## Success Criteria (Summary)

- User sets a WPM goal on the dashboard; it persists across sessions.
- Completing an Animated Pacer exercise shows a correct progress bar with the right percentage.
- Focus Sprint and Speed Scan results are unchanged.
