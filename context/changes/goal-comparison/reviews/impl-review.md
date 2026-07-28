<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Goal Setting and Comparison (S-03)

- **Plan**: context/changes/goal-comparison/plan.md
- **Scope**: All phases (1–4)
- **Date**: 2026-07-27
- **Verdict**: APPROVED (all findings fixed — 70453d8)
- **Findings**: 2 critical, 3 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — UPDATE policy missing WITH CHECK; no DELETE policy

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260727000000_create_user_goals.sql:21
- **Detail**: The UPDATE policy uses only `USING (auth.uid() = user_id)` — no `WITH CHECK`. This means RLS does not re-validate that `user_id` remains owned by the caller after the update. Additionally there is no DELETE policy, so users cannot delete their own goal row (CASCADE on auth.users handles account deletion, but explicit user-initiated delete has no RLS path).
- **Fix A ⭐ Recommended**: Add `WITH CHECK (auth.uid() = user_id)` to the UPDATE policy and a DELETE policy via a new migration
  - Strength: Closes the RLS gap and aligns with Supabase best practice for mutable user-scoped tables; new migration is non-destructive.
  - Tradeoff: Requires a new migration file and a local `supabase db reset` to verify.
  - Confidence: HIGH — identical pattern used in existing exercise_completions policies.
  - Blind spot: If any admin flow needs to update user_id (unlikely), the WITH CHECK would block it — but admin flows should use service role anyway.
- **Fix B**: Accept current state, document risk
  - Strength: No migration needed; CASCADE delete covers account-removal case.
  - Tradeoff: Leaves a subtle RLS gap; future policy additions may miss the WITH CHECK pattern.
  - Confidence: LOW — the gap is real even if the exploit path is narrow.
- **Decision**: FIXED — 70453d8

### F2 — No UUID validation on id path param before DB call

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/results/[id].astro:26
- **Detail**: `id` from `Astro.params` is passed directly to `.eq("id", id)` without format validation. Malformed IDs cause a Supabase round-trip (PGRST116 error) instead of an early exit. Also, the user auth guard (line 22) comes after `createClient` (line 17), which is wasteful — client is instantiated for unauthenticated requests that will be redirected anyway. No auth bypass risk exists because the query includes `.eq("user_id", user.id)`, but it is unnecessary DB exposure for bad inputs.
- **Fix**: Add UUID format check before the Supabase query and move user check before client creation to match the pattern in dashboard.astro
- **Decision**: FIXED — 70453d8

### F3 — Two-step query for latestWpm should be a single JOIN

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard.astro:27
- **Detail**: Fetches all focus_sprint exercise IDs first, then queries completions with `.in("exercise_id", apIds)`. This is two Supabase round-trips where one JOIN suffices. At current scale it is fine, but the two-step pattern sends all focus_sprint IDs as query params on each dashboard load.
- **Fix**: Replace with a single PostgREST join: `.from("exercise_completions").select("type_data, exercises!inner(exercise_type)").eq("user_id", user.id).eq("exercises.exercise_type", "focus_sprint").order("completed_at", {ascending: false}).limit(1).maybeSingle()`
- **Decision**: FIXED — 70453d8

### F4 — Goal and latestWpm fetch errors silently swallowed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard.astro:23
- **Detail**: `goalResult.error` and `latestResult.error` are never checked. Supabase failures silently degrade to `null` values — the widget shows "Set your reading speed goal" even when the user has a goal but the DB call failed. The exercise fetch (lines 49–57) uses try/catch and redirects on error; the goal/WPM fetches are inconsistent with that pattern.
- **Fix**: Add `if (goalResult.error) console.error(...)` checks after each query (same approach as the existing console.error in complete.ts). Silent degradation to null is acceptable for non-critical data, but errors should be logged.
- **Decision**: FIXED — 70453d8

### F5 — JSON vs redirect API contract undocumented

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/goals/set.ts:1
- **Detail**: `set.ts` returns JSON responses (correct for fetch()-based client consumption), while sibling routes `complete.ts` and `signin.ts` use `context.redirect()`. This is an intentional divergence but nothing in the file documents why, creating a maintainability trap where a future dev might "normalize" it toward redirects.
- **Fix**: Add a one-line comment at the top of the file: `// JSON contract — consumed via fetch() from GoalWidget; not a form-submit endpoint`
- **Decision**: FIXED — 70453d8

### F6 — URLSearchParams body makes Content-Type implicit

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/dashboard/GoalWidget.tsx:39
- **Detail**: `fetch("/api/goals/set", { method: "POST", body })` where `body` is `URLSearchParams` — the browser/runtime sets `Content-Type: application/x-www-form-urlencoded` implicitly, which Cloudflare Workers' `request.formData()` handles correctly. Relying on implicit content-type is fragile if the transport changes.
- **Fix**: Add `headers: { "Content-Type": "application/x-www-form-urlencoded" }` to the fetch call to make the contract explicit.
- **Decision**: FIXED — 70453d8

### F7 — Stale comment in dashboard.astro

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/dashboard.astro:27
- **Detail**: Comment reads `// Fetch latest Animated Pacer WPM` but the query correctly targets `focus_sprint`. Left over from the mid-implementation decision to switch exercise types.
- **Fix**: Change comment to `// Fetch latest Focus Sprint WPM`
- **Decision**: FIXED — 70453d8

### F8 — goalPct clamped to 100 hides over-goal percentage

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/results/[id].astro:64
- **Detail**: `Math.min(..., 100)` correctly prevents the Progress bar from overflowing. The "Goal reached! 🎉" label shows instead of a percentage when `goalReached` is true, so the over-goal WPM is still communicated via the "X wpm / Y wpm" text. Behavior is intentional and correct — noted for documentation only.
- **Fix**: No change needed. Add a comment `// Bar capped at 100; actual WPM still shown in text above` if clarity is desired.
- **Decision**: FIXED — 70453d8
