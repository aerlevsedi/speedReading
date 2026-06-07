# Exercise Data Model and Seed — Plan Brief

> Full plan: `context/changes/exercise-data-model-seed/plan.md`

## What & Why

Create the database foundation for the speed-reading training app: `exercises` and `exercise_completions` tables with Row-Level Security policies, plus 1 seed exercise instance. This is F-01 in the roadmap — the foundation that unlocks S-01 (north star: first exercise completion flow). Without this, the app has nowhere to store exercises or track user progress.

## Starting Point

Supabase is configured (`supabase/config.toml`, `src/lib/supabase.ts`) but only used for authentication. All current database interactions are `supabase.auth.*` calls (signin, signup, getUser). No custom tables exist — `supabase/migrations/` directory is empty.

## Desired End State

Running `npx supabase db reset` creates two tables (`exercises`, `exercise_completions`) with RLS policies enabled, and seeds 1 Animated Pacer exercise with technical prose content. Authenticated users can read all exercises (public read policy), insert their own completions (user-scoped write policy), and read only their own completion history (user-scoped read policy). Unauthenticated users can read exercises but cannot access completions.

## Key Decisions Made

| Decision                       | Choice                                      | Why (1 sentence)                                                                                                      | Source |
| ------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------ |
| Schema design                  | Single table per entity + JSONB for type-specific data | Supports 4 exercise types (Pacer, Questions, Sprint, Scan) without schema changes — follows PostgreSQL best practices for polymorphic data | Plan |
| Completions tracking           | Core metrics (duration, errors) + JSONB type_data | Flexible per-type scoring (WPM, comprehension score) without migrations — matches exercises JSONB pattern | Plan |
| RLS for exercises              | Public read, admin-only write               | Prevents users from modifying curated content — aligns with PRD Non-Goals (no custom exercise creation) | Plan |
| RLS for completions            | User owns their completions (read + insert own, no update/delete) | Users can log attempts and view progress, but can't modify history (prevents cheating) | Plan |
| North star exercise type       | Animated Pacer                              | Simplest to implement (just track reading duration, calculate WPM) — best for validating core loop quickly | Plan |
| Seed content                   | Generic technical prose (database performance article) | Developer-relevant but domain-agnostic — aligns with roadmap (code-specific datasets Parked per main_goal: speed) | Plan |
| Dataset tracking               | dataset_id column in exercises              | Supports S-06 (retry with different dataset) without schema changes — simpler than separate datasets table | Plan |
| Migration strategy             | Single atomic file (tables + RLS + seed)    | Ensures schema and seed land together, impossible to have tables without RLS (security) | Plan |
| Primary keys                   | UUIDs (uuid_generate_v4)                    | Non-sequential IDs prevent enumeration attacks — Supabase default pattern | Plan |
| Text storage                   | TEXT column in database                     | Simple queries, no external dependencies — atomic transactions (text and metadata always in sync) | Plan |
| Indexing                       | Single index on (user_id, completed_at DESC) | Covers known hot query (progress chart: last N completions for user X) — avoids premature optimization | Plan |

## Scope

**In scope:**
- `exercises` table with type enum, JSONB config, TEXT content, dataset_id
- `exercise_completions` table with user_id FK, core metrics, JSONB type_data, index on (user_id, completed_at)
- RLS policies: public read on exercises, user-scoped read+insert on completions
- 1 seed exercise: Animated Pacer with ~450-word technical prose about database indexing
- Migration file: `supabase/migrations/20260605000000_create_exercises_schema.sql`

**Out of scope:**
- Seeding all 8 exercise instances (4 types × 2 datasets) — deferred to S-02
- TypeScript type definitions in `src/types.ts` — deferred to S-01 (implementation needs them)
- Data access service layer — deferred to S-01 (API routes will consume exercises)
- Supabase type generation — deferred to S-01 (when TypeScript types are needed)
- Validation (Zod schemas) — deferred to S-01 (API endpoints will validate)
- Separate datasets table — using simple `dataset_id` column instead
- Leaderboard schema — explicitly Parked per roadmap

## Architecture / Approach

**Single-table design with JSONB flexibility:**
One `exercises` table stores all 4 exercise types (Animated Pacer, Smart Questions, Focus Sprint, Speed Scan) using an `exercise_type` enum and type-specific metadata in a `config` JSONB column. One `exercise_completions` table logs all user attempts with core fields (duration, errors, completed_at) and type-specific metrics (WPM, comprehension score) in a `type_data` JSONB column. This avoids schema migrations when adding new exercise types or metrics.

**RLS-first security:**
Both tables have RLS enabled from creation. Exercises are public-read (all authenticated users can SELECT), admin-write-only (only service role can INSERT/UPDATE/DELETE). Completions are user-scoped: users can INSERT their own (auth.uid() = user_id) and SELECT only their own history (prevents leaking other users' data). No UPDATE/DELETE policies (prevents cheating).

**Minimal indexing:**
Single index on `exercise_completions(user_id, completed_at DESC)` supports the known hot query (progress chart: "last N completions for user X ordered by date"). No other indexes yet — avoids premature optimization for MVP scale (8 exercises, <1000 completions expected per user).

**Atomic migration:**
One migration file creates both tables, enables RLS, defines policies, and seeds 1 exercise — ensures schema and seed land together (impossible to have tables without RLS or seed data).

## Phases at a Glance

| Phase     | What it delivers                                                      | Key risk                                                                 |
| --------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1. Create migration file structure | `supabase/migrations/20260605000000_create_exercises_schema.sql` created | None — simple file creation                                              |
| 2. Define exercises table | `exercises` table with UUID PK, type enum, JSONB config, TEXT content, RLS public read | RLS policy syntax errors; CHECK constraint on exercise_type might fail if typo |
| 3. Define exercise_completions table | `exercise_completions` table with user_id FK, index on (user_id, completed_at), RLS user-scoped policies | Foreign key constraint might fail if auth.users doesn't exist (should be fine — Supabase creates it) |
| 4. Seed north star exercise | 1 Animated Pacer exercise inserted with technical prose content | Content quality — need ~450 words of developer-relevant prose (not trivial to write) |
| 5. Verify migration | Local migration runs cleanly, tables exist, RLS works, seed data present | RLS policy testing requires creating test users and authenticated Supabase client |

**Prerequisites:** Supabase CLI installed (`npx supabase`), local Supabase running (`npx supabase start`), Docker running (Supabase dependency)

**Estimated effort:** ~1 session across 5 phases (Phases 1-3 are straightforward SQL; Phase 4 requires writing ~450 words of content; Phase 5 is verification only)

## Open Risks & Assumptions

- **Supabase CLI version compatibility:** Assumes `npx supabase db reset` works with the current version of Supabase CLI (last tested: unknown). If CLI command syntax changed, migration might fail.
- **auth.users table existence:** Foreign key on `exercise_completions.user_id` references `auth.users(id)`. This table should exist (created by Supabase Auth), but if it doesn't, migration will fail. Mitigation: check table existence in Supabase Studio before running migration.
- **Seed content quality:** The 1 seed exercise uses a ~450-word technical prose article about database indexing. If the content is too simple/complex or doesn't feel developer-relevant, it might not validate the north star properly (S-01 expects realistic exercise content). Mitigation: review content in Phase 4 manual verification step.
- **RLS testing complexity:** Manual verification of RLS policies (Phase 2.5, 2.6, 3.6-3.8) requires creating test users and authenticated Supabase clients. This is more complex than SQL queries alone. Mitigation: use Supabase Studio's SQL Editor with RLS toggle to simulate authenticated user queries.

## Success Criteria (Summary)

- Running `npx supabase db reset` creates `exercises` and `exercise_completions` tables with RLS enabled
- Querying `SELECT * FROM exercises` returns 1 row (Animated Pacer with title "Database Performance Fundamentals")
- Authenticated user can insert their own completion but cannot read other users' completions (RLS policies functional)
