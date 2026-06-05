<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Exercise Data Model and Seed

- **Plan**: context/changes/exercise-data-model-seed/plan.md
- **Mode**: Deep
- **Date**: 2026-06-05
- **Verdict**: SOUND
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding
5/5 paths ✓, auth.users verified ✓, brief↔plan ✓

## Findings

### F1 — RLS policy performance optimization available

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Define exercise_completions table
- **Detail**: Plan uses `auth.uid() = user_id` in RLS policies (plan.md:191-192, 213-220). Supabase docs recommend wrapping in SELECT for caching: `(select auth.uid()) = user_id`. Without wrapping, Postgres calls auth.uid() on each row instead of once per statement. At MVP scale (<1000 completions/user) the performance difference is negligible, but the wrapped version is free optimization.
- **Fix**: Replace `auth.uid()` with `(select auth.uid())` in both RLS policies.
  - Strength: Zero cost optimization — same security, better query plan. Matches Supabase performance best practices.
  - Tradeoff: None — strictly better.
  - Confidence: HIGH — documented in official Supabase RLS performance guide.
  - Blind spot: None significant.
- **Decision**: FIXED (applied optimization)

### F2 — Migration directory creation not explicit in Phase 1

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Create migration file structure
- **Detail**: Phase 1 says "Set up the supabase/migrations/ directory" (plan.md:59) but the changes only specify creating the .sql file. Grounding check confirms supabase/migrations/ does not exist. The implementer might assume "create file" implies "create directory" but being explicit avoids a trivial failure.
- **Fix**: Add explicit mkdir step or clarify that creating the file creates the parent directory. In the Contract field of Phase 1, add: "Create supabase/migrations/ directory if it doesn't exist, then create the migration file within it."
- **Decision**: FIXED (clarified in Contract field)

### F3 — Consider gen_random_uuid() over uuid-ossp extension

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — Define exercises table
- **Detail**: Plan uses uuid-ossp extension with uuid_generate_v4() (plan.md:117-118). This works fine (Supabase enables uuid-ossp by default), but PostgreSQL's native gen_random_uuid() (available since PG 13) is simpler and more portable. Supabase blog post (2022) recommends gen_random_uuid() as the modern default. Not a problem — just an observation. The plan's approach is functionally correct and will work. Switching to gen_random_uuid() removes the extension dependency and aligns with current Supabase best practices.
- **Fix A ⭐ Recommended**: Replace uuid_generate_v4() with gen_random_uuid()
  - Strength: No extension needed, native Postgres, matches 2022+ Supabase recommendations. One less dependency to think about.
  - Tradeoff: None — functionally identical UUIDs.
  - Confidence: HIGH — gen_random_uuid() is the modern Postgres standard.
  - Blind spot: None.
- **Fix B**: Keep uuid-ossp as planned
  - Strength: Works fine, uuid-ossp is enabled by default in Supabase.
  - Tradeoff: Adds extension dependency that's no longer necessary.
  - Confidence: HIGH — this will work, just not the newest pattern.
  - Blind spot: None.
- **Decision**: FIXED (applied Fix A — switched to gen_random_uuid())

## Verification Details

### Claim 1: auth.users table exists for FK reference
**VERDICT: ✅ CONFIRMED**

Evidence:
- Supabase Auth is configured and active (supabase/config.toml:150-151)
- Active usage in src/middleware.ts:10-12 and src/pages/api/auth/signup.ts:13
- Official Supabase documentation confirms auth.users table is automatically created by Supabase Auth service
- FK constraint `REFERENCES auth.users(id) ON DELETE CASCADE` will work

### Claim 2: RLS policy syntax using auth.uid()
**VERDICT: ⚠️ CORRECT BUT SUBOPTIMAL**

Evidence:
- auth.uid() is the correct Supabase function (confirmed in official docs)
- Plan uses it in completions policies correctly
- Performance best practice: wrap in SELECT for caching — `(select auth.uid()) = user_id`
- The wrapped version causes Postgres optimizer to cache the function result per-statement instead of calling on each row
- **FIXED** in plan via F1 triage

### Claim 3: No existing table/migration conflicts
**VERDICT: ✅ CONFIRMED**

Evidence:
- No migrations directory exists (supabase/migrations/ NOT FOUND)
- No seed.sql file exists
- No existing database operations in codebase (auth-only)
- Zero conflicts — plan will create both directory and first migration file

### Blast Radius
Zero conflicts. No existing schema, tables, or database queries in src/.

### Pattern Alignment
- JSONB usage: **New pattern** (no prior usage)
- RLS policies: **New pattern** (first tables with RLS)
- Migration files: **First migration** (directory doesn't exist yet)
- UUID generation: **Switched to native gen_random_uuid()** (modern Postgres standard)

## Summary

All 3 findings addressed:
- F1: Fixed — RLS performance optimization applied
- F2: Fixed — Explicit directory creation in Contract
- F3: Fixed — Switched to gen_random_uuid()

**Final Verdict: SOUND** — Safe to implement with all fixes applied.
