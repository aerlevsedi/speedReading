---
date: 2026-07-28T18:30:00+02:00
researcher: aerlevsedi
git_commit: da244c0a1bd4ced62c4aad45b802825cb393adbf
branch: main
repository: speedReading
topic: "S-05 progress-chart — show a progress chart comparing current to previous sessions (FR-014)"
tags: [research, codebase, progress-chart, results, exercise_completions, charting]
status: complete
last_updated: 2026-07-28
last_updated_by: aerlevsedi
---

# Research: S-05 Progress Chart (FR-014)

**Date**: 2026-07-28T18:30:00+02:00
**Researcher**: aerlevsedi
**Git Commit**: da244c0a1bd4ced62c4aad45b802825cb393adbf
**Branch**: main
**Repository**: speedReading

## Research Question

How should slice S-05 (`progress-chart`) be implemented so a user can "see a progress chart comparing current to previous sessions" (PRD FR-014), reading from `exercise_completions`, handling cold-start gracefully, and fitting the Astro SSR + React islands + Supabase RLS architecture already in place?

## Summary

FR-014 belongs on the **results page** (`src/pages/results/[id].astro`) — the PRD phrasing is "results summary with comparison chart," and the page already fetches the current completion server-side and computes/derives WPM. The chart compares the **current** completion to a small window of the user's **previous** completions.

Everything needed already exists on the data side:

- `exercise_completions` stores per-completion `duration_seconds`, `errors`, and `type_data.wpm`, protected by an owner-only SELECT RLS policy.
- There is already a **purpose-built index** `idx_exercise_completions_user_date ON (user_id, completed_at DESC)` whose comment literally says "for progress chart queries (last N completions for user X)." No migration is required for reads.

The two real decisions for planning are **(1) what metric/series to chart** (WPM is only meaningful and comparable for reading exercises, and only `focus_sprint` reflects the user's own pace — `animated_pacer` WPM is imposed by the pacer; `speed_scan` has no WPM), and **(2) how to render the chart** (no charting library is installed today; choices are a dependency-free inline SVG/CSS component vs. adding a React chart library like Recharts as a `client:load` island).

Cold-start is a solved pattern in this codebase: the goal-comparison slice renders a CTA/placeholder when there is no data, and `dashboard-coldstart.test.ts` demonstrates the integration-test shape for the 0-history case.

## Detailed Findings

### Where the chart lives — the results page

- `src/pages/results/[id].astro` is a fully server-rendered (`export const prerender = false`) page. It:
  - validates the `id` param as a UUID and redirects on failure (`src/pages/results/[id].astro:13`),
  - requires `Astro.locals.user` and redirects unauthenticated users (`:19`),
  - null-checks `createClient(...)` (`:23`, matches the lessons rule),
  - fetches the current completion joined to its exercise, scoped to `user_id` (`:26-33`),
  - derives WPM, comprehension, formatted duration, and (for `focus_sprint`) a goal-comparison block (`:44-71`).
- The page renders a metrics grid and, conditionally, the goal-comparison card as **static Astro** — the goal slice added interactivity-free display; the only React island is the shadcn `<Progress client:load />` bar (`src/pages/results/[id].astro`, Goal Comparison block). This is the pattern the chart should follow: fetch server-side, render markup; add an island only if the chart itself needs client rendering.

### Data model + RLS (no migration needed for reads)

- `exercise_completions` schema (`supabase/migrations/20260605000000_create_exercises_schema.sql:30-45`):
  - `user_id UUID` (FK to `auth.users`, `ON DELETE CASCADE`), `exercise_id`, `duration_seconds`, `errors`, `type_data JSONB` (holds `{ wpm }`), `completed_at TIMESTAMPTZ`.
- Index built for exactly this feature (`:47`):
  `CREATE INDEX idx_exercise_completions_user_date ON exercise_completions(user_id, completed_at DESC);`
- RLS (`:52-64`): `completions_select_own` allows `auth.uid() = user_id` for SELECT; insert policy `completions_insert_own`. So a server-side query with the user's SSR client naturally returns only that user's rows — no manual `user_id` filter is required for correctness, though existing code adds `.eq("user_id", user.id)` defensively (`results/[id].astro:31`).
- `Completion` type (`src/types.ts:33-44`): `type_data: { wpm?: number }` is the charting metric field.

### How WPM is produced and where it is/ isn't meaningful

- WPM is computed **once, at completion time** in the complete endpoint and stored in `type_data.wpm` (`src/pages/api/exercises/complete.ts`): `wordCount / (durationSeconds / 60)`, rounded.
- The results page already encodes the semantics of WPM per type:
  - `showWpm = type === "animated_pacer" || type === "focus_sprint"` — WPM displayed for these two.
  - `showGoalComparison = type === "focus_sprint"` with the explicit comment *"Goal comparison: only for Focus Sprint (user-paced, true WPM baseline)."*
  - The goal-comparison plan-brief states the same rationale: **Focus Sprint** measures the user's own self-paced speed (they click done); **Animated Pacer** WPM is imposed by the pacer highlight; **Speed Scan** has no WPM.
- Implication for the chart: a WPM trend line is only a *true* progress signal for `focus_sprint`. `animated_pacer` WPM is roughly constant (pacer-driven), and `speed_scan` has no WPM at all. `errors`/comprehension and `duration_seconds` exist for every completion but mean different things per type.

### Charting: no library installed today

- `package.json` dependencies include React 19, Astro 6, Tailwind 4, shadcn primitives (`radix-ui`, `class-variance-authority`), `lucide-react` icons — **no chart library** (no recharts/chart.js/visx/nivo).
- `src/components/ui/` has `progress.tsx`, `button.tsx`, `alert.tsx` (shadcn "new-york"). Existing React islands mount with `client:load` (e.g. `<Progress client:load />`, dashboard `GoalWidget`).
- Two viable rendering approaches (planning decision):
  1. **Dependency-free inline SVG / CSS bars** — a small custom component (Astro or a tiny React island) that maps N points to an SVG polyline/bars. Zero new deps, Cloudflare-Workers-safe, full styling control, matches the "minimal deps" posture; costs a bit of hand-rolled code.
  2. **Add a React charting library** (e.g. Recharts) as a `client:load` island — richer axes/tooltips out of the box; costs a new dependency + bundle weight and Workers/SSR compatibility verification.

### Cold-start handling (established pattern)

- FR-014 Socrates note requires a **placeholder message when no history yet**. The goal slice already models this: when no goal is set, the results page shows a CTA instead of a bar (`results/[id].astro` Goal Comparison else-branch). The chart's "0 or 1 prior sessions" branch should mirror this — render an encouraging placeholder ("Complete more sessions to see your progress") rather than an empty/broken chart.
- `getNextExerciseForType` (`src/lib/services/exerciseService.ts`) shows the codebase's cold-start convention: default gracefully when history is empty.

### Server-side data access + service pattern

- Business logic that reads Supabase is extracted into `src/lib/services/` (only `exerciseService.ts` today). It takes a `SupabaseClient` + `userId` and returns typed domain objects, using the `result` variable pattern (`const result = await supabase...; result.data`). A new `progressService.ts` (e.g. `getRecentCompletions` / `getProgressSeries`) fits this convention cleanly.
- Dashboard already does a filtered completions query with `.order("completed_at", { ascending: false }).limit(1)` and an `exercises!inner(exercise_type)` join to scope by type (`src/pages/dashboard.astro:28-37`) — the exact query shape a per-type progress series needs, just with a larger `.limit(N)`.

### Testing conventions

- Integration tests (`tests/integration/`) run against **real local Supabase + the running Astro server over HTTP**, using cookie injection. Golden pattern: `completion-pipeline.test.ts` signs in via `/api/auth/signin`, collects `Set-Cookie` (handling chunked `getSetCookie()`), strips attributes to `name=value`, and sends the `Cookie` header on subsequent requests. Cleanup via `deleteFixtureUsers` in `afterAll`.
- `dashboard-coldstart.test.ts` is the template for a **0-history** assertion: create a fresh fixture user, insert **no** completions, request the page, assert 200 + expected placeholder markup + no stack traces.
- Fixtures helper exposes `createFixtureUser`, `deleteFixtureUsers`, `SEEDED_EXERCISE_ID`; `helpers/supabase` exposes `adminClient` (bypasses RLS) and `authClient(jwt)` (RLS-enforced) for read-back verification.
- Test DB rows for progress need multiple completions with varied `completed_at`/`type_data.wpm`; insert via `adminClient` in `beforeAll`, then hit the results page and assert the rendered series/placeholder.

## Code References

- `src/pages/results/[id].astro:26-71` — current-completion fetch, WPM/comprehension/goal derivation; the insertion point for the chart.
- `src/pages/api/exercises/complete.ts` — WPM computation + `type_data.wpm` persistence.
- `supabase/migrations/20260605000000_create_exercises_schema.sql:30-64` — completions schema, the `idx_exercise_completions_user_date` chart index, and RLS policies.
- `src/lib/services/exerciseService.ts` — service-layer + `result` pattern + cold-start convention.
- `src/pages/dashboard.astro:28-37` — filtered/ordered completions query with `exercises!inner(exercise_type)` join (per-type series shape).
- `src/types.ts:33-44` — `Completion` type with `type_data.wpm`.
- `tests/integration/completion-pipeline.test.ts` — golden cookie-injection integration-test pattern.
- `tests/integration/dashboard-coldstart.test.ts` — 0-history integration-test template.

## Architecture Insights

- **SSR-first, islands only when needed.** Pages fetch data server-side under RLS; React islands (`client:load`) are added only for interactivity. A static/SVG chart needs no island; a chart library would.
- **Metric semantics are per-type and already encoded** in the results page (`showWpm`, `showGoalComparison`). The chart should respect this: WPM is a genuine progress signal only for `focus_sprint`.
- **The DB was pre-designed for this slice** — the `(user_id, completed_at DESC)` index comment names the progress chart. Reads need no schema change.
- **Cold-start is a first-class UX branch**, handled with placeholders/CTAs, not empty charts — consistent across dashboard and goal comparison.
- **Lessons that constrain the plan** (`context/foundation/lessons.md`): derive `user_id` from `context.locals.user` only (never client input); use the `result` variable pattern for Supabase queries; always null-check `createClient`.

## Historical Context (from prior changes)

- `context/archive/2026-07-27-goal-comparison/plan-brief.md` — closest analog: added a per-type progress display (progress bar) on the **Focus Sprint** results page, fetched server-side, with a cold-start CTA. Explicitly lists "Progress chart across sessions (S-05)" as out-of-scope, and documents *why* WPM comparison is gated to Focus Sprint. This is the template to mirror for structure, gating, and cold-start.
- `context/archive/2026-07-11-dataset-alternation-coldstart/` — established the cold-start-defaults convention now in `exerciseService.ts`.
- `context/archive/2026-06-26-completion-pipeline-correctness/` — WPM computation correctness and the `completion-pipeline.test.ts` golden test.

## Related Research

- None prior for this change. Closest sibling artifacts: `context/archive/2026-07-27-goal-comparison/plan.md` (progress display on results) and `context/archive/2026-06-05-first-exercise-completion/` (results page origin).

## Open Questions (for /10x-plan to resolve)

1. **Which metric + which series** does the chart plot — WPM trend (and gated to `focus_sprint` only, mirroring goal comparison), or a per-type metric (WPM for reading types, comprehension/duration for `speed_scan`)?
2. **Scope of comparison** — chart the last N completions of the **same exercise type**, or all completions regardless of type? (Per-type is the meaningful comparison given metric semantics.)
3. **Rendering approach** — dependency-free inline SVG/CSS vs. adding a React charting library (Recharts) as a `client:load` island.
4. **Cold-start threshold** — placeholder shown at 0 prior sessions only, or also at 1 (i.e. require ≥2 points to draw a trend)?
5. **Where exactly** — results page only (per FR-014 wording), or also a mini trend on the dashboard? (FR-014 says results summary; dashboard is out of scope unless expanded.)
