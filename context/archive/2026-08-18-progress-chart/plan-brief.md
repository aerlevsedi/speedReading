# Progress Chart (S-05) — Plan Brief

> Full plan: `context/changes/progress-chart/plan.md`
> Research: `context/changes/progress-chart/research.md`

## What & Why

Users can see their reading speed but have no view of whether it's trending up over time. S-05 adds a **Focus Sprint WPM progress chart** (PRD FR-014) that compares the current session to all previous Focus Sprint sessions — on the results page and as a compact mini-trend on the dashboard — closing the "visible progress" gap in the PRD Vision.

## Starting Point

The results page (`src/pages/results/[id].astro`) already fetches the current completion server-side and gates a goal-comparison card to Focus Sprint ("user-paced, true WPM baseline"). `exercise_completions` stores `type_data.wpm` with owner-only RLS and a purpose-built `(user_id, completed_at DESC)` index whose comment names the progress chart. No charting library is installed.

## Desired End State

On a Focus Sprint results page, a user with ≥2 sessions sees a WPM line chart (current session last, highlighted), with a horizontal goal line when a goal is set; with <2 sessions they see an encouraging placeholder. The dashboard shows a compact version of the same trend near the goal widget. Animated Pacer and Speed Scan results are unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Metric | Focus Sprint WPM only | Only Focus Sprint reflects the user's own pace; Animated Pacer WPM is pacer-imposed and Speed Scan has none | Research + Plan |
| Rendering | Recharts, React island | User chose richer axes/tooltips over a custom SVG | Plan |
| Island mode | `client:only="react"` | Recharts needs browser APIs (ResizeObserver); avoids Workers SSR issues | Plan |
| Range | All Focus Sprint sessions ever | User wants the full trend, not a fixed window | Plan |
| Cold-start | Placeholder until ≥2 sessions | A trend line needs ≥2 points to be meaningful | Plan |
| Placement | Results page + dashboard mini-trend | User wants it on results and a compact dashboard view | Plan |
| Goal integration | Overlay goal reference line when set | Ties the trend to the existing goal-comparison feature | Plan |
| Data access | Server-side service under RLS | Matches codebase convention; `user_id` from session | Research |

## Scope

**In scope:**
- `ProgressPoint` type + `progressService.getFocusSprintProgress` (chronological WPM series)
- `recharts` dependency + reusable `ProgressChart` island (full + compact variants, optional goal line)
- Focus Sprint results page: chart / goal line / <2-session placeholder
- Dashboard: compact mini-trend near the goal widget
- Integration tests (≥2-session chart, <2 placeholder, dashboard trend, cold-start)

**Out of scope:**
- Charts for Animated Pacer / Speed Scan
- Any DB migration (reads use existing table, index, RLS)
- Per-type or historical goals; date-range/zoom/export; daily/weekly aggregation
- Client-side fetching of completions

## Architecture / Approach

A new `progressService.ts` returns the user's Focus Sprint WPM series in chronological order (reusing the existing completions index + RLS). One `ProgressChart` React component (Recharts) renders it, with a `variant` for full (results) vs. compact (dashboard) and an optional `goalWpm` reference line. Both pages fetch the series server-side, gate on `points.length >= 2`, and render the island (`client:only="react"`) or a placeholder.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Service + types | `getFocusSprintProgress` + `ProgressPoint` | Correct chronological ordering (index is DESC) |
| 2. Recharts + `ProgressChart` | Dependency + reusable chart island | React 19 / Cloudflare Workers SSR compatibility |
| 3. Results integration | Chart / goal line / placeholder on Focus Sprint results | Island must not leak to other exercise types |
| 4. Dashboard mini-trend | Compact trend near goal widget | Layout regression in header card |
| 5. Integration tests | Data-state coverage via real Supabase + HTTP | Asserting mount/placeholder markup, not client-only Recharts internals |

**Prerequisites:** S-01 done (completions history + WPM stored). Local Supabase running for tests.
**Estimated effort:** ~2 sessions across 5 phases.

## Open Risks & Assumptions

- Recharts must render only client-side (`client:only="react"`) — SSR under Workers could throw on `ResponsiveContainer`; verify at Phase 2.
- Integration tests assert on server-rendered mount/placeholder markup (add a stable `data-*`/id hook), since Recharts renders only after hydration.
- "All sessions ever" is bounded per user and index-served; a future `.limit()` can be added without schema change if histories grow large.

## Success Criteria (Summary)

- A user with ≥2 Focus Sprint sessions sees a correct WPM trend (current session last) on results and a compact trend on the dashboard.
- With a goal set, the goal reference line appears; with <2 sessions, a placeholder shows instead of a broken chart.
- Animated Pacer and Speed Scan results are unchanged; lint, build, and integration tests pass.
