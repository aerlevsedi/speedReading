# First Exercise Completion Implementation Plan

## Overview

Implement the north star flow for the speed-reading training app: authenticated user can log in, view their dashboard with an exercise card, start the Animated Pacer exercise, complete it with word-by-word highlighting and comprehension questions, and see a results summary displaying duration, WPM, and error count.

## Current State Analysis

**Auth and data foundation are complete:**
- Supabase SSR auth working: `src/middleware.ts:6-12` protects `/dashboard`
- Database schema landed: `exercises` and `exercise_completions` tables exist with RLS (`supabase/migrations/20260605000000_create_exercises_schema.sql`)
- 1 Animated Pacer exercise seeded: "Database Performance Fundamentals" (UUID: `a0000000-0000-0000-0000-000000000001`)
- Dashboard exists but is placeholder: `src/pages/dashboard.astro:1-28` (just shows user email and sign-out button)

**Established patterns to follow:**
- React islands hydration: `client:load` directive for interactive components
- Form pattern: POST to API route → insert/update → redirect with feedback (`src/components/auth/SignInForm.tsx:43`)
- Tailwind class merging: use `cn()` from `@/lib/utils.ts:1-6`
- shadcn/ui Button component: `src/components/ui/button.tsx` with variants (`default`, `outline`, `ghost`)
- Cosmic theme styling: `bg-cosmic` gradient background, glass morphism cards with `backdrop-blur-xl`

### Key Discoveries:

- No TypeScript types exist yet: `src/types.ts` doesn't exist, intentionally deferred from F-01 to S-01 per `context/changes/exercise-data-model-seed/plan.md:45`
- No data fetching layer: all Supabase calls are raw `supabase.from()` queries
- Exercise content is ~450 words: Pacer needs to split by whitespace and highlight word-by-word
- JSONB config in seed: `{"target_wpm": 250, "pacer_speed": "adaptive", "highlight_color": "#3b82f6"}`
- Comprehension validation chosen: end-of-exercise questions to track errors (not typing mistakes)

## Desired End State

After this plan completes, the system will deliver the north star user flow:

1. **User lands on dashboard** → sees exercise card showing "Database Performance Fundamentals", type badge "Animated Pacer", difficulty "Beginner", estimated time "2 min"
2. **User clicks Start** → navigates to `/exercise/a0000000-0000-0000-0000-000000000001`, sees exercise intro with instructions
3. **User starts exercise** → sees text with current word/phrase highlighted sequentially at 250 WPM pace (adaptive from config)
4. **User completes reading** → answers 2 comprehension questions (right/wrong tracked as errors)
5. **User submits** → completion saved to `exercise_completions`, redirects to `/results/[completion_id]`
6. **User sees results** → duration (e.g., "1:35"), WPM (e.g., "287 WPM"), errors (e.g., "1 of 2"), and "Back to Dashboard" button

**Verification:**
- Visit http://localhost:4321/dashboard → see exercise card
- Click Start → pacer highlights words sequentially
- Complete exercise + questions → results page shows calculated WPM
- Click Back → returns to dashboard

## What We're NOT Doing

- Multiple exercise instances: only 1 Animated Pacer for now (S-02 adds the remaining 7 instances)
- Progress chart: no comparison to previous sessions yet (S-05)
- Goal setting/comparison: no "target vs actual" display (S-03)
- Recommendation logic: dashboard shows 1 card, no "recommended" badge yet (S-04)
- Retry with different dataset: only 1 dataset available (S-06 adds dataset_2)
- First-time intro modal: showing instructions inline for now (S-08 adds intro flow)
- Pause/resume: exercise runs to completion or abandonment (enhancement post-MVP)
- Mobile optimization: desktop-first, responsive if it's free (per PRD Non-Goals)

## Implementation Approach

Incremental phases delivering vertical slices: types → API → dashboard UI → exercise UI → completion API → results UI → integration. Each phase includes both automated verification (type checks, build, lint) and manual testing (browser interaction) with explicit pause points to confirm UX before proceeding. Follows existing patterns: React forms with `client:load`, FormData POST to API routes, Astro pages for layouts, shadcn/ui for components.

## Phase 1: TypeScript types and exercise fetch API

### Overview

Define shared TypeScript types for `Exercise` and `Completion` entities in `src/types.ts`. Create an API route to fetch an exercise by ID from the database.

### Changes Required:

#### 1. TypeScript types

**File**: `src/types.ts`

**Intent**: Define type-safe interfaces matching the database schema for `exercises` and `exercise_completions` tables. These types will be imported across frontend components and API routes.

**Contract**: Export `Exercise` and `Completion` interfaces. Match column names exactly (snake_case from Postgres, not camelCase).

```typescript
// Database entity types
export interface Exercise {
  id: string; // UUID
  exercise_type: 'animated_pacer' | 'smart_questions' | 'focus_sprint' | 'speed_scan';
  dataset_id: string;
  title: string;
  description: string | null;
  content: string;
  config: {
    target_wpm?: number;
    pacer_speed?: 'fixed' | 'adaptive';
    highlight_color?: string;
    // Extensible for other exercise types in S-02
  };
  difficulty: 'beginner' | 'intermediate' | 'advanced' | null;
  estimated_duration_seconds: number | null;
  created_at: string; // ISO timestamp
  updated_at: string;
}

export interface Completion {
  id: string; // UUID
  user_id: string;
  exercise_id: string;
  duration_seconds: number;
  errors: number;
  type_data: {
    wpm?: number;
    // Extensible for other exercise types
  };
  completed_at: string; // ISO timestamp
}
```

#### 2. Exercise fetch API route

**File**: `src/pages/api/exercises/[id].ts`

**Intent**: Return the exercise JSON for a given ID. Used by the exercise page to load content and config.

**Contract**: Export `GET` function, read `id` from `Astro.params`, query Supabase, return JSON response or 404.

```typescript
import type { APIRoute } from 'astro';
import { createClient } from '@/lib/supabase';
import type { Exercise } from '@/types';

export const GET: APIRoute = async (context) => {
  const { id } = context.params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing exercise ID' }), { status: 400 });
  }

  const supabase = createClient(context.request.headers, context.cookies);

  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return new Response(JSON.stringify({ error: 'Exercise not found' }), { status: 404 });
  }

  return new Response(JSON.stringify(data as Exercise), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const prerender = false; // SSR required (dynamic route)
```

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run lint` (ESLint with type-checked rules)
- Build succeeds: `npm run build`
- API route is accessible: `curl http://localhost:4321/api/exercises/a0000000-0000-0000-0000-000000000001` returns 200 with exercise JSON

#### Manual Verification:

- Visit API route in browser: see JSON with `title: "Database Performance Fundamentals"`
- Invalid UUID returns 404: `/api/exercises/invalid` returns `{"error": "Exercise not found"}`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Dashboard with exercise card

### Overview

Replace the placeholder dashboard with an exercise card displaying title, type, difficulty, estimated duration, and a Start button. Clicking navigates to the exercise page.

### Changes Required:

#### 1. ExerciseCard React component

**File**: `src/components/dashboard/ExerciseCard.tsx`

**Intent**: Display a single exercise as a card with visual hierarchy: title (large), type badge, difficulty, estimated time, and prominent Start button.

**Contract**: Accept `exercise: Exercise` prop, render card with shadcn/ui Button, link to `/exercise/[id]`. Uses Button's variant/size props (establishing a new pattern — existing SubmitButton uses custom className, creating inconsistency that will be addressed in a future refactor).

```tsx
import { Play, Clock, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Exercise } from '@/types';

interface Props {
  exercise: Exercise;
}

export default function ExerciseCard({ exercise }: Props) {
  const typeBadgeColor = {
    animated_pacer: 'bg-blue-500/20 text-blue-300',
    smart_questions: 'bg-purple-500/20 text-purple-300',
    focus_sprint: 'bg-green-500/20 text-green-300',
    speed_scan: 'bg-orange-500/20 text-orange-300',
  }[exercise.exercise_type];

  const typeLabel = {
    animated_pacer: 'Animated Pacer',
    smart_questions: 'Smart Questions',
    focus_sprint: 'Focus Sprint',
    speed_scan: 'Speed Scan',
  }[exercise.exercise_type];

  const estimatedMinutes = exercise.estimated_duration_seconds
    ? Math.ceil(exercise.estimated_duration_seconds / 60)
    : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur-xl transition-all hover:border-white/20 hover:bg-white/[0.15]">
      <div className="mb-3 flex items-start justify-between">
        <span className={`rounded-lg px-3 py-1 text-xs font-medium ${typeBadgeColor}`}>
          {typeLabel}
        </span>
        {exercise.difficulty && (
          <span className="flex items-center gap-1 text-xs text-blue-100/60">
            <BarChart3 className="size-3" />
            {exercise.difficulty}
          </span>
        )}
      </div>

      <h3 className="mb-2 text-xl font-bold text-white">{exercise.title}</h3>
      {exercise.description && <p className="mb-4 text-sm text-blue-100/70">{exercise.description}</p>}

      <div className="mb-4 flex items-center gap-2 text-xs text-blue-100/50">
        <Clock className="size-3" />
        {estimatedMinutes ? `~${estimatedMinutes} min` : 'Time varies'}
      </div>

      <a href={`/exercise/${exercise.id}`}>
        <Button className="w-full" size="lg">
          <Play className="size-4" />
          Start Exercise
        </Button>
      </a>
    </div>
  );
}
```

#### 2. Update dashboard page

**File**: `src/pages/dashboard.astro`

**Intent**: Fetch exercises from the database and render the ExerciseCard component. Replace placeholder content.

**Contract**: Query Supabase for all exercises, pass to React component with `client:load`, maintain cosmic theme styling.

```astro
---
import Layout from '@/layouts/Layout.astro';
import { createClient } from '@/lib/supabase';
import ExerciseCard from '@/components/dashboard/ExerciseCard';
import type { Exercise } from '@/types';

const { user } = Astro.locals;
const supabase = createClient(Astro.request.headers, Astro.cookies);

const { data: exercises, error } = await supabase
  .from('exercises')
  .select('*')
  .order('created_at', { ascending: true });

if (error) {
  console.error('Failed to fetch exercises:', error);
}
---

<Layout title="Dashboard">
  <div class="bg-cosmic min-h-screen p-4">
    <div class="mx-auto max-w-5xl">
      <!-- Header -->
      <div class="mb-8 rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
        <h1 class="mb-2 bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-3xl font-bold text-transparent">
          Speed Reading Training
        </h1>
        <p class="text-blue-100/80">
          Welcome back, <span class="font-semibold text-white">{user?.email}</span>
        </p>
        <form method="POST" action="/api/auth/signout" class="mt-4">
          <button
            type="submit"
            class="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/90 transition-colors hover:bg-white/20"
          >
            Sign out
          </button>
        </form>
      </div>

      <!-- Exercise Grid -->
      <div class="grid gap-6 sm:grid-cols-2">
        {exercises && exercises.length > 0 ? (
          exercises.map((exercise) => (
            <ExerciseCard exercise={exercise as Exercise} client:load />
          ))
        ) : (
          <p class="text-blue-100/60">No exercises available yet.</p>
        )}
      </div>
    </div>
  </div>
</Layout>
```

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run lint`
- Build succeeds: `npm run build`
- Component renders without errors: `npm run dev` → no console errors

#### Manual Verification:

- Visit http://localhost:4321/dashboard → see exercise card with title "Database Performance Fundamentals"
- Card shows "Animated Pacer" badge in blue, difficulty "beginner", "~2 min" duration
- Start button is visible and prominent
- Hover effect works (card border brightens)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Animated Pacer exercise UI

### Overview

Create the exercise page with word-by-word highlighting at target WPM pace, comprehension questions after reading, and state tracking for duration and errors.

### Changes Required:

#### 1. AnimatedPacer React component

**File**: `src/components/exercise/AnimatedPacer.tsx`

**Intent**: Render exercise content with sequential word highlighting driven by an interval timer. Track start/end time for duration calculation.

**Contract**: Accept `exercise: Exercise` prop, split content by whitespace, highlight current word with `highlight_color` from config, advance at pace derived from `target_wpm`, emit completion event with `duration_seconds`.

```tsx
import { useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Exercise } from '@/types';

interface Props {
  exercise: Exercise;
  onComplete: (durationSeconds: number) => void;
}

export default function AnimatedPacer({ exercise, onComplete }: Props) {
  const words = exercise.content.split(/\s+/); // Split by whitespace
  const targetWpm = exercise.config.target_wpm || 250;
  const msPerWord = (60 * 1000) / targetWpm; // e.g., 250 WPM = 240ms per word
  const highlightColor = exercise.config.highlight_color || '#3b82f6';

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRunning && currentIndex < words.length) {
      intervalRef.current = window.setInterval(() => {
        setCurrentIndex((prev) => {
          const next = prev + 1;
          if (next >= words.length) {
            setIsRunning(false);
            setIsComplete(true);
            const durationSeconds = startTimeRef.current
              ? Math.floor((Date.now() - startTimeRef.current) / 1000)
              : 0;
            onComplete(durationSeconds);
          }
          return next;
        });
      }, msPerWord);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, currentIndex, words.length, msPerWord, onComplete]);

  const handleStart = () => {
    if (!startTimeRef.current) startTimeRef.current = Date.now();
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {!isRunning && !isComplete && (
          <Button onClick={handleStart} size="lg">
            <Play className="size-4" />
            {currentIndex === 0 ? 'Start Reading' : 'Resume'}
          </Button>
        )}
        {isRunning && (
          <Button onClick={handlePause} variant="outline" size="lg">
            <Pause className="size-4" />
            Pause
          </Button>
        )}
      </div>

      {/* Text Display */}
      <div className="min-h-[400px] rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
        <div className="prose prose-invert mx-auto max-w-3xl text-lg leading-relaxed">
          {words.map((word, index) => (
            <span
              key={index}
              style={{
                backgroundColor: index === currentIndex ? highlightColor : 'transparent',
                padding: index === currentIndex ? '2px 4px' : '0',
                borderRadius: index === currentIndex ? '4px' : '0',
                transition: 'background-color 0.1s ease',
              }}
              className={index === currentIndex ? 'font-semibold text-white' : 'text-blue-100/70'}
            >
              {word}{' '}
            </span>
          ))}
        </div>
      </div>

      {/* Progress */}
      <div className="text-center text-sm text-blue-100/60">
        Word {currentIndex + 1} of {words.length}
      </div>
    </div>
  );
}
```

#### 2. ComprehensionQuiz React component

**File**: `src/components/exercise/ComprehensionQuiz.tsx`

**Intent**: Present 2 multiple-choice questions about the exercise content. Track answers and calculate error count (wrong answers = errors).

**Contract**: Accept `questions` prop (array of question objects with text + options + correct answer index), emit completion with `errors: number`.

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Question {
  text: string;
  options: string[];
  correctIndex: number;
}

interface Props {
  questions: Question[];
  onComplete: (errors: number) => void;
}

export default function ComprehensionQuiz({ questions, onComplete }: Props) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);

  const handleAnswer = (optionIndex: number) => {
    const newAnswers = [...selectedAnswers, optionIndex];
    setSelectedAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Calculate errors
      const errors = questions.reduce((acc, q, i) => {
        return newAnswers[i] !== q.correctIndex ? acc + 1 : acc;
      }, 0);
      onComplete(errors);
    }
  };

  const question = questions[currentQuestion];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/10 p-8 backdrop-blur-xl">
        <div className="mb-4 text-center text-sm text-blue-100/60">
          Question {currentQuestion + 1} of {questions.length}
        </div>
        <h3 className="mb-6 text-center text-xl font-semibold text-white">{question.text}</h3>
        <div className="space-y-3">
          {question.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(index)}
              className={cn(
                'w-full rounded-lg border border-white/20 bg-white/5 p-4 text-left text-white transition-all hover:border-white/40 hover:bg-white/10'
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

#### 3. Exercise page with pacer + quiz flow

**File**: `src/pages/exercise/[id].astro`

**Intent**: Fetch exercise by ID, render AnimatedPacer component, then ComprehensionQuiz after reading completes, then submit completion form.

**Contract**: Dynamic route with SSR (`prerender = false`), protect with auth middleware, render React components with `client:load`, flow: intro → pacer → quiz → submit form with hidden fields (exercise_id, duration, errors).

```astro
---
import Layout from '@/layouts/Layout.astro';
import { createClient } from '@/lib/supabase';
import type { Exercise } from '@/types';
import ExerciseFlow from '@/components/exercise/ExerciseFlow';

export const prerender = false;

const { id } = Astro.params;
const { user } = Astro.locals;

if (!id) {
  return Astro.redirect('/dashboard?error=Invalid+exercise+ID');
}

const supabase = createClient(Astro.request.headers, Astro.cookies);
const { data: exercise, error } = await supabase
  .from('exercises')
  .select('*')
  .eq('id', id)
  .single();

if (error || !exercise) {
  return Astro.redirect('/dashboard?error=Exercise+not+found');
}
---

<Layout title={exercise.title}>
  <div class="bg-cosmic min-h-screen p-4">
    <div class="mx-auto max-w-4xl">
      <div class="mb-6 text-center">
        <h1 class="mb-2 bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-3xl font-bold text-transparent">
          {exercise.title}
        </h1>
        <p class="text-sm text-blue-100/60">
          Read at your own pace. Focus on comprehension.
        </p>
      </div>

      <ExerciseFlow exercise={exercise as Exercise} client:load />
    </div>
  </div>
</Layout>
```

#### 4. ExerciseFlow orchestrator component

**File**: `src/components/exercise/ExerciseFlow.tsx`

**Intent**: Orchestrate the flow: pacer → quiz → submit. Manage state transitions and form submission.

**Contract**: Accept `exercise` prop, render AnimatedPacer then ComprehensionQuiz, submit form to `/api/exercises/complete` with hidden fields (exercise_id, duration, errors only — user_id derived server-side from session). Comprehension questions are hard-coded for the single seeded exercise (intentional for MVP; S-02 will migrate to JSONB storage per plan-brief.md risk flag).

```tsx
import { useState } from 'react';
import AnimatedPacer from './AnimatedPacer';
import ComprehensionQuiz from './ComprehensionQuiz';
import type { Exercise } from '@/types';

interface Props {
  exercise: Exercise;
}

export default function ExerciseFlow({ exercise }: Props) {
  const [step, setStep] = useState<'pacer' | 'quiz' | 'submit'>('pacer');
  const [duration, setDuration] = useState(0);
  const [errors, setErrors] = useState(0);

  // Hard-coded comprehension questions for the seeded exercise
  const questions = [
    {
      text: 'What is the most common index type mentioned in the text?',
      options: ['GIN index', 'B-tree index', 'GiST index', 'Hash index'],
      correctIndex: 1,
    },
    {
      text: 'What is a key tradeoff of having too many indexes?',
      options: [
        'Queries become faster',
        'Storage space increases',
        'INSERT and UPDATE operations become slower',
        'Database crashes',
      ],
      correctIndex: 2,
    },
  ];

  const handlePacerComplete = (durationSeconds: number) => {
    setDuration(durationSeconds);
    setStep('quiz');
  };

  const handleQuizComplete = (errorCount: number) => {
    setErrors(errorCount);
    setStep('submit');
  };

  if (step === 'pacer') {
    return <AnimatedPacer exercise={exercise} onComplete={handlePacerComplete} />;
  }

  if (step === 'quiz') {
    return <ComprehensionQuiz questions={questions} onComplete={handleQuizComplete} />;
  }

  // Auto-submit form when step = 'submit'
  return (
    <form method="POST" action="/api/exercises/complete" className="hidden">
      <input type="hidden" name="exercise_id" value={exercise.id} />
      <input type="hidden" name="duration_seconds" value={duration} />
      <input type="hidden" name="errors" value={errors} />
      <button type="submit" ref={(el) => el?.click()}>Submit</button>
    </form>
  );
}
```

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run lint`
- Build succeeds: `npm run build`
- Exercise page accessible: visit `/exercise/a0000000-0000-0000-0000-000000000001` → no errors

#### Manual Verification:

- Click Start → words highlight sequentially at ~250 WPM pace
- Highlighting is visible (blue background per seed config `#3b82f6`)
- Pause/Resume buttons work correctly
- After last word, quiz appears with 2 questions
- Selecting answers advances to next question
- After second answer, form auto-submits (redirects to completion API)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Completion API and results page

### Overview

Create API route to save exercise completions to the database and a results page to display duration, WPM, error count, and navigation back to dashboard.

### Changes Required:

#### 1. Completion API route

**File**: `src/pages/api/exercises/complete.ts`

**Intent**: Receive form submission with exercise_id, duration_seconds, errors. Derive user_id from authenticated session. Insert into `exercise_completions` table, calculate WPM from exercise content, save to `type_data`, redirect to results page.

**Contract**: Export `POST` function, extract FormData, get user from context.locals.user, validate required fields, insert completion, redirect to `/results/[completion_id]`.

```typescript
import type { APIRoute } from 'astro';
import { createClient } from '@/lib/supabase';

export const POST: APIRoute = async (context) => {
  const { user } = context.locals;

  if (!user) {
    return context.redirect('/auth/signin?error=Authentication+required');
  }

  const formData = await context.request.formData();
  const exerciseId = formData.get('exercise_id') as string;
  const durationSeconds = parseInt(formData.get('duration_seconds') as string, 10);
  const errors = parseInt(formData.get('errors') as string, 10);

  if (!exerciseId || isNaN(durationSeconds) || isNaN(errors)) {
    return context.redirect('/dashboard?error=Invalid+completion+data');
  }

  const supabase = createClient(context.request.headers, context.cookies);

  // Fetch exercise to calculate WPM
  const { data: exercise } = await supabase
    .from('exercises')
    .select('content')
    .eq('id', exerciseId)
    .single();

  if (!exercise) {
    return context.redirect('/dashboard?error=Exercise+not+found');
  }

  const wordCount = exercise.content.split(/\s+/).length;
  const wpm = durationSeconds > 0 ? Math.round(wordCount / (durationSeconds / 60)) : 0;

  // Insert completion
  const { data: completion, error } = await supabase
    .from('exercise_completions')
    .insert({
      user_id: user.id,
      exercise_id: exerciseId,
      duration_seconds: durationSeconds,
      errors,
      type_data: { wpm },
    })
    .select()
    .single();

  if (error || !completion) {
    console.error('Failed to save completion:', error);
    return context.redirect('/dashboard?error=Failed+to+save+completion');
  }

  return context.redirect(`/results/${completion.id}`);
};

export const prerender = false;
```

#### 2. Results page

**File**: `src/pages/results/[id].astro`

**Intent**: Fetch completion by ID, display duration (formatted as MM:SS), WPM, error count, and "Back to Dashboard" button.

**Contract**: Dynamic route, fetch completion + exercise data, render metrics with visual hierarchy, provide navigation.

```astro
---
import Layout from '@/layouts/Layout.astro';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import type { Completion, Exercise } from '@/types';
import { CheckCircle2, XCircle, Clock, Zap } from 'lucide-react';

export const prerender = false;

const { id } = Astro.params;
const { user } = Astro.locals;

if (!id) {
  return Astro.redirect('/dashboard?error=Invalid+completion+ID');
}

const supabase = createClient(Astro.request.headers, Astro.cookies);

const { data: completion, error } = await supabase
  .from('exercise_completions')
  .select('*, exercises(*)')
  .eq('id', id)
  .eq('user_id', user!.id) // Ensure user can only see their own completions
  .single();

if (error || !completion) {
  return Astro.redirect('/dashboard?error=Completion+not+found');
}

const exercise = completion.exercises as unknown as Exercise;
const wpm = completion.type_data?.wpm || 0;
const totalQuestions = 2; // Hard-coded for now (matches quiz)
const correctAnswers = totalQuestions - completion.errors;

// Format duration as MM:SS
const minutes = Math.floor(completion.duration_seconds / 60);
const seconds = completion.duration_seconds % 60;
const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
---

<Layout title="Results">
  <div class="bg-cosmic min-h-screen p-4">
    <div class="mx-auto max-w-3xl">
      <div class="mb-8 text-center">
        <h1 class="mb-2 bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-4xl font-bold text-transparent">
          Exercise Complete!
        </h1>
        <p class="text-blue-100/60">{exercise.title}</p>
      </div>

      <!-- Metrics Grid -->
      <div class="mb-8 grid gap-4 sm:grid-cols-3">
        <!-- Duration -->
        <div class="rounded-2xl border border-white/10 bg-white/10 p-6 text-center backdrop-blur-xl">
          <Clock class="mx-auto mb-2 size-8 text-blue-300" />
          <div class="mb-1 text-3xl font-bold text-white">{formattedDuration}</div>
          <div class="text-xs text-blue-100/60">Duration</div>
        </div>

        <!-- WPM -->
        <div class="rounded-2xl border border-white/10 bg-white/10 p-6 text-center backdrop-blur-xl">
          <Zap class="mx-auto mb-2 size-8 text-purple-300" />
          <div class="mb-1 text-3xl font-bold text-white">{wpm} WPM</div>
          <div class="text-xs text-blue-100/60">Reading Speed</div>
        </div>

        <!-- Comprehension -->
        <div class="rounded-2xl border border-white/10 bg-white/10 p-6 text-center backdrop-blur-xl">
          {completion.errors === 0 ? (
            <CheckCircle2 class="mx-auto mb-2 size-8 text-green-300" />
          ) : (
            <XCircle class="mx-auto mb-2 size-8 text-orange-300" />
          )}
          <div class="mb-1 text-3xl font-bold text-white">
            {correctAnswers}/{totalQuestions}
          </div>
          <div class="text-xs text-blue-100/60">Correct Answers</div>
        </div>
      </div>

      <!-- Navigation -->
      <div class="text-center">
        <a href="/dashboard">
          <Button size="lg" client:load>
            Back to Dashboard
          </Button>
        </a>
      </div>
    </div>
  </div>
</Layout>
```

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run lint`
- Build succeeds: `npm run build`
- API route handles POST: form submission redirects to `/results/[id]`

#### Manual Verification:

- Complete exercise → submit quiz → redirected to results page
- Results show duration (e.g., "1:35"), WPM (calculated correctly from word count), and comprehension (e.g., "1/2" if 1 error)
- Click "Back to Dashboard" → returns to dashboard with exercise card visible

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Integration and navigation

### Overview

Wire up the full flow end-to-end, add protected route for exercise pages, handle edge cases (invalid IDs, unauthorized access), and polish the UX.

### Changes Required:

#### 1. Update middleware to protect exercise and results routes

**File**: `src/middleware.ts`

**Intent**: Add `/exercise/*` and `/results/*` to protected routes so unauthenticated users are redirected to sign-in.

**Contract**: Extend `PROTECTED_ROUTES` array to include new dynamic routes.

```typescript
const PROTECTED_ROUTES = ['/dashboard', '/exercise', '/results'];

// Existing logic checks if request.url starts with any protected route
```

#### 2. Add error handling to dashboard for query params

**File**: `src/pages/dashboard.astro`

**Intent**: Display error messages passed via query params (e.g., `?error=Exercise+not+found`) using the Banner component pattern.

**Contract**: Read `error` from `Astro.url.searchParams`, render Banner if present.

```astro
---
// ... existing imports
import Banner from '@/components/Banner.astro';

const error = Astro.url.searchParams.get('error');
// ... rest of code
---

<Layout title="Dashboard">
  <div class="bg-cosmic min-h-screen p-4">
    {error && (
      <div class="mx-auto mb-4 max-w-5xl">
        <Banner variant="error">{decodeURIComponent(error)}</Banner>
      </div>
    )}
    <!-- ... rest of dashboard -->
  </div>
</Layout>
```

#### 3. Add loading state to ExerciseCard

**File**: `src/components/dashboard/ExerciseCard.tsx`

**Intent**: Show subtle loading indicator when user clicks Start button (before navigation).

**Contract**: Add `disabled` state during navigation to prevent double-clicks.

```tsx
// In ExerciseCard component, wrap Button with loading state:
const [isNavigating, setIsNavigating] = useState(false);

<a href={`/exercise/${exercise.id}`} onClick={() => setIsNavigating(true)}>
  <Button className="w-full" size="lg" disabled={isNavigating}>
    {isNavigating ? (
      <>
        <span className="animate-spin">⏳</span>
        Loading...
      </>
    ) : (
      <>
        <Play className="size-4" />
        Start Exercise
      </>
    )}
  </Button>
</a>
```

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run lint`
- Build succeeds: `npm run build`
- Protected routes work: visiting `/exercise/...` while logged out redirects to `/auth/signin`

#### Manual Verification:

- Full flow works end-to-end: dashboard → exercise → quiz → results → dashboard
- Error handling: invalid exercise ID shows error banner on dashboard
- Unauthenticated access: visiting `/exercise/...` redirects to sign-in
- No console errors during full flow
- WPM calculation is accurate: ~450 words in 120 seconds = ~225 WPM (example)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

Not applicable for this phase (UI-heavy, integration-focused work). Testing deferred to future slice when test infrastructure is established.

### Integration Tests:

Manual browser testing covering:
- Auth flow: sign in → dashboard
- Exercise flow: dashboard → exercise → quiz → results
- Error cases: invalid IDs, unauthenticated access
- Data persistence: completion saved to database, visible in Supabase Studio

### Manual Testing Steps:

1. Start local Supabase: `npx supabase start`
2. Start dev server: `npm run dev`
3. Sign in to app: http://localhost:4321/auth/signin
4. Land on dashboard: see exercise card for "Database Performance Fundamentals"
5. Click Start: navigate to exercise page
6. Start pacer: words highlight sequentially at ~250 WPM
7. Pause/resume: verify controls work
8. Complete reading: quiz appears with 2 questions
9. Answer questions: select options (test both correct and incorrect)
10. Submit: redirected to results page
11. Verify results: duration displayed (e.g., "1:35"), WPM calculated (word count / duration), comprehension shown (e.g., "1/2 correct")
12. Click Back to Dashboard: returns to exercise list
13. Check database: open Supabase Studio → `exercise_completions` table → see new row with `type_data.wpm` populated

## Performance Considerations

- **Pacer interval timing:** 250 WPM = 240ms per word. At ~450 words, pacer runs for ~108 seconds. Browser timers are accurate enough for this (no drift concerns at this scale).
- **Word count calculation:** Done server-side in completion API (not client-side) to prevent tampering. Trivial cost (~450 words = instant split).
- **JSONB query performance:** No JSONB filtering yet (just storing `wpm`). GIN index deferred until S-05 (progress chart) if needed.
- **Image/video assets:** None. Text-only exercises keep page weight minimal.

## References

- Roadmap: `context/foundation/roadmap.md:79-89` (S-01 definition)
- PRD: `context/foundation/prd.md:48-89` (US-01, FR-001, FR-004, FR-006, FR-009, FR-010)
- Database schema: `supabase/migrations/20260605000000_create_exercises_schema.sql`
- Exercise seed data: same migration file, lines 56-83
- Auth pattern: `src/components/auth/SignInForm.tsx:43` (FormData POST)
- Supabase client: `src/lib/supabase.ts:1-24`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: TypeScript types and exercise fetch API

#### Automated

- [x] 1.1 Type checking passes: `npm run lint` — c2dbf78
- [x] 1.2 Build succeeds: `npm run build` — c2dbf78
- [x] 1.3 API route is accessible: `curl http://localhost:4321/api/exercises/a0000000-0000-0000-0000-000000000001` returns 200 — c2dbf78

#### Manual

- [x] 1.4 Visit API route in browser: see JSON with exercise data — c2dbf78
- [x] 1.5 Invalid UUID returns 404 — c2dbf78

### Phase 2: Dashboard with exercise card

#### Automated

- [x] 2.1 Type checking passes: `npm run lint`
- [x] 2.2 Build succeeds: `npm run build`
- [x] 2.3 Component renders without errors: `npm run dev`

#### Manual

- [ ] 2.4 Visit dashboard: see exercise card with correct title and metadata
- [ ] 2.5 Hover effect works on card

### Phase 3: Animated Pacer exercise UI

#### Automated

- [ ] 3.1 Type checking passes: `npm run lint`
- [ ] 3.2 Build succeeds: `npm run build`
- [ ] 3.3 Exercise page accessible with no console errors

#### Manual

- [ ] 3.4 Click Start: words highlight sequentially at correct pace
- [ ] 3.5 Pause/Resume buttons work correctly
- [ ] 3.6 Quiz appears after reading completes
- [ ] 3.7 Form auto-submits after second question answered

### Phase 4: Completion API and results page

#### Automated

- [ ] 4.1 Type checking passes: `npm run lint`
- [ ] 4.2 Build succeeds: `npm run build`
- [ ] 4.3 API route handles POST successfully

#### Manual

- [ ] 4.4 Complete exercise: redirected to results page
- [ ] 4.5 Results show correct duration, WPM, and comprehension metrics
- [ ] 4.6 Back to Dashboard button works

### Phase 5: Integration and navigation

#### Automated

- [ ] 5.1 Type checking passes: `npm run lint`
- [ ] 5.2 Build succeeds: `npm run build`
- [ ] 5.3 Protected routes redirect unauthenticated users

#### Manual

- [ ] 5.4 Full flow works end-to-end: dashboard → exercise → results → dashboard
- [ ] 5.5 Error handling displays messages correctly
- [ ] 5.6 WPM calculation is accurate
- [ ] 5.7 Completion saved to database (verified in Supabase Studio)
