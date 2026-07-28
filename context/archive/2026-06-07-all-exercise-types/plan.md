# All Exercise Types Implementation Plan

## Overview

Expand the speed-reading training app from 1 to 3 exercise types (Animated Pacer, Focus Sprint, Speed Scan) with 2 datasets each (6 total instances surfaced to users). Dashboard shows 3 exercise cards (one per type), with server-side dataset selection ensuring users alternate between datasets to prevent answer memorization. Each exercise type has distinct UI and mechanics while following the established ExerciseFlow pattern.

**Note:** Originally planned 4 types (including Smart Questions), reduced to 3 during implementation (see "Design Decisions During Implementation" section below).

## Current State Analysis

### What exists now

**Database schema:**
- `exercises` table with all 4 exercise types defined in CHECK constraint (`supabase/migrations/20260605000000_create_exercises_schema.sql:7`)
- `exercise_completions` table with RLS policies and index for user history queries (`supabase/migrations/20260605000000_create_exercises_schema.sql:30-54`)
- Only 1 seeded exercise: Animated Pacer with `dataset_id='dataset_1'` (~450 words about database indexing)

**Frontend components:**
- `ExerciseFlow.tsx` orchestrates 2-step flow: pacer → quiz → auto-submit (`src/components/exercise/ExerciseFlow.tsx:11-62`)
- `AnimatedPacer.tsx` implements word-by-word highlighting with timer tracking (`src/components/exercise/AnimatedPacer.tsx:1-97`)
- `ComprehensionQuiz.tsx` displays multiple-choice questions sequentially (`src/components/exercise/ComprehensionQuiz.tsx:1-61`)
- `ExerciseCard.tsx` displays exercise with type badge, difficulty, duration (`src/components/dashboard/ExerciseCard.tsx:1-72`)
- Dashboard fetches all exercises with simple query: `select("*").order("created_at")` (`src/pages/dashboard.astro:16`)

**API routes:**
- `/api/exercises/[id].ts` fetches single exercise by ID (`src/pages/api/exercises/[id].ts:5-26`)
- `/api/exercises/complete.ts` saves completion with WPM calculation (`src/pages/api/exercises/complete.ts:4-54`)

**Type system:**
- `Exercise` interface supports all 4 types with extensible `config` JSONB field (`src/types.ts:2-19`)
- `Completion` interface stores `type_data` JSONB for type-specific metrics (`src/types.ts:21-32`)

### What's missing

1. **7 additional exercise seeds** (3 more for Animated Pacer + 2 each for Smart Questions, Focus Sprint, Speed Scan)
2. **3 new exercise components** (SmartQuestions.tsx, FocusSprint.tsx, SpeedScan.tsx)
3. **Dataset selection logic** to alternate between `dataset_1` and `dataset_2` based on user history
4. **Type routing in ExerciseFlow** to render the correct component based on `exercise.exercise_type`
5. **Dashboard query logic** to fetch one exercise per type (not all 8 instances)

## Desired End State

Users see 3 exercise cards on the dashboard (one per type). When clicking a card, the system automatically selects the alternate dataset (if they completed `dataset_1` last time, select `dataset_2` this time; cold-start defaults to `dataset_1`). Each exercise type has distinct UI and purpose:

1. **Animated Pacer**: Word-by-word highlighting with WPM tracking, followed by 2 comprehension questions
2. **Focus Sprint**: Read full text at own pace, click "Done Reading", then answer 3 comprehension questions
3. **Speed Scan**: 3-phase flow (preview questions → timed scan → information recall with 3 questions)

### Verification

- Dashboard shows exactly 3 exercise cards (one per type)
- Clicking the same exercise type twice in a row loads different datasets
- Animated Pacer displays word-by-word highlighting, then quiz
- Focus Sprint shows full text with "Done Reading" button, then comprehension quiz (3 questions)
- Speed Scan implements 3-phase flow: preview questions → timed scan → recall quiz
- All exercise types save completions with correct `type_data` metrics
- Database has 8 seeded exercise instances (4 types × 2 datasets), but only 6 instances surface to users (3 active types × 2 datasets)

### Key Discoveries:

- ExerciseFlow state machine (step transitions) can accommodate different exercise types with minimal refactoring (`src/components/exercise/ExerciseFlow.tsx:11-62`)
- Timer pattern from AnimatedPacer is reusable: `startTimeRef` with `Date.now()` delta, `??=` operator for pause/resume (`src/components/exercise/AnimatedPacer.tsx:20-41`)
- Form submission is uniform across all types: `exercise_id`, `duration_seconds`, `errors`; type-specific metrics go in `type_data` JSONB (`src/pages/api/exercises/complete.ts:12-44`)
- User ID must be sourced from `context.locals.user.id` (middleware pattern), never from client input (lesson: `context/foundation/lessons.md:5-10`)
- Supabase query pattern: always use `result` variable (`const result = await supabase...`), then access `result.data` / `result.error` (lesson: `context/foundation/lessons.md:12-17`)
- Null check `createClient` before use (lesson: `context/foundation/lessons.md:19-24`)

## What We're NOT Doing

- No leaderboard implementation (PRD §Non-Goals, roadmap Parked section — deferred to post-MVP)
- No custom exercise creation by users (PRD §Non-Goals)
- No truly adaptive difficulty algorithm (Smart Questions uses progressive reveal, not runtime adaptation based on accuracy)
- No code-specific datasets yet (using generic web dev fundamentals text; domain-specificity is a content decision deferred to post-MVP per roadmap F-01 Risk note)
- No interaction tracking for Speed Scan (scroll/click patterns) — using simple time threshold + pre-task questions
- No dataset alternation enforcement for direct /exercise/<id> navigation — users can bookmark and repeat the same dataset by navigating directly to /exercise/<id> instead of via dashboard. Accepted limitation for MVP since the primary flow (dashboard → exercise) enforces alternation. If this becomes an issue post-MVP, can add redirect logic to /exercise/[id].astro or dataset selection there.

## Design Decisions During Implementation

### Decision: Remove Smart Questions Exercise Type (2026-06-08)

**Context**: During Phase 3-6 implementation and user testing, two critical issues emerged with Smart Questions:
1. **No reading content**: Smart Questions component only displayed quiz questions without any text to read, making it an incomplete exercise (user cannot learn/comprehend content before answering).
2. **Too similar to Focus Sprint**: Both exercise types show text + comprehension questions. The only differences were countdown timer (Focus Sprint) vs no timer (Smart Questions), which isn't enough differentiation for separate exercise types.

**Decision**: Remove Smart Questions exercise type entirely. Reduce from 4 exercise types to 3:
- **Keep**: Animated Pacer (word-by-word guided reading), Focus Sprint (timed reading with pressure), Speed Scan (information location/recall)
- **Remove**: Smart Questions (quiz-only, no reading content, redundant with Focus Sprint)

**Impact**:
- Dashboard will show 3 exercise cards instead of 4
- Database migration already created smart_questions seeds (IDs ending in 011, 012) — these will remain in DB but won't be surfaced to users
- SmartQuestions.tsx component remains in codebase but is unused (can be deleted in cleanup)
- Exercise type routing in ExerciseFlow.tsx will skip smart_questions
- Results page question count mapping already accounts for all types

**Rationale**:
- Better to have 3 distinct, complete exercise types than 4 types where one is broken/incomplete
- Focus Sprint already provides "read + answer questions" flow (can be enhanced in future if needed)
- Smart Questions could be re-introduced later as a standalone quiz feature (no reading content) or merged into Focus Sprint with a config toggle

**Future consideration**: ~~May want to add a "read at your own pace + questions" mode to Focus Sprint (remove countdown, make it pure comprehension-focused reading). This would be a Focus Sprint enhancement, not a separate type.~~ **IMPLEMENTED 2026-06-08** - Focus Sprint converted to "read at your own pace + comprehension quiz" mode. Removed countdown timer and pressure cues. User reads text freely, clicks "Done Reading" when ready, then answers 3 comprehension questions. Results show duration, WPM, and correct answers (now 3 questions instead of 0).

## Implementation Approach

Each exercise type gets its own React component following the AnimatedPacer pattern: timer tracking via `useRef`, duration calculation on completion, callback to ExerciseFlow with `(durationSeconds, errors)`. ExerciseFlow acts as a router, rendering the appropriate component based on `exercise.exercise_type`. Dataset selection logic lives in a new API endpoint (`/api/exercises/next-for-type?type=X`) that queries user's completion history, determines the last dataset used for that type, and returns the alternate dataset's exercise (cold-start defaults to `dataset_1`). Dashboard queries this endpoint for each of the 4 exercise types, displaying exactly 4 cards. Database seeds 7 new exercises with unique content per type (shared across 2 datasets of same type, differing only in questions/config).

## Phase 1: Database Seeds and Migration

### Overview

Seed 7 new exercise instances (4 types × 2 datasets - 1 already exists) with unique technical content per exercise type, following the established migration pattern.

### Changes Required:

#### 1. Exercise Seed Migration

**File**: `supabase/migrations/20260607000000_seed_remaining_exercises.sql`

**Intent**: Insert 7 new exercise records covering all 4 types × 2 datasets. Content is unique per exercise type, shared across the 2 datasets of the same type (questions/config differ between datasets).

**Contract**: SQL INSERT statements with deterministic UUIDs for each exercise. `exercise_type` must match one of the 4 values from the CHECK constraint. `config` JSONB varies by exercise type. `content` field contains ~400-word technical articles on web development fundamentals.

<details>
<summary>Expand for reference seed structure</summary>

Exercise type distribution:
- `animated_pacer`: IDs ending in 001 (dataset_1, exists), 002 (dataset_2, create)
- `smart_questions`: IDs ending in 011 (dataset_1, create), 012 (dataset_2, create)
- `focus_sprint`: IDs ending in 021 (dataset_1, create), 022 (dataset_2, create)
- `speed_scan`: IDs ending in 031 (dataset_1, create), 032 (dataset_2, create)

Content topics (per PRD persona: developers reading code/docs):
- Animated Pacer: Database indexing (exists), React state management (create)
- Smart Questions: API design patterns
- Focus Sprint: CSS layout techniques
- Speed Scan: Web performance optimization

Config examples:
- Animated Pacer: `{"target_wpm": 250, "pacer_speed": "adaptive", "highlight_color": "#3b82f6"}`
- Smart Questions: `{"questions_count": 5, "time_per_question": 30}`
- Focus Sprint: `{"target_wpm": 400, "pressure_threshold": 60, "countdown_seconds": 120}`
- Speed Scan: `{"scan_time_seconds": 30, "info_recall_count": 3}`

</details>

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase migration up`
- Query returns 8 exercises: `SELECT COUNT(*) FROM exercises;` → 8
- Each exercise type has 2 datasets: `SELECT exercise_type, COUNT(DISTINCT dataset_id) FROM exercises GROUP BY exercise_type;` → all rows show count=2
- All exercises have content: `SELECT COUNT(*) FROM exercises WHERE content IS NOT NULL AND length(content) > 0;` → 8

#### Manual Verification:

- Review seeded exercise content for technical accuracy and ~400-word length
- Verify config JSON is valid and matches exercise type requirements
- Check that dataset_1 and dataset_2 for each type share content but differ in questions/config

---

## Phase 2: Shared Infrastructure

### Overview

Extract reusable timer logic and completion form from AnimatedPacer, and create dataset selection API endpoint for server-side dataset rotation.

### Changes Required:

#### 1. Extract Timer Hook

**File**: `src/lib/hooks/useExerciseTimer.ts`

**Intent**: Extract timer tracking pattern from AnimatedPacer into a reusable React hook that all exercise components can use. Implements start/pause/getDuration methods with proper cleanup.

**Contract**:

```typescript
export function useExerciseTimer(): {
  start: () => void;
  pause: () => void;
  getDuration: () => number;
  isRunning: boolean;
}
```

Uses `useRef<number | null>` for `startTimeRef`, `useState<boolean>` for `isRunning`. `start()` uses `??=` to preserve original start time across pause/resume. `getDuration()` returns `Math.floor((Date.now() - startTimeRef.current) / 1000)`.

#### 2. Dataset Selection Service Function

**File**: `src/lib/services/exerciseService.ts`

**Intent**: Extract dataset selection logic into a shared service function that can be used by both dashboard.astro (SSR) and API endpoints. Determines which dataset to return for a given exercise type based on user's completion history.

**Contract**:

```typescript
export async function getNextExerciseForType(
  supabase: SupabaseClient,
  userId: string,
  exerciseType: 'animated_pacer' | 'smart_questions' | 'focus_sprint' | 'speed_scan'
): Promise<Exercise | null>
```

Algorithm:
1. Fetch user's last completion for this exercise type: `SELECT exercise_completions.exercise_id, exercises.dataset_id FROM exercise_completions JOIN exercises ON exercise_completions.exercise_id = exercises.id WHERE exercise_completions.user_id = $userId AND exercises.exercise_type = $exerciseType ORDER BY exercise_completions.completed_at DESC LIMIT 1`
2. If no history, select `dataset_id = 'dataset_1'`
3. If last was `dataset_1`, select `dataset_id = 'dataset_2'`; if last was `dataset_2`, select `dataset_id = 'dataset_1'`
4. Fetch exercise: `SELECT * FROM exercises WHERE exercise_type = $exerciseType AND dataset_id = $selected_dataset LIMIT 1`
5. Return exercise object or `null` if not found

Must use `result` variable pattern for Supabase queries (lesson). Caller is responsible for null-checking `createClient` before calling this function.

#### 3. Dataset Selection API Endpoint

**File**: `src/pages/api/exercises/next-for-type.ts`

**Intent**: Provide HTTP endpoint wrapper around `getNextExerciseForType` service function for client-side consumers (if needed in future).

**Contract**:

GET endpoint expects query param `type`. Returns JSON exercise object or `404`. Implementation:

```typescript
import { getNextExerciseForType } from "@/lib/services/exerciseService";

export const GET: APIRoute = async (context) => {
  const { user } = context.locals;
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const type = context.url.searchParams.get("type");
  // ... validate type ...

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });

  const exercise = await getNextExerciseForType(supabase, user.id, type);
  if (!exercise) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });

  return new Response(JSON.stringify(exercise), { status: 200 });
};
```

Must null-check `createClient` before use (lesson). Must source `user_id` from `context.locals.user.id` (lesson).

#### 4. Update Types (if needed)

**File**: `src/types.ts`

**Intent**: Ensure Exercise interface config type accommodates all 4 exercise types' config fields.

**Contract**:

The existing `config` field is already extensible (object type). Document the expected config shapes per exercise type in a comment or type union.

Example:
```typescript
config: {
  // Animated Pacer
  target_wpm?: number;
  pacer_speed?: "fixed" | "adaptive";
  highlight_color?: string;

  // Smart Questions
  questions_count?: number;
  time_per_question?: number;

  // Focus Sprint
  pressure_threshold?: number;
  countdown_seconds?: number;

  // Speed Scan
  scan_time_seconds?: number;
  info_recall_count?: number;
};
```

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- API endpoint responds: `curl http://localhost:4321/api/exercises/next-for-type?type=animated_pacer` returns 200 with exercise JSON

#### Manual Verification:

- Call API endpoint for each exercise type and verify dataset alternation:
  1. First call for `animated_pacer` returns `dataset_1`
  2. Complete that exercise via UI
  3. Second call for `animated_pacer` returns `dataset_2`
  4. Complete that exercise
  5. Third call for `animated_pacer` returns `dataset_1` (cycle repeats)
- Verify cold-start: call API for type with no completions, confirm `dataset_1` returned
- Verify `useExerciseTimer` hook behavior: start timer, pause, resume, verify duration is cumulative

---

## Phase 3: Smart Questions Component

### Overview

Create SmartQuestions.tsx implementing progressive reveal multi-step quiz with sequential difficulty, reusing the timer hook and ComprehensionQuiz UI patterns.

### Changes Required:

#### 1. Smart Questions Component

**File**: `src/components/exercise/SmartQuestions.tsx`

**Intent**: Display a sequential multi-step quiz where questions unlock in sequence (harder questions after easier ones). Tracks timer, errors, and calls `onComplete(duration, errors)` when finished.

**Contract**:

Component props:
```typescript
interface Props {
  exercise: Exercise;
  onComplete: (durationSeconds: number, errors: number) => void;
}
```

UI flow:
1. Display current question (1 of N) with 4 multiple-choice options
2. User selects answer → advance to next question (mark error if wrong)
3. Repeat until all questions answered
4. Call `onComplete(timer.getDuration(), errorCount)`

Questions are hard-coded in component (5 questions total, progressive difficulty). Use the `useExerciseTimer` hook from Phase 2. Reuse button grid pattern from ComprehensionQuiz.tsx:44-56. Display progress indicator: "Question X of Y".

#### 2. Install Progress Component (if needed)

**File**: N/A (shadcn/ui installation)

**Intent**: Optional - install shadcn/ui Progress component for visual progress bar.

**Contract**:

Run: `npx shadcn@latest add progress`

Import in SmartQuestions.tsx: `import { Progress } from "@/components/ui/progress";`

### Success Criteria:

#### Automated Verification:

- Component file exists and exports default function: `src/components/exercise/SmartQuestions.tsx`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`

#### Manual Verification:

- Render component in isolation (Storybook or direct page mount) and verify:
  - Questions display sequentially
  - Selecting wrong answer increments error count
  - Selecting correct answer advances to next question
  - Timer starts on component mount and tracks cumulative duration
  - After last question, `onComplete` is called with correct duration and error count
- Test pause/resume behavior (if applicable)

---

## Phase 4: Focus Sprint Component

### Overview

Create FocusSprint.tsx displaying full text with countdown timer and visual pressure cues (color changes, progress bar) to create urgency.

### Changes Required:

#### 1. Focus Sprint Component

**File**: `src/components/exercise/FocusSprint.tsx`

**Intent**: Display full exercise text with countdown timer and pressure indicators. User reads at their own pace against the clock. On completion (manual "Done" button or timer expiration), call `onComplete(duration, 0)` (no error tracking for Focus Sprint).

**Contract**:

Component props:
```typescript
interface Props {
  exercise: Exercise;
  onComplete: (durationSeconds: number, errors: number) => void;
}
```

UI elements:
- Countdown timer (starts from `exercise.config.countdown_seconds`, defaults to 120)
- Full text display (no word-by-word highlighting)
- Pressure cues triggered at configurable threshold (e.g., when 60% of time elapsed):
  - Background color shift (bg-zinc-900 → bg-red-950)
  - Timer text color shift (text-blue-100 → text-red-300)
  - Optional: pulsing animation on timer
- "Done Reading" button to finish early
- Auto-complete when countdown reaches 0

Use the `useExerciseTimer` hook for duration tracking (separate from countdown display). Countdown uses `useState` + `useEffect` with `setInterval`.

Progress bar shows time remaining: `(remainingSeconds / totalSeconds) * 100`.

#### 2. Install Progress Component (if not done in Phase 3)

**File**: N/A (shadcn/ui installation)

**Intent**: Install shadcn/ui Progress component for countdown progress bar.

**Contract**:

Run: `npx shadcn@latest add progress`

### Success Criteria:

#### Automated Verification:

- Component file exists: `src/components/exercise/FocusSprint.tsx`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`

#### Manual Verification:

- Render component and verify:
  - Countdown timer starts from configured seconds and decrements
  - Progress bar visually reflects time remaining
  - Pressure cues activate at threshold (60% time elapsed)
  - Background and text colors shift at threshold
  - "Done Reading" button calls `onComplete` with correct duration
  - Timer expiration auto-calls `onComplete`
  - Duration tracking is independent of countdown (uses `useExerciseTimer`)

---

## Phase 5: Speed Scan Component

### Overview

Create SpeedScan.tsx implementing 3-phase flow: pre-task questions → timed scan → information recall, verifying users found specific information in the text.

### Changes Required:

#### 1. Speed Scan Component

**File**: `src/components/exercise/SpeedScan.tsx`

**Intent**: Display 3 sequential phases. Phase 1 shows pre-task questions (what information to find). Phase 2 displays full text with countdown timer (user scans for info). Phase 3 prompts for answers to pre-task questions (information recall). Errors = number of wrong answers in Phase 3.

**Contract**:

Component props:
```typescript
interface Props {
  exercise: Exercise;
  onComplete: (durationSeconds: number, errors: number) => void;
}
```

Phase definitions:
- **Phase 1: Preview** — Display 2-3 questions about specific information to find (e.g., "What is the recommended cache invalidation strategy?", "Which browser API is mentioned for offline support?"). No timer. "Start Scanning" button advances to Phase 2.
- **Phase 2: Scan** — Display full text with countdown timer (from `exercise.config.scan_time_seconds`, defaults to 30). Auto-advance to Phase 3 when timer expires.
- **Phase 3: Recall** — Display same questions from Phase 1 with multiple-choice options. User selects answers. "Submit" button calls `onComplete(timer.getDuration(), errorCount)`.

Questions are hard-coded in component (2-3 questions). Use the `useExerciseTimer` hook for cumulative duration tracking across all phases.

State management:
```typescript
const [phase, setPhase] = useState<"preview" | "scan" | "recall">("preview");
const [countdown, setCountdown] = useState(exercise.config.scan_time_seconds ?? 30);
const [answers, setAnswers] = useState<Record<number, string>>({});
```

#### 2. Install Alert Component (for instructions)

**File**: N/A (shadcn/ui installation)

**Intent**: Optional - install shadcn/ui Alert component for displaying instructions in Phase 1.

**Contract**:

Run: `npx shadcn@latest add alert`

Import in SpeedScan.tsx: `import { Alert, AlertDescription } from "@/components/ui/alert";`

### Success Criteria:

#### Automated Verification:

- Component file exists: `src/components/exercise/SpeedScan.tsx`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`

#### Manual Verification:

- Render component and verify:
  - Phase 1 displays preview questions clearly
  - "Start Scanning" button transitions to Phase 2
  - Phase 2 countdown timer starts from configured seconds and auto-advances on expiration
  - Phase 3 displays same questions with multiple-choice options
  - Selecting wrong answers increments error count
  - "Submit" button calls `onComplete` with cumulative duration (all 3 phases) and error count
  - User cannot skip phases or go backwards

---

## Phase 6: Dashboard Integration and ExerciseFlow Routing

### Overview

Update dashboard to query the dataset selection API for each exercise type (showing 4 cards), and update ExerciseFlow to route to the correct component based on `exercise.exercise_type`.

### Changes Required:

#### 1. Update Dashboard Query Logic

**File**: `src/pages/dashboard.astro`

**Intent**: Replace the existing `select("*").order("created_at")` query with 4 parallel calls to `getNextExerciseForType` service function (one per exercise type). Display exactly 4 exercise cards (one per type).

**Contract**:

Server-side pattern using shared service function:
```typescript
import { getNextExerciseForType } from "@/lib/services/exerciseService";

const exerciseTypes = ["animated_pacer", "smart_questions", "focus_sprint", "speed_scan"] as const;
const exercisePromises = exerciseTypes.map(type =>
  getNextExerciseForType(supabase, user.id, type)
);
const exercises = await Promise.all(exercisePromises);
```

Remove old Supabase query. Render 4 ExerciseCard components (one per exercise). Filter out nulls (exercises that don't exist yet). Handle errors gracefully (display error banner if service function throws).

#### 2. Update ExerciseFlow Type Routing

**File**: `src/components/exercise/ExerciseFlow.tsx`

**Intent**: Replace hard-coded AnimatedPacer rendering with dynamic component selection based on `exercise.exercise_type`. Route to the appropriate exercise component.

**Contract**:

Component map:
```typescript
import AnimatedPacer from "./AnimatedPacer";
import SmartQuestions from "./SmartQuestions";
import FocusSprint from "./FocusSprint";
import SpeedScan from "./SpeedScan";

const ExerciseComponentMap = {
  animated_pacer: AnimatedPacer,
  smart_questions: SmartQuestions,
  focus_sprint: FocusSprint,
  speed_scan: SpeedScan,
} as const;

const ExerciseComponent = ExerciseComponentMap[exercise.exercise_type];
```

Remove the 3-step state machine (`"pacer" | "quiz" | "submit"`). Each exercise type component is now self-contained and calls `onComplete(duration, errors)` directly when finished. ExerciseFlow only handles the completion callback and form auto-submit.

Updated ExerciseFlow structure:
1. Render `<ExerciseComponent exercise={exercise} onComplete={handleComplete} />`
2. `handleComplete` stores `duration` and `errors` in state, sets `isComplete` flag
3. When `isComplete`, render the hidden form and auto-submit (existing pattern lines 53-62)

Remove ComprehensionQuiz import and step-based rendering from ExerciseFlow. AnimatedPacer and SmartQuestions will import and use ComprehensionQuiz internally for their quiz phases.

#### 3. Update AnimatedPacer to be Self-Contained

**File**: `src/components/exercise/AnimatedPacer.tsx`

**Intent**: Make AnimatedPacer self-contained by integrating the comprehension quiz internally. Change signature from `onComplete(durationSeconds)` to `onComplete(durationSeconds, errors)`.

**Contract**:

Add internal state for quiz phase:
```typescript
const [showQuiz, setShowQuiz] = useState(false);
const [errors, setErrors] = useState(0);
```

Move hard-coded questions from ExerciseFlow.tsx:16-32 into AnimatedPacer. After pacer completes, show ComprehensionQuiz (imported from `./ComprehensionQuiz`). When quiz completes, call `onComplete(durationSeconds, errorCount)`.

Updated flow: pacer phase → `setShowQuiz(true)` → quiz phase → `onComplete(duration, errors)`

#### 5. Update ExerciseCard Navigation (if needed)

**File**: `src/components/dashboard/ExerciseCard.tsx`

**Intent**: Verify ExerciseCard handles the new dashboard data structure (exercises from API calls instead of database query). No changes expected since it already accepts `Exercise` interface.

**Contract**:

Component still expects `exercise: Exercise` prop. Navigation remains `href={/exercise/${exercise.id}}`. Type badge colors and labels are already defined for all 4 types (lines 12-24).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Dev server starts: `npm run dev`

#### Manual Verification:

- Dashboard displays exactly 4 exercise cards (one per type)
- Each card shows correct type badge, title, description
- Clicking Animated Pacer card navigates to AnimatedPacer exercise
- Clicking Smart Questions card navigates to SmartQuestions exercise
- Clicking Focus Sprint card navigates to FocusSprint exercise
- Clicking Speed Scan card navigates to SpeedScan exercise
- Complete an exercise and return to dashboard — verify the next click of that same type loads the alternate dataset (dataset_1 ↔ dataset_2)
- Complete an exercise of each type and verify all 4 types track completions independently
- Verify dataset alternation persists across sessions (logout/login)

---

## Testing Strategy

### Unit Tests:

- `useExerciseTimer` hook: start, pause, resume, getDuration edge cases
- Dataset selection API logic: cold-start, alternation, user history queries
- Exercise component error counting: SmartQuestions wrong answers, SpeedScan wrong recalls

### Integration Tests:

- End-to-end exercise completion flow for each type:
  1. Login
  2. Dashboard shows 4 cards
  3. Click exercise type X
  4. Complete exercise
  5. Verify completion saved to database
  6. Return to dashboard
  7. Click same type X again
  8. Verify alternate dataset loaded
- Cross-browser testing (Chrome, Firefox, Safari, Edge per PRD NFR-002)

### Manual Testing Steps:

1. Seed database with Phase 1 migration → verify 8 exercises exist
2. Login as new user (cold-start scenario)
3. Dashboard shows 4 cards → verify all types present
4. Complete Animated Pacer (dataset_1) → verify result page shows WPM
5. Return to dashboard, click Animated Pacer again → verify dataset_2 loads (different text in Pacer)
6. Complete Animated Pacer (dataset_2) → return to dashboard, click again → verify dataset_1 loads (cycle repeats)
7. Repeat steps 4-6 for Smart Questions, Focus Sprint, Speed Scan
8. Verify Smart Questions shows sequential questions and tracks errors correctly
9. Verify Focus Sprint countdown timer activates pressure cues at threshold
10. Verify Speed Scan 3-phase flow: preview → scan → recall, with correct error tracking

## Performance Considerations

Dashboard makes 4 parallel API calls to fetch exercises (one per type). This is acceptable for MVP with 4 types. If exercise types expand beyond ~10, consider batching into a single API endpoint that returns all recommended exercises in one query.

Dataset selection API queries user's completion history with indexed lookup (`idx_exercise_completions_user_date ON exercise_completions(user_id, completed_at DESC)` from migration). Query is scoped to one exercise type and LIMIT 1, so performance is constant-time regardless of user's total completion count.

Exercise components use `useRef` for timer tracking (no re-renders) and `useState` for UI state. Countdown timers in FocusSprint and SpeedScan use `setInterval` which is cleaned up in `useEffect` return to prevent memory leaks.

## Migration Notes

Database migration (Phase 1) is additive-only (INSERT statements). No schema changes. Safe to apply without downtime.

Existing Animated Pacer exercise (ID `a0000000-0000-0000-0000-000000000001`) is preserved. Users who completed it will see the 2nd Animated Pacer dataset on their next attempt (dataset alternation logic applies retroactively).

## References

- PRD: `context/foundation/prd.md` (FR-018, FR-019, FR-006, FR-012)
- Roadmap: `context/foundation/roadmap.md` (S-02: All exercise types)
- Lessons: `context/foundation/lessons.md` (user_id from session, result variable pattern, null-check createClient)
- Archived plan: `context/archive/2026-06-05-first-exercise-completion/plan.md` (ExerciseFlow pattern, timer tracking, form submission)
- Database schema: `supabase/migrations/20260605000000_create_exercises_schema.sql`
- Existing components: `src/components/exercise/ExerciseFlow.tsx`, `src/components/exercise/AnimatedPacer.tsx`, `src/components/exercise/ComprehensionQuiz.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database Seeds and Migration

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase migration up` — 63d6b3e
- [x] 1.2 Query returns 8 exercises: `SELECT COUNT(*) FROM exercises;` → 8 — 63d6b3e
- [x] 1.3 Each exercise type has 2 datasets: `SELECT exercise_type, COUNT(DISTINCT dataset_id) FROM exercises GROUP BY exercise_type;` → all rows show count=2 — 63d6b3e
- [x] 1.4 All exercises have content: `SELECT COUNT(*) FROM exercises WHERE content IS NOT NULL AND length(content) > 0;` → 8 — 63d6b3e

#### Manual

- [x] 1.5 Review seeded exercise content for technical accuracy and ~400-word length — 63d6b3e
- [x] 1.6 Verify config JSON is valid and matches exercise type requirements — 63d6b3e
- [x] 1.7 Check that dataset_1 and dataset_2 for each type share content but differ in questions/config — 63d6b3e

### Phase 2: Shared Infrastructure

#### Automated

- [x] 2.1 Type checking passes: `npm run typecheck` — 7df9ec3
- [x] 2.2 Linting passes: `npm run lint` — 7df9ec3
- [x] 2.3 API endpoint responds: `curl http://localhost:4321/api/exercises/next-for-type?type=animated_pacer` returns 200 with exercise JSON — 7df9ec3

#### Manual

- [x] 2.4 Call API endpoint for each exercise type and verify dataset alternation — 7df9ec3
- [x] 2.5 Verify cold-start: call API for type with no completions, confirm `dataset_1` returned — 7df9ec3
- [x] 2.6 Verify `useExerciseTimer` hook behavior: start timer, pause, resume, verify duration is cumulative — 7df9ec3

### Phase 3: Smart Questions Component

#### Automated

- [x] 3.1 Component file exists and exports default function: `src/components/exercise/SmartQuestions.tsx` — 331d7bb
- [x] 3.2 Type checking passes: `npm run typecheck` — 331d7bb
- [x] 3.3 Linting passes: `npm run lint` — 331d7bb

#### Manual

- [x] 3.4 Render component in isolation and verify questions display sequentially — 331d7bb
- [x] 3.5 Verify selecting wrong answer increments error count — 331d7bb
- [x] 3.6 Verify timer starts on component mount and tracks cumulative duration — 331d7bb
- [x] 3.7 Verify after last question, `onComplete` is called with correct duration and error count — 331d7bb

### Phase 4: Focus Sprint Component

#### Automated

- [x] 4.1 Component file exists: `src/components/exercise/FocusSprint.tsx` — 331d7bb
- [x] 4.2 Type checking passes: `npm run typecheck` — 331d7bb
- [x] 4.3 Linting passes: `npm run lint` — 331d7bb

#### Manual

- [x] 4.4 Render component and verify countdown timer starts from configured seconds and decrements — 331d7bb
- [x] 4.5 Verify progress bar visually reflects time remaining — 331d7bb
- [x] 4.6 Verify pressure cues activate at threshold (60% time elapsed) — 331d7bb
- [x] 4.7 Verify "Done Reading" button calls `onComplete` with correct duration — 331d7bb
- [x] 4.8 Verify timer expiration auto-calls `onComplete` — 331d7bb

### Phase 5: Speed Scan Component

#### Automated

- [x] 5.1 Component file exists: `src/components/exercise/SpeedScan.tsx` — 331d7bb
- [x] 5.2 Type checking passes: `npm run typecheck` — 331d7bb
- [x] 5.3 Linting passes: `npm run lint` — 331d7bb

#### Manual

- [x] 5.4 Render component and verify Phase 1 displays preview questions clearly — 331d7bb
- [x] 5.5 Verify "Start Scanning" button transitions to Phase 2 — 331d7bb
- [x] 5.6 Verify Phase 2 countdown timer starts from configured seconds and auto-advances on expiration — 331d7bb
- [x] 5.7 Verify Phase 3 displays same questions with multiple-choice options — 331d7bb
- [x] 5.8 Verify "Submit" button calls `onComplete` with cumulative duration and error count — 331d7bb

### Phase 6: Dashboard Integration and ExerciseFlow Routing

#### Automated

- [x] 6.1 Type checking passes: `npm run typecheck` — 331d7bb
- [x] 6.2 Linting passes: `npm run lint` — 331d7bb
- [x] 6.3 Build passes: `npm run build` — 331d7bb
- [x] 6.4 Dev server starts: `npm run dev` — 331d7bb

#### Manual

- [x] 6.5 Dashboard displays exactly 4 exercise cards (one per type) — 331d7bb
- [x] 6.6 Each card shows correct type badge, title, description — 331d7bb
- [x] 6.7 Clicking each exercise type card navigates to correct exercise component — 331d7bb
- [x] 6.8 Complete an exercise and return to dashboard — verify next click of same type loads alternate dataset — 331d7bb
- [x] 6.9 Complete an exercise of each type and verify all 4 types track completions independently — 331d7bb
- [x] 6.10 Verify dataset alternation persists across sessions (logout/login) — 331d7bb
