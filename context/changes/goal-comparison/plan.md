# Goal Setting and Comparison Implementation Plan

## Overview

Add the ability for users to set a global reading speed goal (WPM) and see goal comparison on the results page after completing an Animated Pacer exercise. The goal is stored per-user in a new `user_goals` table, editable inline on the dashboard, and displayed as a progress bar with percentage on the results page.

## Current State Analysis

- `src/pages/results/[id].astro` — shows Duration, WPM, and Comprehension cards. No goal comparison exists.
- `src/pages/dashboard.astro` — shows exercise cards and user email. No goal display.
- No `user_goals` table, no `profiles` table — goal storage is entirely absent from the DB.
- No API endpoints for goals.
- WPM is computed and stored in `exercise_completions.type_data.wpm` for `focus_sprint` and `focus_sprint`. Results page already conditionally shows WPM (`showWpm` flag, line 53).
- Supabase client pattern: `const result = await supabase...` then `result.data` / `result.error` (codebase-wide convention per lessons.md).
- `createClient` returns null on missing env vars — all callers null-check before use (lessons.md).
- `user_id` is always derived from `context.locals.user` / `Astro.locals.user`, never from client input (lessons.md security rule).

### Key Discoveries:

- `src/pages/results/[id].astro:53` — `showWpm` already gates WPM display to `focus_sprint` and `focus_sprint`; goal comparison will additionally gate on `focus_sprint` only.
- `src/pages/dashboard.astro:10` — supabase client created on every page load; the goal + latest WPM query fits naturally in the same server block.
- `supabase/migrations/` — three existing migrations; new goal migration will be `20260727000000_create_user_goals.sql`.
- shadcn/ui Progress component exists at `src/components/ui/progress.tsx` (standard shadcn — verify it's installed; if not, add with `npx shadcn@latest add progress`).
- `src/types.ts` — two interfaces (`Exercise`, `Completion`); `UserGoal` needs to be added.

## Desired End State

- User can see and edit their WPM goal in the dashboard header area (shows current goal or "Set goal" prompt; inline edit input with hint ranges).
- Dashboard also shows their latest Animated Pacer WPM alongside the goal.
- After completing an Animated Pacer exercise, the results page shows a progress bar: `{actual} wpm / {goal} wpm — {pct}%`.
- If no goal is set, the results page shows a "Set your reading speed goal" CTA linking to the dashboard.
- Goal can be any integer 50–1000; server rejects values outside this range.
- Goal persists across sessions (stored in Supabase, fetched server-side on each page render).

### Key Discoveries:

- `src/types.ts` — add `UserGoal` interface (id, user_id, target_wpm, created_at, updated_at).
- `src/pages/results/[id].astro:39` — `wpm` already computed; goal comparison block slots in after the existing WPM card.
- shadcn Progress component must be verified/installed before Phase 4.

## What We're NOT Doing

- Goals for Focus Sprint, Speed Scan, or any future exercise type — only Animated Pacer uses the global WPM goal.
- Per-exercise-type goal setting — one global WPM target per user only.
- Goal history / goal change log.
- Progress chart across sessions (S-05 is separate).
- Separate GET /api/goals — goal is always fetched server-side in the Astro pages, never via client fetch.

## Implementation Approach

Single-responsibility phases: schema first (no code changes until DB is ready), then API, then dashboard UI, then results page. Each phase is independently verifiable. The dashboard goal widget is a React island (needs client interactivity for inline edit); the results page goal block is static server-rendered Astro (no interactivity needed).

---

## Phase 1: DB Migration and Types

### Overview

Create the `user_goals` table with RLS and add the `UserGoal` TypeScript interface. No application code changes — just the foundation.

### Changes Required:

#### 1. Supabase migration

**File**: `supabase/migrations/20260727000000_create_user_goals.sql`

**Intent**: Create `user_goals` table storing one WPM goal per user. Enable RLS with policies allowing authenticated users to select and upsert their own row only.

**Contract**:

```sql
CREATE TABLE user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_wpm INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX user_goals_user_id_unique ON user_goals (user_id);

ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own goal"
  ON user_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users can upsert own goal"
  ON user_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own goal"
  ON user_goals FOR UPDATE
  USING (auth.uid() = user_id);
```

The unique index on `user_id` enforces one-goal-per-user at the DB level and enables `ON CONFLICT (user_id) DO UPDATE` upsert in Phase 2.

#### 2. UserGoal type

**File**: `src/types.ts`

**Intent**: Add `UserGoal` interface so all callers share one canonical shape.

**Contract**: Add after the `Completion` interface:

```typescript
interface UserGoal {
  id: string;
  user_id: string;
  target_wpm: number;
  created_at: string;
  updated_at: string;
}
```

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly against local Supabase: `npx supabase db reset` (or `npx supabase migration up`)
- TypeScript build passes with new type: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- `user_goals` table visible in local Supabase Studio
- Attempting to insert a row for a different `user_id` via Supabase Studio is blocked by RLS

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Goal API Endpoint

### Overview

Single `POST /api/goals/set` endpoint that upserts (creates or updates) the authenticated user's WPM goal. Server-side validation: 50–1000 wpm range. User ID always from session.

### Changes Required:

#### 1. Goal upsert endpoint

**File**: `src/pages/api/goals/set.ts`

**Intent**: Accept a `target_wpm` form field, validate it's an integer in [50, 1000], then upsert into `user_goals`. Return JSON `{ success: true }` on success or `{ error: "..." }` with an appropriate status code on failure.

**Contract**: Export a `POST` handler (Astro API route convention). Extract `target_wpm` from FormData, parse as integer. Null-check `createClient`. Derive `user_id` from `context.locals.user.id` — never from client input. Upsert using:

```typescript
const result = await supabase
  .from("user_goals")
  .upsert({ user_id: user.id, target_wpm: wpm, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
```

Return `{ error: "target_wpm must be between 50 and 1000" }` with status 400 for out-of-range values. Return 401 if no user in session. Return 500 on Supabase error.

### Success Criteria:

#### Automated Verification:

- `npm run build` passes (type checks API route)
- `npm run lint` passes

#### Manual Verification:

- `curl -X POST /api/goals/set -d "target_wpm=300"` (authenticated) returns `{ success: true }`
- Subsequent POST with `target_wpm=500` updates the row (not duplicate)
- `target_wpm=30` returns 400
- `target_wpm=1500` returns 400
- Unauthenticated POST returns 401

**Implementation Note**: Pause for manual API testing before proceeding.

---

## Phase 3: Dashboard Goal Widget

### Overview

Add a goal display + inline edit to the dashboard. Shows current goal (or "Set goal" prompt), latest Animated Pacer WPM, and a hint-range input for editing. Implemented as a React island (`GoalWidget`) since inline edit requires client interactivity.

### Changes Required:

#### 1. Server-side goal and latest WPM fetch

**File**: `src/pages/dashboard.astro`

**Intent**: Fetch the user's current goal and their most recent Animated Pacer completion WPM server-side, then pass both to the `GoalWidget` React island as props.

**Contract**: After the existing `createClient` null-check and before the exercise fetches, add two Supabase queries:

1. `user_goals` — select `target_wpm` where `user_id = user.id`, single row (may be null).
2. `exercise_completions` — join `exercises`, filter `user_id = user.id` and `exercise_type = 'focus_sprint'`, order by `completed_at DESC`, limit 1 — extract `type_data.wpm`.

Use the `result` pattern per lessons.md. Both queries should be non-blocking on failure (treat null as "no data").

#### 2. GoalWidget React component

**File**: `src/components/dashboard/GoalWidget.tsx`

**Intent**: Display the user's current goal and latest WPM; allow inline editing of the goal with a single click on an edit icon. On save, POST to `/api/goals/set` and refresh the displayed value without a full page reload.

**Contract**:
- Props: `{ currentGoal: number | null, latestWpm: number | null }`
- Display state: "Goal: {n} wpm — Last: {m} wpm [edit icon]" when both set; "Set your reading speed goal [input]" when no goal
- Edit mode: text input (number type, min 50, max 1000) + save/cancel buttons
- Below the input, show hint text: `Beginner: 200–250 wpm · Intermediate: 300–400 wpm · Advanced: 400+ wpm`
- On save: POST FormData to `/api/goals/set`, update local state on success; show inline error message on API failure
- No page navigation on save — state update only

#### 3. Dashboard layout integration

**File**: `src/pages/dashboard.astro`

**Intent**: Render `<GoalWidget>` in the dashboard header card, below the welcome text and above the sign-out button.

**Contract**: Import `GoalWidget` and render with `client:load`, passing `currentGoal` and `latestWpm` props fetched in change 1.

### Success Criteria:

#### Automated Verification:

- `npm run build` passes
- `npm run lint` passes

#### Manual Verification:

- Dashboard shows "Set your reading speed goal" prompt when no goal is set
- Clicking the prompt/edit icon opens inline input with hint ranges visible
- Entering 300 and saving shows "Goal: 300 wpm" without page reload
- Entering 30 shows an error message (client-side range check before POST; server also rejects)
- Dashboard shows "Last: {n} wpm" after user has at least one Animated Pacer completion
- Edit persists after page refresh (goal fetched from DB)

**Implementation Note**: Pause for manual UI testing before proceeding.

---

## Phase 4: Results Page Goal Comparison

### Overview

On the results page, for Animated Pacer completions: fetch the user's goal server-side, and render a progress bar showing actual vs. goal WPM with percentage. If no goal is set, render a "Set your reading speed goal" CTA linking to the dashboard.

### Changes Required:

#### 1. Verify/install shadcn Progress component

**File**: `src/components/ui/progress.tsx`

**Intent**: Ensure the shadcn Progress component is available. If absent, install it before writing the results page changes.

**Contract**: Run `npx shadcn@latest add progress` if `src/components/ui/progress.tsx` does not exist.

#### 2. Server-side goal fetch on results page

**File**: `src/pages/results/[id].astro`

**Intent**: After the existing completion fetch, fetch the user's goal from `user_goals`. Treat null (no goal set) as a flag to show the CTA instead of the bar.

**Contract**: Add one Supabase query after the completion fetch using the `result` pattern. Extract `target_wpm` or leave as null.

#### 3. Goal comparison block in results template

**File**: `src/pages/results/[id].astro`

**Intent**: Add a goal comparison section below the metrics grid, visible only on Animated Pacer completions. Shows progress bar + percentage if goal is set; shows "Set your reading speed goal" CTA linking to `/dashboard` if no goal is set.

**Contract**:
- Gating condition: `exercise.exercise_type === 'focus_sprint'` (not `showWpm` — goal applies to Focus Sprint only, not Focus Sprint)
- When goal set: display label "Reading Speed Goal", Progress component value = `Math.min((wpm / targetWpm) * 100, 100)`, text below: `{wpm} wpm / {targetWpm} wpm — {pct}%` (cap pct display at 100% even if over goal; optionally show "Goal reached!" when over)
- When no goal: render a card or banner with text "Set your reading speed goal to track your progress" + link `<a href="/dashboard">Set goal</a>`

### Success Criteria:

#### Automated Verification:

- `npm run build` passes
- `npm run lint` passes

#### Manual Verification:

- Completing an Animated Pacer exercise with a goal set shows the progress bar with correct WPM and percentage
- Progress bar correctly shows a partial fill (e.g., 250 wpm / 400 wpm = 62.5% fill)
- Over-goal result (e.g., 450 wpm / 400 wpm) shows bar at 100% fill and "Goal reached!" text
- Completing an Animated Pacer exercise with NO goal set shows the CTA, not the bar
- Clicking the CTA navigates to `/dashboard`
- Focus Sprint and Speed Scan results do NOT show the goal section (exercise type gate)

**Implementation Note**: Pause for full end-to-end manual verification before marking done.

---

## Testing Strategy

### Manual Testing Steps:

1. Reset goal (delete from Supabase Studio or use a fresh test user)
2. Load dashboard — confirm "Set your reading speed goal" prompt appears
3. Set goal to 300 wpm — confirm it persists after page reload
4. Complete an Animated Pacer exercise — confirm progress bar appears on results
5. Complete a Focus Sprint exercise — confirm NO goal section appears
6. Edit goal to 50 (minimum) and 1000 (maximum) — confirm both save correctly
7. Try goal = 30 via curl — confirm 400 response
8. Delete goal from DB — confirm CTA appears on next Animated Pacer results page

## Performance Considerations

Two additional Supabase queries on dashboard load (goal + latest WPM); one additional query on results load (goal). All are indexed single-row lookups — negligible latency impact.

## Migration Notes

No existing data migration needed. `user_goals` is a new table; existing users simply have no row until they set a goal. The application handles null gracefully throughout.

## References

- Roadmap: `context/foundation/roadmap.md` (S-03)
- PRD: `context/foundation/prd.md` (FR-015, FR-016, FR-017)
- Results page: `src/pages/results/[id].astro`
- Dashboard: `src/pages/dashboard.astro`
- Lessons: `context/foundation/lessons.md`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: DB Migration and Types

#### Automated

- [x] 1.1 Migration applies cleanly against local Supabase — 034350e
- [x] 1.2 TypeScript build passes with new UserGoal type — 034350e
- [x] 1.3 Linting passes — 034350e

#### Manual

- [x] 1.4 user_goals table visible in Supabase Studio — 034350e
- [x] 1.5 RLS blocks insert for wrong user_id — 034350e

### Phase 2: Goal API Endpoint

#### Automated

- [x] 2.1 npm run build passes — 5850827
- [x] 2.2 npm run lint passes — 5850827

#### Manual

- [x] 2.3 Authenticated POST with valid wpm returns success — 5850827
- [x] 2.4 Subsequent POST updates row (upsert, no duplicate) — 5850827
- [x] 2.5 Out-of-range values return 400 — 5850827
- [x] 2.6 Unauthenticated POST returns 401 — 5850827

### Phase 3: Dashboard Goal Widget

#### Automated

- [x] 3.1 npm run build passes — 3b697d2
- [x] 3.2 npm run lint passes — 3b697d2

#### Manual

- [x] 3.3 Dashboard shows "Set goal" prompt when no goal set — 3b697d2
- [x] 3.4 Inline edit with hint ranges opens on click — 3b697d2
- [x] 3.5 Saving updates display without page reload — 3b697d2
- [x] 3.6 Out-of-range input shows error message — 3b697d2
- [x] 3.7 Latest Focus Sprint WPM shown alongside goal — 3b697d2
- [x] 3.8 Goal persists after page refresh — 3b697d2

### Phase 4: Results Page Goal Comparison

#### Automated

- [x] 4.1 npm run build passes — cb1ff57
- [x] 4.2 npm run lint passes — cb1ff57

#### Manual

- [x] 4.3 Focus Sprint with goal set shows correct progress bar and percentage — cb1ff57
- [x] 4.4 Over-goal result shows 100% bar and "Goal reached!" — cb1ff57
- [x] 4.5 Focus Sprint with no goal shows CTA linking to dashboard — cb1ff57
- [x] 4.6 Animated Pacer and Speed Scan results show no goal section — cb1ff57
