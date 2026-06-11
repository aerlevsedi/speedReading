---
project: Speed-Reading Training App
version: 1
status: draft
created: 2026-06-02
updated: 2026-06-07
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: Speed-Reading Training App

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Developers reading code spend too much time reading slowly, wasting time that could be used for implementation. They want to improve their reading speed with structured practice, measurable progress, and a clear graduation point — proof they've mastered the skill and can stop using the app. Existing speed-reading apps lack progress proof and domain-specific exercises (code snippets, technical documentation). This app fills that gap with **3 exercise types** (originally 4, reduced during implementation — see S-02 note), goal tracking, and a recommendation system that guides users through balanced practice.

## North star

**S-01: User can log in, complete one exercise, see result summary** — the north star is the smallest end-to-end flow that, if it works, proves the product's core hypothesis. Validates the exercise-completion loop (auth → dashboard → exercise → result) before adding variety, recommendations, or progress tracking.

## At a glance

| ID   | Change ID                     | Outcome (user can …)                                                           | Prerequisites | PRD refs                           | Status   |
| ---- | ----------------------------- | ------------------------------------------------------------------------------ | ------------- | ---------------------------------- | -------- |
| F-01 | exercise-data-model-seed      | (foundation) exercise schema + completions table + 1 seeded exercise instance  | —             | FR-018, FR-019                     | done     |
| S-01 | first-exercise-completion     | log in, complete one exercise, see result summary (errors + duration)         | F-01          | US-01, FR-001, FR-004, FR-006, FR-009, FR-010 | done     |
| S-02 | all-exercise-types            | see all 3 exercise types on dashboard and select any (6 total instances)      | S-01          | FR-018, FR-019, FR-006             | in-progress |
| S-03 | goal-comparison               | set a reading speed goal and see goal comparison on result summary            | S-01          | FR-016, FR-017, FR-015             | proposed |
| S-04 | recommendation-system         | see recommended exercise marked on dashboard (least-used algorithm)           | S-01, S-02    | FR-005, FR-020                     | proposed |
| S-05 | progress-chart                | see progress chart comparing current to previous sessions                     | S-01          | FR-014                             | proposed |
| S-06 | retry-different-dataset       | retry same exercise type with different dataset                               | S-02          | FR-012, FR-019                     | proposed |
| S-08 | intro-and-instructions        | see first-time intro on each exercise type, access instructions via icon      | S-02          | FR-007, FR-008                     | proposed |
| S-09 | logout-lifecycle              | log out manually and auto-logout after 1 hour inactivity                      | S-01          | FR-002, FR-003                     | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme              | Chain                                      | Note                                                                                  |
| ------ | ------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| A      | Core loop          | `F-01` → `S-01` → `S-02` → `S-04`          | Sequential backbone: data model → first completion → variety → recommendation.       |
| B      | Progress tracking  | `S-03` / `S-05`                            | Both branch from `S-01`, parallel with each other and with Stream A's `S-02`/`S-04`. |
| C      | UX polish          | `S-06` / `S-08` / `S-09`                   | Parallel refinements; `S-06`/`S-08` join Stream A at `S-02`, `S-09` branches from `S-01`. |

## Baseline

What's already in place in the codebase as of 2026-06-02 (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React 19 islands, Vite build, Tailwind 4, shadcn/ui, file-based routing (`src/pages/`)
- **Backend / API:** present — Astro SSR (`output: "server"`), three auth API routes (`/api/auth/{signin,signup,signout}.ts`)
- **Data:** partial — Supabase client wired (`src/lib/supabase.ts`), but no schema migrations or seeded data
- **Auth:** present — Supabase Auth integrated, session verification in `src/middleware.ts:12`, route protection for `/dashboard`
- **Deploy / infra:** present — `wrangler.jsonc` for Cloudflare Workers, GitHub Actions CI/CD (`.github/workflows/ci.yml`) with auto-deploy on main
- **Observability:** absent — no logging library, no error tracking (Sentry), no metrics/dashboards

## Foundations

### F-01: Exercise data model and minimal seed

- **Outcome:** (foundation) exercise schema + completions table + RLS policies landed; 1 exercise instance seeded for north star validation.
- **Change ID:** exercise-data-model-seed
- **PRD refs:** FR-018 (4 exercise types, later revised to 3 in S-02), FR-019 (2 datasets per type)
- **Unlocks:** S-01 (north star needs 1 exercise to run), S-02 (needs exercises table for 6 instances after Smart Questions removal), S-05 (needs completions history for chart)
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Exercise types originally defined: Animated Pacer (visual speed guide with WPM tracking), Smart Questions (adaptive comprehension), Focus Sprint (timed speed challenge with leaderboard), Speed Scan (skimming/scanning training). Schema supports all 4 types with distinct scoring logic. **Note:** Smart Questions later removed during S-02 implementation (2026-06-08) due to incomplete design (no reading content) and redundancy with Focus Sprint. Final types: Animated Pacer, Focus Sprint, Speed Scan. Domain-specificity decision: generic text for MVP (any prose/articles), code-specific datasets deferred to post-MVP per `main_goal: speed` — the core loop is identical whether text is code or prose; domain-specificity is a content decision, not architectural.
- **Status:** done

## Slices

### S-01: First exercise completion (north star)

- **Outcome:** user can log in, complete one exercise, see result summary (errors + duration)
- **Change ID:** first-exercise-completion
- **PRD refs:** US-01, FR-001 (auth), FR-004 (dashboard), FR-006 (select), FR-009 (start), FR-010 (complete + results)
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is the north star — everything else only matters if this works. Sequenced immediately after F-01 to validate the core loop before adding variety or recommendations. If the exercise-to-result flow has UX or scoring issues, discovering them here (with 1 exercise type) is cheaper than discovering them after building 4 types.
- **Status:** done

### S-02: All exercise types

- **Outcome:** user can see all 3 exercise types on dashboard and select any (6 total instances seeded: 3 types × 2 datasets)
- **Change ID:** all-exercise-types
- **PRD refs:** FR-018 (4 types, revised to 3), FR-019 (2 datasets per type), FR-006 (select)
- **Prerequisites:** S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Adds variety — the multi-type requirement is what distinguishes this from a one-trick app (PRD Vision). Sequenced after north star (S-01) to prove the loop works before scaling to multiple types. Unlocks recommendation (S-04) which needs multiple types to recommend from, and retry-dataset (S-06) which needs 2 datasets per type.
- **Implementation note (2026-06-08):** Originally planned 4 types (Animated Pacer, Smart Questions, Focus Sprint, Speed Scan). During Phase 3-6 implementation, Smart Questions was identified as incomplete (no reading content, only quiz) and redundant with Focus Sprint (both are "read + answer questions"). **Decision: Remove Smart Questions, ship with 3 types.** Final types: **(1) Animated Pacer** (word-by-word guided reading with WPM tracking), **(2) Focus Sprint** (timed reading with countdown pressure + comprehension questions), **(3) Speed Scan** (3-phase: preview questions → scan text → recall answers). Database migration includes all 4 types (8 instances seeded), but dashboard surfaces only 3 types (6 instances). Smart Questions seeds (IDs ending in 011, 012) remain in DB but unused. SmartQuestions.tsx component exists in codebase but is not routed. This preserves flexibility to re-introduce Smart Questions later (e.g., as standalone quiz or Focus Sprint mode toggle) without DB migration.
- **Status:** in-progress

### S-03: Goal comparison

- **Outcome:** user can set a reading speed goal and see goal comparison on result summary
- **Change ID:** goal-comparison
- **PRD refs:** FR-016 (set goal), FR-017 (update goal), FR-015 (goal comparison display)
- **Prerequisites:** S-01
- **Parallel with:** S-04, S-05, S-06, S-08, S-09
- **Blockers:** —
- **Unknowns:**
  - How to guide users on realistic wpm goals? (FR-016 Socrates note: users don't know what's realistic. Options: measure baseline first, suggest ranges, or set smart default.) — Owner: product/UX. Block: no (can ship with a simple input field; guidance is a refinement).
- **Risk:** Validates the "progress proof" wedge (Vision: users want measurable progress). Sequenced after north star but parallel with recommendation (S-04) and chart (S-05) — all three are independent progress-tracking features.
- **Status:** proposed

### S-04: Recommendation system

- **Outcome:** user can see recommended exercise marked on dashboard (least-used algorithm)
- **Change ID:** recommendation-system
- **PRD refs:** FR-005 (recommendation marked), FR-020 (least-used algorithm)
- **Prerequisites:** S-01, S-02
- **Parallel with:** S-03, S-05, S-06, S-08, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Core domain rule (Business Logic: least-used algorithm guides balanced practice). Sequenced after S-02 (needs multiple types to recommend from). Depends on completions history from S-01. Cold-start handled per PRD (default recommendation when all types equally unused).
- **Status:** proposed

### S-05: Progress chart

- **Outcome:** user can see progress chart comparing current to previous sessions
- **Change ID:** progress-chart
- **PRD refs:** FR-014 (results summary with comparison chart)
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, S-06, S-08, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Trend visualization — key for "visible progress" quality (PRD Vision). Sequenced after north star (S-01) which establishes completions history. Parallel with goal comparison (S-03) and recommendation (S-04) — all three are independent progress features. Cold-start handled per FR-014 Socrates note (placeholder message when no history yet).
- **Status:** proposed

### S-06: Retry different dataset

- **Outcome:** user can retry same exercise type with different dataset
- **Change ID:** retry-different-dataset
- **PRD refs:** FR-012 (retry with different dataset), FR-019 (2 datasets per type)
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04, S-05, S-08, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Validates the 2-dataset mechanic (PRD: retry with same dataset is useless — users memorize answers). Sequenced after S-02 which seeds 8 instances (4 types × 2 datasets). Parallel with progress features (S-03/S-04/S-05) — no dependency between them.
- **Status:** proposed

### S-08: Intro and instructions

- **Outcome:** user can see first-time intro on each exercise type, then access instructions via question-mark icon
- **Change ID:** intro-and-instructions
- **PRD refs:** FR-007 (first-time intro), FR-008 (instructions via icon)
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04, S-05, S-06, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Onboarding UX — essential for first-time users (FR-007 Socrates: intro is essential). Sequenced after S-02 which establishes all 4 types (intro needs to be designed per type). Parallel with other refinements.
- **Status:** proposed

### S-09: Logout lifecycle

- **Outcome:** user can log out manually and is auto-logged out after 1 hour inactivity
- **Change ID:** logout-lifecycle
- **PRD refs:** FR-002 (manual logout), FR-003 (auto-logout after 1 hour)
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, S-05, S-06, S-08
- **Blockers:** —
- **Unknowns:**
  - Is auto-logout essential for MVP security? (FR-003 Socrates: auto-logout adds complexity with no clear benefit — consider optional or remove.) — Owner: product/security. Block: no (manual logout is must-have; auto-logout can be deferred if time-constrained).
- **Risk:** Auth lifecycle completeness — manual logout is must-have (FR-002), auto-logout is questioned (FR-003 Socrates note). Sequenced after north star (S-01 establishes login). Parallel with all other slices — no dependency. Consider Parking auto-logout if timeline tightens (main_goal: speed, top_blocker: time).
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                 | Suggested issue title                              | Ready for `/10x-plan` | Notes                                          |
| ---------- | ------------------------- | -------------------------------------------------- | --------------------- | ---------------------------------------------- |
| F-01       | exercise-data-model-seed  | Define 4 exercise types + seed data model          | yes                   | Run `/10x-plan exercise-data-model-seed`       |
| S-01       | first-exercise-completion | Ship first exercise completion (north star)        | no                    | Blocked by F-01                                |
| S-02       | all-exercise-types        | Add all 4 exercise types to dashboard              | no                    | Blocked by S-01                                |
| S-03       | goal-comparison           | Add goal setting and comparison                    | no                    | Blocked by S-01                                |
| S-04       | recommendation-system     | Add least-used recommendation to dashboard         | no                    | Blocked by S-01 + S-02                         |
| S-05       | progress-chart            | Add progress chart to results                      | no                    | Blocked by S-01                                |
| S-06       | retry-different-dataset   | Add retry with different dataset                   | no                    | Blocked by S-02                                |
| S-08       | intro-and-instructions    | Add first-time intro + instructions icon           | no                    | Blocked by S-02                                |
| S-09       | logout-lifecycle          | Add manual logout + auto-logout (if time permits)  | no                    | Blocked by S-01; consider Parking auto-logout  |

## Open Roadmap Questions

1. **How to guide users on realistic wpm goals?** (Measure baseline first, suggest ranges, or set smart default.) — Owner: product/UX. Block: no slice (S-03 can ship with a simple input field; guidance is a refinement). FR-016 Socrates note surfaces this; consider addressing in S-03 planning.

2. **Is auto-logout (FR-003) essential for MVP security?** — Owner: product/security. Block: no slice (manual logout FR-002 is must-have; auto-logout can be deferred). FR-003 Socrates note: "auto-logout adds complexity with no clear benefit." Given `main_goal: speed` and `top_blocker: time`, consider Parking auto-logout and shipping only manual logout in S-09.

## Parked

- **Domain-specific exercises (code snippets, technical docs)** — Why parked: PRD Vision calls for developer-focused content, but MVP ships with generic text datasets per `main_goal: speed`. Exercise mechanics (Animated Pacer, Focus Sprint, Speed Scan) are domain-agnostic — they work identically with code or prose. Domain-specificity is a content decision (which datasets to seed), not architectural; can be swapped post-MVP without rewriting exercise logic. Hard deadline 2026-06-22 prioritizes proving the core loop over curating specialized datasets.

- **Break suggestion after 3 exercises** — Why parked: FR-011 enhancement + Business Logic secondary output. Nice-to-have UX polish deferred per `main_goal: speed`. Hard deadline 2026-06-22 prioritizes core loop over fatigue-prevention messaging.

- **Leaderboard / social features** — Why parked: PRD §Non-Goals explicitly out of MVP scope. Users can see their own progress but not compare with others. (Note: Focus Sprint exercise includes leaderboard schema — deferred to post-MVP if all core slices complete ahead of deadline.)

- **Smart Questions exercise type** — Why parked (removed 2026-06-08 during S-02 implementation): Originally planned as 4th exercise type (progressive multi-step quiz with sequential difficulty). Removed due to: (1) incomplete design — component had no reading content, only quiz questions, making it impossible for users to learn before answering; (2) redundancy with Focus Sprint — both types are "read text + answer questions," insufficient differentiation. Database migration includes Smart Questions seeds (IDs ending in 011, 012) and SmartQuestions.tsx component exists in codebase, but dashboard surfaces only 3 types (Animated Pacer, Focus Sprint, Speed Scan). Preserves flexibility to re-introduce later as standalone quiz feature (no reading) or merge into Focus Sprint as a config toggle (remove countdown, focus on comprehension). Decision documented in `context/changes/all-exercise-types/plan.md` § Design Decisions.

- **Advanced analytics / detailed progress reports** — Why parked: PRD §Non-Goals. Simple charts only (S-05 progress chart + S-03 goal comparison). No drill-down, export, or complex visualizations.

- **Custom exercise creation by users** — Why parked: PRD §Non-Goals. App ships with fixed exercise datasets (4 types × 2 datasets = 8 instances). Users cannot upload text, create exercises, or modify existing ones.

- **Native mobile app** — Why parked: PRD §Non-Goals. Web app accessed via desktop browsers is primary; responsive design acceptable if it doesn't add complexity, but native iOS/Android development is out of scope.

## Done

- **F-01: (foundation) exercise schema + completions table + RLS policies landed; 1 exercise instance seeded for north star validation.** — Archived 2026-06-07 → `context/archive/2026-06-05-exercise-data-model-seed/`. Lesson: —.
- **S-01: user can log in, complete one exercise, see result summary (errors + duration)** — Archived 2026-06-07 → `context/archive/2026-06-05-first-exercise-completion/`. Lesson: —.
