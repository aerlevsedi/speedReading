# All Exercise Types — Plan Brief

> Full plan: `context/changes/all-exercise-types/plan.md`
> Roadmap: `context/foundation/roadmap.md` (S-02)

## What & Why

Expand the speed-reading training app from 1 to 4 exercise types (Animated Pacer, Smart Questions, Focus Sprint, Speed Scan) with 2 datasets each. This proves the product isn't a one-trick app (PRD Vision) and enables varied practice to prevent skill stagnation. Users currently see only one exercise type; they need variety to build well-rounded speed-reading skills.

## Starting Point

Database schema already defines all 4 exercise types in CHECK constraint. Only 1 exercise is seeded (Animated Pacer, dataset_1). ExerciseFlow orchestrates a 2-step pattern (pacer → quiz → submit) that works for Animated Pacer but needs to accommodate 3 new types with distinct UI/mechanics. Dashboard shows all exercises from a simple database query (no dataset selection logic).

## Desired End State

Dashboard displays exactly 4 exercise cards (one per exercise type). Clicking a card automatically loads the alternate dataset based on user history (if they last completed dataset_1, load dataset_2 next time). Each exercise type has distinct UI: Smart Questions shows progressive multi-step quiz, Focus Sprint displays countdown timer with visual pressure cues, Speed Scan implements a 3-phase flow (preview questions → timed scan → information recall). All types save completions with type-specific metrics in the `type_data` JSONB field.

## Key Decisions Made

| Decision                       | Choice            | Why (1 sentence)  | Source |
| ------------------------------ | ----------------- | ----------------- | -------- |
| Smart Questions adaptiveness   | Progressive reveal (multi-step) | Questions unlock sequentially by difficulty — feels adaptive without runtime algorithm complexity, matches existing ComprehensionQuiz pattern. | Plan |
| Focus Sprint leaderboard       | Defer to post-MVP | Honors PRD §Non-Goals and roadmap Parked section — avoids scope creep for hard deadline 2026-06-22. | Plan |
| Speed Scan verification        | Time threshold + pre-task questions | User sees questions before scanning, must recall specific information after — proves they found it, not just comprehended. | Plan |
| Focus Sprint differentiation   | Countdown + pressure cues | Timer with color shifts and progress bar creates urgency — defines "sprint" feel vs Pacer's guided speed. | Plan |
| Dataset content variety        | Unique per type, shared per dataset pair | 4 unique texts (one per type) balance variety with authoring effort — each type's 2 datasets share text but differ in questions/config. | Plan |
| Dataset content topics         | Web dev fundamentals (React, API design, CSS, performance) | Familiar topics for developer persona — easy to author, relatable, diverse enough to avoid repetition. | Plan |
| Dashboard display              | 4 cards (one per type), datasets hidden | Datasets rotate automatically in background — users see exercise types, not dataset IDs; future-proof for N datasets. | Plan |
| Exercise component architecture | Separate component per type | Clear separation of concerns — each type's unique UI/logic isolated, easier to test and maintain, matches existing AnimatedPacer pattern. | Plan |
| Dataset selection logic location | Server-side API endpoint | Centralized logic honors user_id from session (security lesson) — reusable for future recommendation system (S-04). | Plan |
| Cold-start dataset default     | Always dataset_1 first | Deterministic — easy to reason about and test, all users see consistent first experience per type. | Plan |

## Scope

**In scope:**
- 7 new exercise seeds (4 types × 2 datasets - 1 exists) with ~400-word web dev fundamentals text
- 3 new React components: SmartQuestions.tsx, FocusSprint.tsx, SpeedScan.tsx
- Dataset selection API endpoint (`/api/exercises/next-for-type?type=X`)
- Extracted timer hook (`useExerciseTimer`) reusable across all types
- Dashboard query update to fetch one exercise per type (4 API calls)
- ExerciseFlow routing update to render correct component per `exercise_type`

**Out of scope:**
- Leaderboard (PRD §Non-Goals, deferred to post-MVP)
- Truly adaptive difficulty algorithm (Smart Questions uses progressive reveal, not runtime adaptation)
- Code-specific datasets (using generic web dev text — domain-specificity deferred per roadmap F-01 Risk note)
- Interaction tracking for Speed Scan (scroll/click patterns — using simple time threshold)
- Service layer extraction (inline queries following existing pattern)

## Architecture / Approach

Each exercise type gets its own React component following the AnimatedPacer pattern: timer tracking via `useRef`, duration calculation on completion, callback to ExerciseFlow with `(durationSeconds, errors)`. ExerciseFlow acts as a router, rendering the appropriate component based on `exercise.exercise_type`. Dataset selection logic lives in a new API endpoint that queries user's completion history, determines last dataset used for that type, and returns the alternate dataset's exercise (cold-start defaults to `dataset_1`). Dashboard queries this endpoint for each of the 4 exercise types, displaying exactly 4 cards.

```
Dashboard (4 API calls)
  ↓
/api/exercises/next-for-type?type=X (dataset selection)
  ↓
ExerciseFlow (type router)
  ├─ AnimatedPacer (word-by-word highlighting)
  ├─ SmartQuestions (sequential quiz)
  ├─ FocusSprint (countdown + pressure)
  └─ SpeedScan (preview → scan → recall)
```

## Phases at a Glance

| Phase     | What it delivers       | Key risk                  |
| --------- | ---------------------- | ------------------------- |
| 1. Database Seeds | 7 new exercise instances seeded (~400-word texts on React, API design, CSS, performance) | Content quality — technical accuracy and readability of seeded texts |
| 2. Shared Infrastructure | `useExerciseTimer` hook, dataset selection API, updated types | Dataset selection logic correctness — alternation algorithm edge cases (cold-start, first completion) |
| 3. Smart Questions | Progressive reveal quiz component | Question difficulty progression — need 5 questions with meaningful difficulty gradient |
| 4. Focus Sprint | Countdown timer with pressure cues component | Pressure threshold tuning — 60% may not feel urgent enough, or may stress users |
| 5. Speed Scan | 3-phase flow component (preview → scan → recall) | Phase transition complexity — managing state across 3 distinct UIs in one component |
| 6. Dashboard + ExerciseFlow | Dashboard shows 4 cards, ExerciseFlow routes to correct type | Integration — 4 API calls on dashboard load may feel slow; ExerciseFlow routing may break existing Pacer flow |

**Prerequisites:** Phase 1 must complete before others (seeds required for testing). Phases 2-5 can run in parallel (independent components). Phase 6 depends on all prior phases (integration).

**Estimated effort:** ~3-4 sessions across 6 phases

## Open Risks & Assumptions

- **Content authoring effort underestimated** — 7 new ~400-word technical articles may take longer than expected if quality bar is high. Mitigation: prioritize correctness over polish for MVP; can refine text post-launch.
- **4 parallel API calls on dashboard load** — may introduce latency on slow connections. Mitigation: calls are parallel (Promise.all), total time = slowest call, not sum. Can batch into single endpoint post-MVP if needed.
- **Pressure cues in Focus Sprint may backfire** — color shifts intended to motivate could stress users instead. Mitigation: make threshold configurable in `exercise.config`, allow user to disable cues in future iteration.
- **Speed Scan pre-task questions hard-coded** — limits reuse across datasets. Mitigation: acceptable for MVP with 2 datasets; move to database field in future if dataset count grows beyond 5.

## Success Criteria (Summary)

- Dashboard displays exactly 4 exercise cards (one per type)
- Clicking the same exercise type twice in a row loads different datasets (alternation)
- Smart Questions component displays sequential questions with error tracking
- Focus Sprint component shows countdown timer with pressure cues at configurable threshold
- Speed Scan component shows 3-phase flow (preview → scan → recall) with information recall validation
- All exercise types save completions with correct `type_data` metrics
