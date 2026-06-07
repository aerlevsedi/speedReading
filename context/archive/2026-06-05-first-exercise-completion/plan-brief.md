# First Exercise Completion — Plan Brief

> Full plan: `context/changes/first-exercise-completion/plan.md`

## What & Why

Deliver the north star flow for the speed-reading training app: authenticated user can view their dashboard, start the Animated Pacer exercise, complete it with word-by-word highlighting at target WPM pace, answer comprehension questions, and see a results summary showing duration, WPM, and error count. This validates the core exercise loop (select → read → complete → results) before adding variety, recommendations, or progress tracking.

## Starting Point

Auth and database foundation are complete: Supabase SSR protects `/dashboard` (src/middleware.ts:6-12), `exercises` and `exercise_completions` tables exist with RLS policies, and 1 Animated Pacer exercise is seeded ("Database Performance Fundamentals", ~450 words). Dashboard currently shows only user email and sign-out button — no exercise UI yet.

## Desired End State

User lands on dashboard → sees exercise card (title, type badge, difficulty, estimated time, Start button) → clicks Start → navigates to exercise page → sees word-by-word pacer highlighting at 250 WPM → completes reading → answers 2 comprehension questions → submits → sees results page (duration as MM:SS, calculated WPM, comprehension score) → clicks Back to Dashboard. Completion is saved to `exercise_completions` table with `type_data.wpm` populated.

## Key Decisions Made

| Decision                       | Choice            | Why (1 sentence)  | Source |
| ------------------------------ | ----------------- | ----------------- | ------ |
| Pacer UI pattern               | Highlight current word/phrase sequentially | Classic speed-reading pattern users recognize, forces pacing discipline | Plan |
| Error tracking method          | Comprehension questions at end (2 MCQ) | Validates understanding, simple to implement, matches Smart Questions pattern for consistency | Plan |
| Dashboard display              | Exercise card with metadata + Start button | Matches PRD FR-004 (dashboard with cards), extensible for S-02 (7 more cards) | Plan |
| Completion flow                | POST to API → insert → redirect to results page | Follows existing auth pattern (FormData + redirect), separates results display from exercise UI | Plan |
| Results metrics                | Duration, WPM, errors, Back to Dashboard | Matches PRD FR-010 (errors + duration), adds WPM for actionability, no chart yet (S-05) | Plan |
| TypeScript types location      | src/types.ts (shared types file) | Matches CLAUDE.md convention for shared types, single source of truth | Plan |
| WPM calculation                | word count / (duration_seconds / 60) | Standard speed-reading metric, matches seed config target_wpm field | Plan |

## Scope

**In scope:**
- TypeScript types for Exercise and Completion entities
- API route to fetch exercise by ID
- Dashboard exercise card component with cosmic theme styling
- Animated Pacer: word-by-word highlighting with interval timer at target WPM
- Comprehension quiz: 2 MCQ questions after reading
- Completion API: save to database with WPM calculation
- Results page: display duration (MM:SS), WPM, comprehension (N/2 correct)
- Protected routes for /exercise/* and /results/*
- Error handling for invalid IDs and unauthorized access

**Out of scope:**
- Multiple exercise instances (S-02 adds 7 more)
- Progress chart comparing sessions (S-05)
- Goal setting/comparison (S-03)
- Recommendation logic (S-04)
- Retry with different dataset (S-06)
- First-time intro modal (S-08)
- Pause/resume persistence (enhancement post-MVP)
- Mobile optimization beyond responsive layout

## Architecture / Approach

**Frontend**: Astro SSR pages + React islands (`client:load`) for interactive components (ExerciseCard, AnimatedPacer, ComprehensionQuiz). Follows cosmic theme styling (bg-cosmic gradient, glass morphism cards).

**Backend**: API routes for fetching exercises (`GET /api/exercises/[id]`) and saving completions (`POST /api/exercises/complete`). FormData extraction → Supabase insert → redirect pattern (matches auth routes).

**Data flow**: Dashboard queries `exercises` table → user clicks Start → exercise page fetches via API → pacer tracks duration → quiz tracks errors → form submits to completion API → WPM calculated server-side → completion inserted → redirect to results → results page fetches completion + exercise → displays metrics.

**Key patterns**: `cn()` for Tailwind class merging, shadcn/ui Button component, path alias `@/*` for imports, RLS policies enforce user-scoped completions.

## Phases at a Glance

| Phase     | What it delivers       | Key risk                  |
| --------- | ---------------------- | ------------------------- |
| 1. Types + API | TypeScript interfaces, exercise fetch endpoint | Type safety foundation; API contract must match DB schema exactly |
| 2. Dashboard card | Exercise card component on dashboard | Card styling must match cosmic theme, Start button UX critical for flow |
| 3. Pacer UI | Word-by-word highlighting + quiz | Timer accuracy at 250 WPM (240ms/word), comprehension questions hard-coded for seed exercise |
| 4. Completion + results | API saves completion, results page displays metrics | WPM calculation logic (word count / duration) must be accurate, results UX is payoff moment |
| 5. Integration | Full flow wired, protected routes, error handling | End-to-end flow brittle — any phase failure breaks north star validation |

**Prerequisites:** F-01 complete (exercise schema + seed data landed)
**Estimated effort:** ~5 phases across 2-3 sessions (each phase has automated + manual verification)

## Open Risks & Assumptions

- **Comprehension questions are hard-coded** for the seeded exercise ("Database Performance Fundamentals"). S-02 (all exercise types) will need a scalable question storage mechanism (JSONB in exercises table or separate questions table).
- **No pause/resume persistence**: if user refreshes during exercise, state is lost. Acceptable for MVP; enhancement post-MVP could save progress to localStorage or server.
- **Timer accuracy assumption**: browser `setInterval` at 240ms/word is accurate enough for perceived 250 WPM pace. No drift correction implemented.
- **Single exercise only**: dashboard shows 1 card. S-02 adds variety; this phase proves the loop works.

## Success Criteria (Summary)

- User can complete full flow: sign in → dashboard → start exercise → pacer highlights words → answer quiz → see results with WPM → return to dashboard
- Completion is saved to database with correct `type_data.wpm` value
- Results page displays duration (formatted MM:SS), calculated WPM (word count / duration), and comprehension (errors out of 2 questions)
