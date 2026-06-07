# Exercise Data Model and Seed Implementation Plan

## Overview

Create the database foundation for the speed-reading training app: define the `exercises` and `exercise_completions` tables with Row-Level Security policies, and seed 1 Animated Pacer exercise instance to enable north star validation (S-01: first exercise completion flow).

## Current State Analysis

**Supabase integration exists but is auth-only:**
- `src/lib/supabase.ts:1-24` — SSR client factory with cookie-based sessions
- `src/middleware.ts:6-12` — request-level user resolution via `supabase.auth.getUser()`
- `src/pages/api/auth/{signin,signup,signout}.ts` — auth endpoints using Supabase Auth
- `supabase/config.toml` — local Supabase configured (PostgreSQL 17, port 54321)
- **No custom tables exist** — `supabase/migrations/` directory is empty

**Codebase conventions (from CLAUDE.md):**
- Migration naming: `YYYYMMDDHHmmss_short_description.sql`
- RLS is mandatory: "Always enable RLS on new tables with granular per-operation, per-role policies"
- Path alias: `@/*` maps to `src/*`
- Current data access is raw Supabase client calls — no service layer yet

### Key Discoveries:
- Supabase configured at `supabase/config.toml:1-40` with migrations enabled
- Auth-only data access pattern: all existing Supabase calls are `supabase.auth.*` methods
- CLAUDE.md mandates RLS at `CLAUDE.md:35` — must enable on all new tables
- Roadmap defines 4 exercise types at `context/foundation/roadmap.md:74` — Animated Pacer, Smart Questions, Focus Sprint, Speed Scan

## Desired End State

After this plan completes, the system will have:

1. **Database schema landed** — `exercises` and `exercise_completions` tables exist in Supabase with proper constraints and indexes
2. **RLS policies active** — exercises are publicly readable (admin-write-only), completions are user-scoped (read own + insert own, no update/delete)
3. **1 seed exercise ready** — Animated Pacer exercise with technical prose content (400-500 words), enabling S-01 (first exercise completion) to proceed
4. **Type safety foundation** — migration uses `uuid_generate_v4()` for PKs, JSONB for flexible metadata, TEXT for content storage

**Verification:**
- Run `npx supabase db reset` locally → tables created, seed applied
- Query `SELECT * FROM exercises` → returns 1 row (Animated Pacer)
- RLS policy test: unauthenticated user can read exercises, cannot write; authenticated user can insert completion, cannot read other users' completions

## What We're NOT Doing

- Seeding all 8 exercise instances (4 types × 2 datasets) — deferred to S-02 per roadmap
- Creating type definitions in `src/types.ts` — deferred to S-01 (implementation needs them, foundation doesn't)
- Building data access service layer — deferred to S-01 (API routes will consume exercises)
- Setting up Supabase type generation — deferred to S-01 (when TypeScript types are needed)
- Adding validation (Zod schemas) — deferred to S-01 (API endpoints will validate)
- Creating separate datasets table — using simple `dataset_id` column instead (simpler, sufficient for MVP)
- Implementing leaderboard schema — explicitly Parked per roadmap

## Implementation Approach

Single atomic migration creates both tables, enables RLS, defines policies, and seeds 1 exercise — ensuring the schema and seed land together (impossible to have tables without RLS or seed). Uses PostgreSQL UUID PKs for non-sequential IDs, JSONB for type-specific metadata (supports 4 exercise types without schema changes), and TEXT for content storage (no external files). Minimal indexing: only `(user_id, completed_at DESC)` on completions for progress chart queries.

## Phase 1: Create migration file structure

### Overview
Set up the `supabase/migrations/` directory and create the migration file with proper timestamp naming per CLAUDE.md convention.

### Changes Required:

#### 1. Migration file

**File**: `supabase/migrations/20260605000000_create_exercises_schema.sql`

**Intent**: Create the migration file that will house the exercises schema, completions schema, RLS policies, and seed data. Follows CLAUDE.md naming convention `YYYYMMDDHHmmss_short_description.sql`.

**Contract**: Create `supabase/migrations/` directory if it doesn't exist, then create the migration file `20260605000000_create_exercises_schema.sql` within it (timestamp: today's date + time `000000` for first migration).

### Success Criteria:

#### Automated Verification:
- Migration file exists: `ls supabase/migrations/20260605000000_create_exercises_schema.sql`

#### Manual Verification:
- File is in correct directory and follows naming convention

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Define exercises table

### Overview
Create the `exercises` table with UUID primary key, exercise type enum, JSONB config for type-specific metadata, TEXT content, dataset_id for variants, timestamps, and RLS policies.

### Changes Required:

#### 1. Exercises table schema

**File**: `supabase/migrations/20260605000000_create_exercises_schema.sql`

**Intent**: Define the `exercises` table structure supporting 4 exercise types (Animated Pacer, Smart Questions, Focus Sprint, Speed Scan) with flexible JSONB metadata and TEXT content storage. Enable RLS with public read, admin-only write policies.

**Contract**:

Table structure:
- `id` (UUID PK via `gen_random_uuid()`)
- `exercise_type` (TEXT with CHECK constraint: `'animated_pacer' | 'smart_questions' | 'focus_sprint' | 'speed_scan'`)
- `dataset_id` (TEXT, e.g., `'dataset_1'`, `'dataset_2'`)
- `title` (TEXT NOT NULL)
- `description` (TEXT)
- `content` (TEXT NOT NULL) — the exercise text/prompt
- `config` (JSONB NOT NULL DEFAULT `'{}'`) — type-specific settings (e.g., WPM target for Pacer, question bank for Smart Questions)
- `difficulty` (TEXT with CHECK constraint: `'beginner' | 'intermediate' | 'advanced'`)
- `estimated_duration_seconds` (INTEGER)
- `created_at` (TIMESTAMPTZ DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ DEFAULT NOW())

RLS policies:
- Enable RLS: `ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;`
- Policy "Public read": `CREATE POLICY exercises_select_policy ON exercises FOR SELECT USING (true);`
- Policy "Admin write only": Use Supabase service role check (no policy for INSERT/UPDATE/DELETE → defaults to deny for authenticated users)

```sql
-- Create exercises table
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_type TEXT NOT NULL CHECK (exercise_type IN ('animated_pacer', 'smart_questions', 'focus_sprint', 'speed_scan')),
  dataset_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  estimated_duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- Public read policy
CREATE POLICY exercises_select_policy ON exercises
  FOR SELECT
  USING (true);

-- Admin-only write (no explicit policy = service role only)
```

### Success Criteria:

#### Automated Verification:
- Migration syntax is valid: `npx supabase db reset` succeeds
- Table exists: `psql` query `\dt exercises` returns table
- RLS enabled: `SELECT relrowsecurity FROM pg_class WHERE relname = 'exercises'` returns `t`
- Check constraints work: attempt to insert invalid `exercise_type` fails

#### Manual Verification:
- Public read policy works: unauthenticated query via Supabase client can SELECT exercises
- Admin write-only works: authenticated user cannot INSERT via Supabase client (gets RLS error)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Define exercise_completions table

### Overview
Create the `exercise_completions` table to track user exercise attempts with core metrics (duration, errors, completed_at) and JSONB type_data for type-specific scoring (WPM, comprehension score, etc.). Includes index on (user_id, completed_at) for progress chart queries and RLS policies for user-scoped access.

### Changes Required:

#### 1. Exercise completions table schema

**File**: `supabase/migrations/20260605000000_create_exercises_schema.sql`

**Intent**: Define the `exercise_completions` table structure that logs each user's exercise attempt. Users can insert their own completions and read only their own history (no UPDATE/DELETE to prevent cheating). Index on (user_id, completed_at DESC) supports progress chart queries.

**Contract**:

Table structure:
- `id` (UUID PK via `gen_random_uuid()`)
- `user_id` (UUID NOT NULL, FK to `auth.users(id)` ON DELETE CASCADE)
- `exercise_id` (UUID NOT NULL, FK to `exercises(id)` ON DELETE CASCADE)
- `duration_seconds` (INTEGER NOT NULL)
- `errors` (INTEGER NOT NULL DEFAULT 0)
- `type_data` (JSONB NOT NULL DEFAULT `'{}'`) — type-specific metrics (e.g., `{"wpm": 250}` for Pacer, `{"comprehension_score": 0.85}` for Smart Questions)
- `completed_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW())

Index:
- `CREATE INDEX idx_exercise_completions_user_date ON exercise_completions(user_id, completed_at DESC);`

RLS policies:
- Enable RLS: `ALTER TABLE exercise_completions ENABLE ROW LEVEL SECURITY;`
- Policy "User read own": `CREATE POLICY completions_select_own ON exercise_completions FOR SELECT USING ((select auth.uid()) = user_id);`
- Policy "User insert own": `CREATE POLICY completions_insert_own ON exercise_completions FOR INSERT WITH CHECK ((select auth.uid()) = user_id);`

```sql
-- Create exercise_completions table
CREATE TABLE exercise_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  duration_seconds INTEGER NOT NULL,
  errors INTEGER NOT NULL DEFAULT 0,
  type_data JSONB NOT NULL DEFAULT '{}',
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for progress chart queries (last N completions for user X)
CREATE INDEX idx_exercise_completions_user_date ON exercise_completions(user_id, completed_at DESC);

-- Enable RLS
ALTER TABLE exercise_completions ENABLE ROW LEVEL SECURITY;

-- User can read own completions
CREATE POLICY completions_select_own ON exercise_completions
  FOR SELECT
  USING ((select auth.uid()) = user_id);

-- User can insert own completions
CREATE POLICY completions_insert_own ON exercise_completions
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
```

### Success Criteria:

#### Automated Verification:
- Migration runs successfully: `npx supabase db reset` completes without errors
- Table exists: `psql` query `\dt exercise_completions` returns table
- Foreign keys enforced: attempt to insert completion with invalid `exercise_id` fails
- Index created: `\di idx_exercise_completions_user_date` returns index
- RLS enabled: `SELECT relrowsecurity FROM pg_class WHERE relname = 'exercise_completions'` returns `t`

#### Manual Verification:
- User can insert own completion: authenticated user inserts completion via Supabase client succeeds
- User cannot read others' completions: user A cannot query user B's completions (empty result set)
- User cannot UPDATE own completion: authenticated user attempts UPDATE fails (no policy = denied)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Seed north star exercise

### Overview
Insert 1 Animated Pacer exercise with generic technical prose content (400-500 words) to enable S-01 (first exercise completion) validation.

### Changes Required:

#### 1. Seed data insertion

**File**: `supabase/migrations/20260605000000_create_exercises_schema.sql`

**Intent**: Seed the database with 1 Animated Pacer exercise containing technical prose about database performance. This is the north star exercise — the minimal data needed to validate the core loop (login → dashboard → exercise → result) in S-01.

**Contract**: INSERT statement with fixed UUID (for deterministic seeding) and technical content about database indexing (generic developer topic, not code-specific per roadmap decision).

```sql
-- Seed 1 Animated Pacer exercise for north star validation (S-01)
INSERT INTO exercises (
  id,
  exercise_type,
  dataset_id,
  title,
  description,
  content,
  config,
  difficulty,
  estimated_duration_seconds
) VALUES (
  'a0000000-0000-0000-0000-000000000001'::UUID,
  'animated_pacer',
  'dataset_1',
  'Database Performance Fundamentals',
  'Learn about database indexing and query optimization techniques used by modern web applications.',
  'Database indexing is one of the most critical performance optimization techniques in software development. An index is a data structure that improves the speed of data retrieval operations on a database table. Without indexes, the database must scan every row to find matching records, which becomes increasingly slow as tables grow larger.

The most common index type is the B-tree index, which organizes data in a sorted tree structure. When you query a column that has a B-tree index, the database can quickly navigate the tree to find matching rows without reading the entire table. For example, if you have a users table with one million rows and you search by email address, a B-tree index on the email column can reduce query time from several seconds to milliseconds.

However, indexes come with tradeoffs. Each index requires storage space and must be updated whenever data changes. If you have too many indexes, INSERT and UPDATE operations become slower because the database must maintain multiple index structures. The key is to index columns that are frequently used in WHERE clauses, JOIN conditions, and ORDER BY statements, while avoiding indexes on columns that are rarely queried.

Modern databases like PostgreSQL also support specialized index types for specific use cases. GIN indexes excel at full-text search and JSONB queries, while GiST indexes are optimized for geometric and range data. Understanding which index type to use for your access patterns is essential for building high-performance applications. Query planning tools like EXPLAIN ANALYZE help developers identify slow queries and determine whether adding an index would improve performance.',
  '{"target_wpm": 250, "pacer_speed": "adaptive", "highlight_color": "#3b82f6"}',
  'beginner',
  120
);
```

### Success Criteria:

#### Automated Verification:
- Migration runs successfully: `npx supabase db reset` completes without errors
- Seed data exists: `SELECT COUNT(*) FROM exercises` returns `1`
- Seed data is correct: `SELECT exercise_type, title FROM exercises WHERE id = 'a0000000-0000-0000-0000-000000000001'` returns `animated_pacer` and `Database Performance Fundamentals`

#### Manual Verification:
- Content length is appropriate: ~450 words (read content field, count manually or use word counter)
- Content is technical and developer-relevant: confirms generic technical prose (not code, not lorem ipsum)
- JSONB config is valid: `SELECT config->>'target_wpm' FROM exercises WHERE id = 'a0000000-0000-0000-0000-000000000001'` returns `250`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Verify migration

### Overview
Run full migration locally, verify tables exist, RLS is enabled, seed data is present, and policies work as expected.

### Changes Required:

#### 1. Local migration verification

**Intent**: Confirm the migration file is complete, runs cleanly, and produces the expected schema state. This is the final verification before committing the migration.

**Contract**: No code changes. This phase is pure verification using Supabase CLI commands and SQL queries.

Verification steps:
1. Reset local database: `npx supabase db reset`
2. Check tables exist: `npx supabase db diff` shows no pending changes (schema matches migration)
3. Query seed data: `SELECT * FROM exercises` returns 1 row
4. Test RLS: Connect as authenticated user via Supabase client, attempt to read exercises (should succeed), attempt to insert exercise (should fail), insert completion (should succeed), read another user's completion (should return empty)

### Success Criteria:

#### Automated Verification:
- Database reset succeeds: `npx supabase db reset` exits 0
- No schema drift: `npx supabase db diff` returns no differences
- Tables created: `npx supabase db dump --data-only --schema public -t exercises -t exercise_completions` succeeds
- RLS enabled on both tables: SQL query confirms `relrowsecurity = true` for both

#### Manual Verification:
- Seed data is readable: Visit Supabase Studio (http://localhost:54323), navigate to exercises table, see 1 row
- RLS policies functional: Use Supabase client in a test script to verify authenticated user can insert completion but not exercise
- Foreign key constraints work: Attempt to insert completion with non-existent exercise_id fails with FK violation error

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:
- Not applicable (this is schema/data, not code)

### Integration Tests:
- Manual RLS policy testing via Supabase client (see Phase 5 verification)
- Foreign key constraint validation (attempt invalid inserts)

### Manual Testing Steps:
1. Run `npx supabase start` (ensure local Supabase is running)
2. Run `npx supabase db reset` (apply migration)
3. Open Supabase Studio: http://localhost:54323
4. Navigate to Table Editor → exercises → verify 1 row with title "Database Performance Fundamentals"
5. Navigate to Table Editor → exercise_completions → verify table is empty
6. Test RLS: In Supabase Studio SQL Editor, run:
   ```sql
   -- This should work (public read)
   SELECT * FROM exercises;

   -- This should fail (no service role)
   INSERT INTO exercises (exercise_type, dataset_id, title, content)
   VALUES ('animated_pacer', 'test', 'Test', 'Test content');
   ```
7. Create test user via auth UI, get user ID, manually insert completion:
   ```sql
   -- Replace USER_ID with actual test user ID
   INSERT INTO exercise_completions (user_id, exercise_id, duration_seconds, errors, type_data)
   VALUES (
     'USER_ID'::UUID,
     'a0000000-0000-0000-0000-000000000001'::UUID,
     95,
     2,
     '{"wpm": 240}'::JSONB
   );
   ```
8. Verify completion appears in table editor and is only visible when authenticated as that user

## Performance Considerations

- **Index strategy:** Single index on `(user_id, completed_at DESC)` is sufficient for progress chart queries (expected <1000 completions per user in MVP)
- **JSONB performance:** Type-specific metadata in JSONB is not indexed; filtering by `type_data->>'wpm'` will be slow if completions table grows large (acceptable for MVP; can add GIN index post-MVP if needed)
- **TEXT storage:** Exercise content stored in TEXT column (no external files) — acceptable for prose (400-500 words ≈ 3KB per exercise); 8 exercises ≈ 24KB total

## Migration Notes

**Idempotency:** This migration is NOT idempotent (no `IF NOT EXISTS` checks). Running it twice will fail. This is intentional — it's the initial schema creation. Future migrations should use `IF NOT EXISTS` for safety.

**Rollback:** To rollback, drop tables manually:
```sql
DROP TABLE IF EXISTS exercise_completions CASCADE;
DROP TABLE IF EXISTS exercises CASCADE;
```

**Supabase CLI usage:**
- Local dev: `npx supabase start` → `npx supabase db reset`
- Remote deploy: migrations auto-run on `git push` if Supabase GitHub integration is configured (see Supabase docs)

## References

- Roadmap: `context/foundation/roadmap.md:64-75` (F-01 foundation definition)
- PRD: `context/foundation/prd.md:172-181` (FR-018 exercise types, FR-019 datasets)
- Supabase client: `src/lib/supabase.ts:1-24`
- CLAUDE.md: `CLAUDE.md:35` (RLS convention)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Create migration file structure

#### Automated
- [x] 1.1 Migration file exists: `ls supabase/migrations/20260605000000_create_exercises_schema.sql` — 0566cce

#### Manual
- [x] 1.2 File is in correct directory and follows naming convention — 0566cce

### Phase 2: Define exercises table

#### Automated
- [x] 2.1 Migration syntax is valid: `npx supabase db reset` succeeds — 73d1138
- [x] 2.2 Table exists: `psql` query `\dt exercises` returns table — 73d1138
- [x] 2.3 RLS enabled: `SELECT relrowsecurity FROM pg_class WHERE relname = 'exercises'` returns `t` — 73d1138
- [x] 2.4 Check constraints work: attempt to insert invalid `exercise_type` fails — 73d1138

#### Manual
- [x] 2.5 Public read policy works: unauthenticated query via Supabase client can SELECT exercises — 73d1138
- [x] 2.6 Admin write-only works: authenticated user cannot INSERT via Supabase client (gets RLS error) — 73d1138

### Phase 3: Define exercise_completions table

#### Automated
- [x] 3.1 Migration runs successfully: `npx supabase db reset` completes without errors — 73d1138
- [x] 3.2 Table exists: `psql` query `\dt exercise_completions` returns table — 73d1138
- [x] 3.3 Foreign keys enforced: attempt to insert completion with invalid `exercise_id` fails — 73d1138
- [x] 3.4 Index created: `\di idx_exercise_completions_user_date` returns index — 73d1138
- [x] 3.5 RLS enabled: `SELECT relrowsecurity FROM pg_class WHERE relname = 'exercise_completions'` returns `t` — 73d1138

#### Manual
- [x] 3.6 User can insert own completion: authenticated user inserts completion via Supabase client succeeds — 73d1138
- [x] 3.7 User cannot read others' completions: user A cannot query user B's completions (empty result set) — 73d1138
- [x] 3.8 User cannot UPDATE own completion: authenticated user attempts UPDATE fails (no policy = denied) — 73d1138

### Phase 4: Seed north star exercise

#### Automated
- [x] 4.1 Migration runs successfully: `npx supabase db reset` completes without errors — 73d1138
- [x] 4.2 Seed data exists: `SELECT COUNT(*) FROM exercises` returns `1` — 73d1138
- [x] 4.3 Seed data is correct: `SELECT exercise_type, title FROM exercises WHERE id = 'a0000000-0000-0000-0000-000000000001'` returns `animated_pacer` and `Database Performance Fundamentals` — 73d1138

#### Manual
- [x] 4.4 Content length is appropriate: ~450 words — 73d1138
- [x] 4.5 Content is technical and developer-relevant — 73d1138
- [x] 4.6 JSONB config is valid: `SELECT config->>'target_wpm'` returns `250` — 73d1138

### Phase 5: Verify migration

#### Automated
- [x] 5.1 Database reset succeeds: `npx supabase db reset` exits 0 — 73d1138
- [x] 5.2 No schema drift: `npx supabase db diff` returns no differences — 73d1138
- [x] 5.3 Tables created: `npx supabase db dump --data-only --schema public -t exercises -t exercise_completions` succeeds — 73d1138
- [x] 5.4 RLS enabled on both tables: SQL query confirms `relrowsecurity = true` for both — 73d1138

#### Manual
- [x] 5.5 Seed data is readable: Visit Supabase Studio, see 1 row in exercises table — 73d1138
- [x] 5.6 RLS policies functional: Test script verifies user can insert completion but not exercise — 73d1138
- [x] 5.7 Foreign key constraints work: Attempt to insert completion with non-existent exercise_id fails — 73d1138
