# Progress Chart (S-05) Implementation Plan

## Overview

Add a Focus Sprint WPM **progress chart** that compares the user's current reading-speed session to all their previous Focus Sprint sessions (PRD FR-014). The chart renders on the Focus Sprint results page and, as a compact mini-trend, on the dashboard. It uses **Recharts** mounted as a client-side React island, overlays the user's WPM goal as a reference line when one is set, and shows a graceful **placeholder** until the user has at least 2 Focus Sprint sessions.

## Current State Analysis

- **Results page** (`src/pages/results/[id].astro`) is fully SSR (`prerender = false`). It fetches the current completion joined to its exercise (scoped to `user_id`), derives WPM, comprehension, formatted duration, and — for `focus_sprint` only — a goal-comparison card using `user_goals.target_wpm`. The only React island on the page today is the shadcn `<Progress client:load />` bar.
- **WPM semantics are per-type and already encoded**: `showWpm` is true for `animated_pacer` + `focus_sprint`; `showGoalComparison` is gated to `focus_sprint` with the comment *"user-paced, true WPM baseline."* Animated Pacer WPM is imposed by the pacer; Speed Scan has no WPM. → The trend chart is meaningful only for `focus_sprint`.
- **Data is ready — no read-side migration needed**: `exercise_completions` stores `type_data.wpm`, `duration_seconds`, `errors`, `completed_at`, protected by owner-only SELECT RLS (`completions_select_own`). A purpose-built index `idx_exercise_completions_user_date ON (user_id, completed_at DESC)` exists, its comment naming the progress chart.
- **Service pattern**: `src/lib/services/exerciseService.ts` takes `(supabase, userId, ...)`, uses the `result` variable pattern, returns typed data. The dashboard already runs a filtered/ordered completions query with an `exercises!inner(exercise_type)` join (`dashboard.astro:28-37`) — the exact shape a per-type series needs, just without `.limit(1)`.
- **Dashboard** renders `<GoalWidget currentGoal latestWpm client:load />` inside the header card (`dashboard.astro`), already fetching `currentGoal` and `latestWpm` server-side. The mini-trend fits alongside it.
- **No charting library** is installed today.
- **Cold-start** is an established UX branch: goal comparison shows a CTA when no goal exists; `dashboard-coldstart.test.ts` is the 0-history test template.

## Desired End State

- On a **Focus Sprint** results page, a user with ≥2 Focus Sprint completions sees a line chart of WPM over time (chronological, current session as the last/highlighted point). If a WPM goal is set, a horizontal reference line marks the target. With <2 sessions, an encouraging placeholder replaces the chart.
- On the **dashboard**, a compact mini-trend of the same Focus Sprint WPM series appears near the goal widget (same ≥2-session gating and placeholder).
- Animated Pacer and Speed Scan results are unchanged (no chart).
- Verifiable via `npm run lint`, `npm run build`, and integration tests covering the ≥2-session chart, the <2 placeholder, and the dashboard mini-trend.

### Key Discoveries:

- `src/pages/results/[id].astro:26-71` — insertion point; already computes `showGoalComparison`/`targetWpm` for `focus_sprint`.
- `supabase/migrations/20260605000000_create_exercises_schema.sql:47` — `(user_id, completed_at DESC)` index built for this query.
- `src/pages/dashboard.astro:28-37` — per-type completions query shape (`exercises!inner(exercise_type)`), reuse with a larger limit.
- `src/lib/services/exerciseService.ts` — service + `result` pattern + cold-start convention.
- Lessons (`context/foundation/lessons.md`): derive `user_id` from `context.locals.user`; use `result` variable pattern; null-check `createClient`.

## What We're NOT Doing

- No chart for Animated Pacer or Speed Scan (WPM not a valid progress signal there).
- No new DB table, column, or migration (reads use the existing index + RLS).
- No per-type or historical goal tracking beyond the single existing `user_goals.target_wpm`.
- No date-range picker, zoom, export, or aggregation (daily/weekly bucketing) — raw per-session points only.
- No change to how WPM is computed or stored (`type_data.wpm` at completion time).
- No client-side fetching of completions — data is always fetched server-side under RLS and passed as props.

## Implementation Approach

Add a `progressService.ts` that returns the user's Focus Sprint WPM series in chronological order. Build one reusable `ProgressChart` React component (Recharts) with a `variant` for full (results) vs. compact (dashboard) rendering and an optional `goalWpm` prop for the reference line. Mount it with **`client:only="react"`** — Recharts relies on browser-only APIs (ResizeObserver via `ResponsiveContainer`) and should not be SSR'd on Cloudflare Workers. The results page and dashboard fetch the series server-side, gate on `points.length >= 2`, and render either the chart or a placeholder.

## Critical Implementation Details

- **Recharts must not be server-rendered.** Astro would attempt to SSR a `client:load` island; Recharts' `ResponsiveContainer` needs a DOM/ResizeObserver and can throw or warn under Workers SSR. Mount the island with `client:only="react"` so it renders only in the browser, and give its container an explicit height so layout doesn't collapse before hydration.
- **Chronological order for the series.** The DB index is `completed_at DESC`; the chart needs ascending order (oldest → newest, current last). Query `DESC` + `.limit`-free for "all sessions," then reverse in the service, or order ascending in the query — pick one and keep the current session as the final point.
- **Goal line only when set.** `targetWpm` may be null; pass it through and render `<ReferenceLine>` only when non-null, mirroring the existing goal-comparison null handling.

## Phase 1: Progress data service and types

### Overview

Add a service that returns the authenticated user's Focus Sprint WPM series (chronological) and a shared type, reusing the existing completions index and RLS.

### Changes Required:

#### 1. Progress point type

**File**: `src/types.ts`

**Intent**: Add a small serializable type for a single chart point so the service, the island, and the pages share one shape.

**Contract**: `export interface ProgressPoint { completedAt: string; wpm: number; }` (ISO string + numeric WPM). No change to existing types.

#### 2. Progress service

**File**: `src/lib/services/progressService.ts` (new)

**Intent**: Fetch all of a user's `focus_sprint` completions and map them to `ProgressPoint[]` in chronological (oldest→newest) order, so the last element is the most recent session.

**Contract**: `export async function getFocusSprintProgress(supabase: SupabaseClient, userId: string): Promise<ProgressPoint[]>`. Query `exercise_completions` selecting `type_data, completed_at` joined via `exercises!inner(exercise_type)` filtered to `exercise_type = 'focus_sprint'` and `user_id = userId`, ordered by `completed_at` ascending. Use the `result` variable pattern; on `result.error` return `[]`. Map each row to `{ completedAt, wpm: type_data.wpm ?? 0 }`, dropping rows with no numeric `wpm`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- N/A (covered by later phases' integration tests)

---

## Phase 2: Recharts dependency and ProgressChart island

### Overview

Install Recharts and build one reusable React chart component used by both the results page and the dashboard.

### Changes Required:

#### 1. Add Recharts dependency

**File**: `package.json`

**Intent**: Add Recharts as a runtime dependency for the chart island.

**Contract**: Install via `npm install recharts` (a React-19-compatible version). No other dependency changes.

#### 2. ProgressChart component

**File**: `src/components/dashboard/ProgressChart.tsx` (new)

**Intent**: Render a WPM line chart from `ProgressPoint[]`, with an optional horizontal goal reference line and a `variant` controlling full (results) vs. compact (dashboard mini-trend) sizing. The component assumes ≥2 points (parents gate cold-start); it does not fetch data.

**Contract**: `interface Props { points: ProgressPoint[]; goalWpm?: number | null; variant?: "full" | "compact" }`. Uses Recharts `ResponsiveContainer` + `LineChart` with a WPM `Line`, X axis derived from session order/date, Y axis for WPM, and a `ReferenceLine y={goalWpm}` rendered only when `goalWpm` is a positive number. `compact` hides axes/labels and uses a shorter fixed height; `full` shows axes and a tooltip. Style to match the app's glass/cosmic theme (Tailwind classes on the wrapper). The most recent point is visually emphasized (e.g. active dot).

### Success Criteria:

#### Automated Verification:

- Dependency installs and lockfile updates: `npm install`
- Type checking passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- Rendering the component with ≥2 mock points shows a line; with a `goalWpm` prop a horizontal reference line appears.

---

## Phase 3: Focus Sprint results page integration

### Overview

On Focus Sprint results, fetch the WPM series + goal server-side and render the chart, goal line, or the <2-session placeholder.

### Changes Required:

#### 1. Results page data + render

**File**: `src/pages/results/[id].astro`

**Intent**: For `focus_sprint` completions, load the progress series via `getFocusSprintProgress` and reuse the already-fetched `targetWpm`, then render a "Progress" card containing the `ProgressChart` (when ≥2 points) or an encouraging placeholder (when <2). Non-`focus_sprint` results are unchanged.

**Contract**: Add a server-side call to `getFocusSprintProgress(supabase, user.id)` guarded by the existing `showGoalComparison`/`focus_sprint` gate. Render a new card near the goal-comparison block: if `points.length >= 2`, mount `<ProgressChart points={points} goalWpm={targetWpm} variant="full" client:only="react" />` inside a fixed-height container; else render a placeholder message ("Complete another Focus Sprint to see your progress trend"). Follow existing null-check and `result` conventions; `user_id` derives from `Astro.locals.user`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- A user with ≥2 Focus Sprint completions sees the trend chart on the results page; the current session is the last point.
- A user with 1 Focus Sprint completion sees the placeholder, not a broken/empty chart.
- With a goal set, the goal reference line appears; with no goal, no reference line and no error.
- Animated Pacer and Speed Scan results show no chart and are visually unchanged.

**Implementation Note**: After automated verification passes, pause for human confirmation of the manual results-page checks before proceeding to Phase 4.

---

## Phase 4: Dashboard mini-trend

### Overview

Show a compact version of the same Focus Sprint WPM trend on the dashboard, near the goal widget.

### Changes Required:

#### 1. Dashboard data + render

**File**: `src/pages/dashboard.astro`

**Intent**: Fetch the Focus Sprint progress series server-side and render a compact `ProgressChart` in the header card next to `GoalWidget`, with the same ≥2-session gating and placeholder; reuse the already-fetched `currentGoal` for the goal line.

**Contract**: Add `getFocusSprintProgress(supabase, user.id)` alongside the existing goal/latest-WPM fetches. In the header card, when `points.length >= 2` render `<ProgressChart points={points} goalWpm={currentGoal} variant="compact" client:only="react" />`; otherwise render a small placeholder (or render nothing beyond the existing widget — placeholder preferred for discoverability). No change to exercise-card logic.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- Dashboard shows a compact WPM trend for users with ≥2 Focus Sprint sessions; placeholder for fewer.
- Dashboard still renders exercise cards and the goal widget with no layout regressions.

**Implementation Note**: After automated verification passes, pause for human confirmation of the dashboard checks before proceeding to Phase 5.

---

## Phase 5: Integration tests

### Overview

Cover the chart's data-driven states with real local Supabase + HTTP, following the golden cookie-injection pattern.

### Changes Required:

#### 1. Progress chart integration test

**File**: `tests/integration/progress-chart.test.ts` (new)

**Intent**: Verify the results page renders the chart container when a user has ≥2 Focus Sprint completions and the placeholder when they have fewer, and that the dashboard renders the mini-trend for ≥2 sessions. Assert on server-rendered markup (the island's mount point / placeholder text), not on Recharts internals (which render only client-side under `client:only`).

**Contract**: Mirror `completion-pipeline.test.ts` / `dashboard-coldstart.test.ts`: `createFixtureUser`, sign in via `/api/auth/signin`, collect + strip cookies. Seed completions via `adminClient` against Focus Sprint exercise instances with varied `completed_at` and `type_data.wpm`. Cases: (a) 2+ Focus Sprint completions → results page for the latest completion contains the chart mount/section and no stack trace; (b) 1 completion → results page contains the placeholder text, not the chart mount; (c) dashboard with 2+ completions contains the mini-trend mount. Clean up with `deleteFixtureUsers` in `afterAll`. Assert placeholder/mount via stable text or a `data-*`/id hook added to the render in Phases 3-4.

### Success Criteria:

#### Automated Verification:

- New tests pass: `npm run test` (requires local Supabase running + dev/preview server per existing test setup)
- Full suite still green: `npm run test`
- Linting passes: `npm run lint`

#### Manual Verification:

- Tests are deterministic across re-runs (unique fixture emails; cleanup verified).

**Implementation Note**: After automated verification passes, pause for human confirmation before considering the slice complete.

---

## Testing Strategy

### Unit Tests:

- Not the codebase convention for this layer; service correctness is exercised through the integration tests (real Supabase). If desired, `getFocusSprintProgress` ordering/mapping can be unit-tested with a mocked client, but integration coverage is primary.

### Integration Tests:

- Results page: ≥2 sessions → chart section present; 1 session → placeholder present; goal line path exercised when a goal exists.
- Dashboard: ≥2 sessions → mini-trend present.
- Cold-start: brand-new user (0 completions) → placeholder, 200, no stack trace.

### Manual Testing Steps:

1. As a fresh user, complete one Focus Sprint → results page shows the placeholder (no chart).
2. Complete a second Focus Sprint → results page shows the 2-point trend, current session last.
3. Set a WPM goal on the dashboard, complete another Focus Sprint → results chart shows the goal reference line.
4. Visit the dashboard → compact mini-trend renders next to the goal widget.
5. Complete an Animated Pacer and a Speed Scan → their results pages show no chart and are unchanged.

## Performance Considerations

- "All Focus Sprint sessions ever" is bounded by a single user's completion count and served by the `(user_id, completed_at DESC)` index; payload is small (two fields per row). If a power user ever accumulates a very large history, a future `.limit()`/aggregation can be added without schema change — out of scope here.
- `client:only="react"` avoids SSR cost for Recharts and keeps the initial HTML light; the chart hydrates after load inside a fixed-height container to prevent layout shift.

## Migration Notes

- None. No schema changes; reads rely on existing table, index, and RLS.

## References

- Research: `context/changes/progress-chart/research.md`
- Closest analog: `context/archive/2026-07-27-goal-comparison/plan.md` (progress display on Focus Sprint results, cold-start CTA, WPM gating rationale)
- Insertion point: `src/pages/results/[id].astro:26-71`
- Query shape: `src/pages/dashboard.astro:28-37`
- Golden test: `tests/integration/completion-pipeline.test.ts`; cold-start template: `tests/integration/dashboard-coldstart.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Progress data service and types

#### Automated

- [ ] 1.1 Type checking passes: `npm run build`
- [ ] 1.2 Linting passes: `npm run lint`

### Phase 2: Recharts dependency and ProgressChart island

#### Automated

- [ ] 2.1 Dependency installs and lockfile updates: `npm install`
- [ ] 2.2 Type checking passes: `npm run build`
- [ ] 2.3 Linting passes: `npm run lint`

#### Manual

- [ ] 2.4 Component renders a line with ≥2 mock points; goal reference line appears when `goalWpm` is passed

### Phase 3: Focus Sprint results page integration

#### Automated

- [ ] 3.1 Type checking passes: `npm run build`
- [ ] 3.2 Linting passes: `npm run lint`

#### Manual

- [ ] 3.3 ≥2 Focus Sprint completions → trend chart shows, current session is last point
- [ ] 3.4 1 completion → placeholder shown, not a broken chart
- [ ] 3.5 Goal set → reference line appears; no goal → no line, no error
- [ ] 3.6 Animated Pacer and Speed Scan results unchanged (no chart)

### Phase 4: Dashboard mini-trend

#### Automated

- [ ] 4.1 Type checking passes: `npm run build`
- [ ] 4.2 Linting passes: `npm run lint`

#### Manual

- [ ] 4.3 Dashboard shows compact trend for ≥2 sessions; placeholder for fewer
- [ ] 4.4 Exercise cards + goal widget render with no layout regressions

### Phase 5: Integration tests

#### Automated

- [ ] 5.1 New tests pass: `npm run test`
- [ ] 5.2 Full suite still green: `npm run test`
- [ ] 5.3 Linting passes: `npm run lint`

#### Manual

- [ ] 5.4 Tests deterministic across re-runs (unique fixtures; cleanup verified)
