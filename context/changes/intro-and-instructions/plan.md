# Intro and Instructions Implementation Plan

## Overview

Add first-time onboarding intro modals for each exercise type and a persistent `?` button for returning users. On first visit to an exercise, a modal explains the purpose, mechanics, and scoring. A checkbox "Don't show this again" — when ticked and the modal dismissed — persists the preference to Supabase. The `?` button stays visible in the top-right corner throughout every exercise session, letting users re-read the instructions at any time.

## Current State Analysis

- `ExerciseFlow.tsx` is the single router component that all 3 exercise types pass through. It currently only manages `isComplete` state and auto-submits the completion form. It accepts one prop: `exercise: Exercise`.
- `exercise/[id].astro` fetches the exercise from Supabase and passes it to `ExerciseFlow` via `client:load`. It already has a null-checked Supabase client and an authenticated user in `context.locals.user`.
- No modal/dialog component exists in `src/components/ui/`. shadcn Dialog must be installed.
- No `localStorage` is used anywhere — Supabase is the only persistence mechanism.
- The `user_goals` table is the only user-profile-like table; it has a nullable row (new users may have no row). A separate `user_intro_views` table is cleaner and avoids coupling intro state to goal state.
- `src/types.ts` has `UserGoal` but no intro-related type.

### Key Discoveries

- `ExerciseFlow.tsx:34–36` — before `isComplete`, renders the exercise component directly. This is where the modal gate and `?` button wrap goes.
- `exercise/[id].astro:53` — the `<ExerciseFlow exercise={exercise} client:load />` call. Adding a `seenIntros` prop here keeps the intro check server-side (no client-side loading flicker).
- `src/pages/api/goals/set.ts` — canonical pattern for user-scoped API endpoints: FormData, `context.locals.user`, null-checked Supabase client, JSON response.
- `src/types.ts` — clean interface for the new `UserIntroView` DB entity.
- Lessons: always null-check `createClient`; always derive `user_id` from session, never client input; use `result` variable pattern for Supabase queries.

## Desired End State

When a user navigates to `/exercise/{id}` for the first time for that exercise type, a centered shadcn Dialog opens automatically. It shows purpose, mechanics, and scoring for the exercise. A checkbox "Don't show this again" is unchecked by default. When the user ticks the checkbox and clicks "Start Exercise", the preference is saved to `user_intro_views` and the dialog closes. If the checkbox is unticked on dismiss, the modal will appear again next visit. A `?` button in the top-right corner of the exercise page is always visible and re-opens the same modal on demand.

### Key Discoveries

- All 3 types route through `ExerciseFlow.tsx` — inject once, covers all.
- `user_intro_views` is a new table keyed on `(user_id, exercise_type)`.
- `seenIntros: string[]` is fetched server-side in `exercise/[id].astro` and passed as prop to `ExerciseFlow`.

## What We're NOT Doing

- No localStorage usage — Supabase only.
- No intro content for `smart_questions` — it is not routed to on the dashboard and is deprecated.
- No per-dataset intros — intro is per exercise type, not per dataset.
- No timer pause when `?` modal opens mid-exercise — timer continues (this is intentional; instructions are reference, not a break).
- No animation or multi-step walkthrough — single-page modal only.
- No backend validation of exercise_type beyond the DB constraint.

## Implementation Approach

Three sequential phases:

1. **Data layer** — migration + RLS + API endpoint + SSR query + type update
2. **UI component** — install shadcn Dialog, build `ExerciseIntroModal` with content for all 3 types
3. **Integration** — wire `ExerciseFlow` to accept `seenIntros` prop, render modal gate + `?` button

## Critical Implementation Details

**Prop threading**: `exercise/[id].astro` is SSR — the `seenIntros` array must be fetched there and passed to `ExerciseFlow` as a serialized prop (Astro serializes arrays to JSON for `client:load` islands automatically). Do not fetch `seenIntros` inside `ExerciseFlow` with a `useEffect` — that creates a loading flicker and requires exposing auth to the client component.

**Modal does not pause the exercise timer**: The timer in each exercise component (`useExerciseTimer`) starts when the component mounts. The intro modal is shown *before* the exercise component renders (the gate renders either the modal or the exercise, never both). When the `?` button re-opens the modal mid-exercise, the timer is already running in the background — this is acceptable and intentional.

**DB upsert semantics**: `user_intro_views` uses `(user_id, exercise_type)` unique constraint with `ON CONFLICT DO UPDATE SET seen_at = now()`. The API marks a type as seen only when the checkbox is ticked on dismiss — calling the endpoint means "mark this type as seen."

---

## Phase 1: Data Layer

### Overview

Create the `user_intro_views` table, add RLS policies, create the API endpoint to mark a type as seen, update the SSR exercise page to fetch seen intros, and add the TypeScript type.

### Changes Required

#### 1. New migration: `user_intro_views` table

**File**: `supabase/migrations/20260910000000_create_user_intro_views.sql`

**Intent**: Create a table tracking which exercise types each user has dismissed with "don't show again". Each row is one `(user_id, exercise_type)` pair with a timestamp.

**Contract**:
```sql
CREATE TABLE public.user_intro_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_type text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_type)
);

ALTER TABLE public.user_intro_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own intro views"
  ON public.user_intro_views FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own intro views"
  ON public.user_intro_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own intro views"
  ON public.user_intro_views FOR UPDATE
  USING (auth.uid() = user_id);
```

#### 2. API endpoint: mark intro as seen

**File**: `src/pages/api/intros/mark-seen.ts`

**Intent**: POST endpoint that records the user has seen the intro for a given exercise type with "don't show again" checked. Upserts to handle duplicate calls gracefully.

**Contract**: Accepts `FormData` with field `exercise_type: string`. Returns `{ success: true }` or `{ error: string }`. Derives `user_id` from `context.locals.user` (never from client input). Follows the null-check pattern from `goals/set.ts`. Uses `result` variable pattern for Supabase query. Exports `prerender = false`.

#### 3. TypeScript type: `UserIntroView`

**File**: `src/types.ts`

**Intent**: Add interface for the new DB entity so the SSR query is typed.

**Contract**: Add after `UserGoal`:
```ts
export interface UserIntroView {
  id: string;
  user_id: string;
  exercise_type: string;
  seen_at: string;
}
```

#### 4. SSR query in exercise page

**File**: `src/pages/exercise/[id].astro`

**Intent**: After fetching the exercise, query `user_intro_views` for the current user and derive a `seenIntros: string[]` array. Pass it as a prop to `ExerciseFlow`.

**Contract**: Query `user_intro_views` filtered by `user_id = user.id`, select only `exercise_type`. Map to `string[]`. On query error, default to `[]` (fail open — worst case is user sees intro again). Update the `<ExerciseFlow>` call to `<ExerciseFlow exercise={exercise} seenIntros={seenIntros} client:load />`.

#### 5. Update `ExerciseFlow` Props interface

**File**: `src/components/exercise/ExerciseFlow.tsx`

**Intent**: Accept the new `seenIntros` prop so the component can decide whether to show the intro modal on mount.

**Contract**: Add `seenIntros: string[]` to the `Props` interface. No logic changes in this phase — that's Phase 3.

### Success Criteria

#### Automated Verification

- Migration applies cleanly against local Supabase: `npx supabase db reset`
- TypeScript compiles without errors: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification

- `user_intro_views` table exists in local Supabase Studio with correct columns and RLS policies
- POST to `/api/intros/mark-seen` with `exercise_type=animated_pacer` returns `{"success":true}`
- POST without auth returns 401
- Navigating to `/exercise/{id}` doesn't error (seenIntros defaults to `[]` on failure)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Intro Modal Component

### Overview

Install shadcn Dialog, build `ExerciseIntroModal` with content for all 3 exercise types, and export it from the exercise component directory.

### Changes Required

#### 1. Install shadcn Dialog

**File**: no file to edit — run `npx shadcn@latest add dialog` to generate `src/components/ui/dialog.tsx`.

**Intent**: Add the Dialog primitive so `ExerciseIntroModal` can use it.

**Contract**: Standard shadcn Dialog install. No configuration needed.

#### 2. New component: `ExerciseIntroModal`

**File**: `src/components/exercise/ExerciseIntroModal.tsx`

**Intent**: A React component that renders the shadcn Dialog with intro content for the given exercise type. Shows a checkbox "Don't show this again" and a "Start Exercise" button. Calls `onDismiss(doNotShowAgain: boolean)` when closed.

**Contract**:

Props:
```ts
interface Props {
  exerciseType: "animated_pacer" | "focus_sprint" | "speed_scan";
  open: boolean;
  onDismiss: (doNotShowAgain: boolean) => void;
}
```

The component renders a shadcn `Dialog` with `open={open}`. Closing via the button calls `onDismiss(checkboxState)`. The dialog has no close-on-backdrop-click (hard gate — `onInteractOutside={(e) => e.preventDefault()}`).

**Content** (all 3 types, authored inline as a const map):

```
ANIMATED_PACER:
  Title: "Animated Pacer"
  Purpose: Train your brain to read at a controlled pace by following a word-by-word highlight. Reduces subvocalization and builds reading rhythm.
  How it works:
    1. Words in the passage highlight one by one at the target WPM.
    2. Use Play/Pause to control the flow.
    3. After the passage ends, answer 2 comprehension questions.
  What's measured: Your reading speed is set upfront; your score reflects comprehension accuracy (correct answers out of 2).

FOCUS_SPRINT:
  Title: "Focus Sprint"
  Purpose: Measure your natural reading speed under no external pressure. Forces you to commit to a "done reading" moment — builds awareness of when you're actually finished vs. still scanning.
  How it works:
    1. The full passage is displayed at once.
    2. Read it at your own pace, then click "Done Reading."
    3. Answer 3 comprehension questions.
  What's measured: WPM calculated from your actual reading time; score reflects comprehension accuracy (correct answers out of 3).

SPEED_SCAN:
  Title: "Speed Scan"
  Purpose: Train information location — the ability to find specific facts fast without reading every word. Essential for navigating codebases and documentation.
  How it works:
    1. Preview phase: read 3 questions about facts in the passage.
    2. Scan phase: find the answers in the text within the time limit.
    3. Recall phase: answer the questions from memory.
  What's measured: Total time across all three phases; score reflects recall accuracy (correct answers out of 3).
```

#### 3. Export from exercise index (optional, if an index file exists)

**File**: check `src/components/exercise/` for an `index.ts` — if present, add `ExerciseIntroModal` export. If absent, skip.

### Success Criteria

#### Automated Verification

- TypeScript compiles without errors: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification

- Temporarily render `<ExerciseIntroModal exerciseType="animated_pacer" open={true} onDismiss={() => {}} />` in any page and verify the modal appears with correct content
- Verify clicking "Start Exercise" with checkbox unticked calls `onDismiss(false)`
- Verify clicking "Start Exercise" with checkbox ticked calls `onDismiss(true)`
- Verify clicking the backdrop does NOT close the modal

**Implementation Note**: After this phase passes verification, pause for manual confirmation before Phase 3.

---

## Phase 3: ExerciseFlow Integration

### Overview

Wire `ExerciseFlow` to use `seenIntros`, show `ExerciseIntroModal` as a gate before the exercise starts, call the API when dismissed with checkbox ticked, and add the `?` button in the top-right corner.

### Changes Required

#### 1. Update `ExerciseFlow.tsx`

**File**: `src/components/exercise/ExerciseFlow.tsx`

**Intent**: Add intro modal gate logic and persistent `?` button. The modal shows before the exercise component mounts if the current exercise type is not in `seenIntros`. After dismiss, if `doNotShowAgain` is true, POST to `/api/intros/mark-seen`. The `?` button is always visible in the top-right corner and re-opens the modal on click.

**Contract**: New state: `showIntro: boolean` (initialized to `!seenIntros.includes(exercise.exercise_type)`), `introOpen: boolean` (same initial value). New handler `handleIntroDismiss(doNotShowAgain: boolean)`: sets `showIntro(false)`, if `doNotShowAgain` fires a `fetch` POST to `/api/intros/mark-seen` with `FormData({ exercise_type })`. New `?` button renders absolutely in the top-right of the exercise container (position relative wrapper) and sets `introOpen(true)` on click.

Render structure when `isComplete` is false:
```
<div class="relative">
  <ExerciseIntroModal
    exerciseType={exercise.exercise_type}
    open={introOpen}
    onDismiss={handleIntroDismiss}
  />
  {/* ? button — always rendered */}
  <button onClick={() => setIntroOpen(true)} className="absolute top-2 right-2 ...">
    ?
  </button>
  <ExerciseComponent exercise={exercise} onComplete={handleComplete} />
</div>
```

`ExerciseComponent` renders behind the modal when `introOpen` is true — this is fine because the Dialog is a portal and overlays correctly. The exercise component mounts immediately (no lazy mount gate) so its timer starts only after the modal closes. Wait — see note below.

**Timer gate**: Each exercise component starts its timer on mount (inside `useExerciseTimer`). To prevent the timer from starting while the modal is blocking, conditionally mount the exercise component only after `!introOpen` (i.e., render `null` when `introOpen` is true for the first-time case). For the `?` button re-open case (mid-exercise), `introOpen` is set to true again but the component remains mounted — this is acceptable since the timer continues in the background.

Revised render:
```
{!introOpen && (
  <ExerciseComponent exercise={exercise} onComplete={handleComplete} />
)}
```

This means on first visit the exercise component is not mounted until the user dismisses the modal. On `?` re-open mid-exercise, the component stays mounted (React doesn't unmount it — state is in `ExerciseFlow`, not re-evaluated on re-render).

Wait — this conditional unmounts the component every time `introOpen` becomes true (including mid-exercise re-open). Fix: use separate `showingFirstTimeGate` state for the initial case.

Final state design:
- `isFirstTimeGate: boolean` — `!seenIntros.includes(exercise.exercise_type)`, set to false after first dismiss
- `introOpen: boolean` — controls Dialog visibility; `true` initially if `isFirstTimeGate`, otherwise `false`
- Exercise component mounts when `!isFirstTimeGate` only

**Contract** (final):
```ts
const [isFirstTimeGate, setIsFirstTimeGate] = useState(
  !seenIntros.includes(exercise.exercise_type)
);
const [introOpen, setIntroOpen] = useState(isFirstTimeGate);

const handleIntroDismiss = (doNotShowAgain: boolean) => {
  setIntroOpen(false);
  setIsFirstTimeGate(false);
  if (doNotShowAgain) {
    const fd = new FormData();
    fd.append("exercise_type", exercise.exercise_type);
    fetch("/api/intros/mark-seen", { method: "POST", body: fd });
  }
};
```

Exercise renders when `!isFirstTimeGate`:
```tsx
{isFirstTimeGate ? null : (
  <ExerciseComponent exercise={exercise} onComplete={handleComplete} />
)}
```

`?` button and `ExerciseIntroModal` are always rendered (modal open state is `introOpen`).

#### 2. Style the `?` button

**File**: `src/components/exercise/ExerciseFlow.tsx` (inline Tailwind classes)

**Intent**: Make the `?` button subtle but visible — small circle, positioned absolutely top-right, semi-transparent until hover.

**Contract**: `className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm text-white/60 hover:bg-white/20 hover:text-white transition-colors"`. The parent wrapper needs `className="relative"`.

### Success Criteria

#### Automated Verification

- TypeScript compiles: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification

- Navigate to any exercise for the first time (clear `user_intro_views` for test user) → intro modal appears, exercise does not start
- Tick checkbox and click "Start Exercise" → modal closes, exercise starts, `user_intro_views` row inserted in Supabase
- Navigate to the same exercise type again → modal does NOT appear (checkbox was ticked)
- Navigate to a different exercise type for the first time → modal appears for that type
- Without ticking checkbox, dismiss → modal closes, exercise starts, no row inserted
- Navigate to same exercise again → modal appears again (checkbox was not ticked)
- During exercise, click `?` button → modal re-opens, exercise timer continues in background, exercise component stays mounted
- Close `?` modal → exercise resumes from where it was (no state reset)
- No regressions: complete an exercise end-to-end, verify results page shows correct data

**Implementation Note**: After completing this phase and all verification passes, pause for manual confirmation before marking the change as done.

---

## Testing Strategy

### Unit Tests

- `ExerciseIntroModal`: renders correct content for each exercise type; checkbox state toggles; `onDismiss(false)` called when unchecked; `onDismiss(true)` called when checked
- `ExerciseFlow`: when `seenIntros` includes exercise type, `isFirstTimeGate` is false (no modal gate); when not included, gate is active

### Integration Tests

- `/api/intros/mark-seen` POST: authenticated upsert succeeds; unauthenticated returns 401; duplicate call (same type) upserts cleanly without error

### Manual Testing Steps

1. Sign in as a fresh test user (no `user_intro_views` rows)
2. Navigate to Animated Pacer → modal appears, no timer running
3. Tick checkbox → click Start → exercise starts, row inserted
4. Complete exercise, note results are correct
5. Return to dashboard, start Animated Pacer again → no modal (seen)
6. Start Focus Sprint (unseen) → modal appears
7. Dismiss without checkbox → exercise starts, no row inserted
8. Return to dashboard, start Focus Sprint again → modal appears again
9. During any exercise, click `?` → modal re-opens, timer keeps running (confirm in results: duration reflects full time including ? reading)
10. Speed Scan: verify modal appears before phase 1 (Preview) begins

## Migration Notes

Run `npx supabase db reset` locally to apply the new migration alongside existing ones. In production, apply the migration before deploying the new code (additive schema change — safe to apply ahead of the feature).

## References

- PRD FR-007 (first-time intro), FR-008 (instructions via icon)
- Roadmap S-08 `intro-and-instructions`
- `src/components/exercise/ExerciseFlow.tsx` — integration point
- `src/pages/exercise/[id].astro` — SSR prop source
- `src/pages/api/goals/set.ts` — API endpoint pattern
- `supabase/migrations/20260727000000_create_user_goals.sql` — RLS pattern to follow

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data Layer

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset`
- [x] 1.2 TypeScript compiles without errors: `npm run build`
- [x] 1.3 Lint passes: `npm run lint`

#### Manual

- [x] 1.4 `user_intro_views` table visible in Supabase Studio with correct columns and RLS policies
- [x] 1.5 POST to `/api/intros/mark-seen` with valid exercise_type returns `{"success":true}`
- [x] 1.6 POST without auth returns 401
- [x] 1.7 Navigating to `/exercise/{id}` does not error (seenIntros defaults to `[]`)

### Phase 2: Intro Modal Component

#### Automated

- [ ] 2.1 TypeScript compiles without errors: `npm run build`
- [ ] 2.2 Lint passes: `npm run lint`

#### Manual

- [ ] 2.3 Modal renders with correct content for each exercise type
- [ ] 2.4 "Start Exercise" with unchecked checkbox calls `onDismiss(false)`
- [ ] 2.5 "Start Exercise" with checked checkbox calls `onDismiss(true)`
- [ ] 2.6 Clicking backdrop does NOT close the modal

### Phase 3: ExerciseFlow Integration

#### Automated

- [ ] 3.1 TypeScript compiles: `npm run build`
- [ ] 3.2 Lint passes: `npm run lint`

#### Manual

- [ ] 3.3 First visit to exercise type shows modal; exercise timer not yet running
- [ ] 3.4 Tick checkbox + Start → modal closes, exercise starts, DB row inserted
- [ ] 3.5 Second visit to same type → no modal
- [ ] 3.6 First visit to different type → modal appears
- [ ] 3.7 Dismiss without checkbox → modal closes, no DB row; modal shows again next visit
- [ ] 3.8 `?` button re-opens modal mid-exercise without resetting exercise state
- [ ] 3.9 End-to-end: complete an exercise → results page shows correct data (no regression)
