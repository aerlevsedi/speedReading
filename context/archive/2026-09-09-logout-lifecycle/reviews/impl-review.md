<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Logout Lifecycle & Post-Login Redirect

- **Plan**: context/changes/logout-lifecycle/plan.md
- **Scope**: All phases (Phase 1–2 of 2)
- **Date**: 2026-09-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 1 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Missing user guard in exercise page

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/exercise/[id].astro:9–28
- **Detail**: The page never reads `Astro.locals.user` or performs an explicit auth guard. It relies entirely on middleware protecting the `/exercise` route. `results/[id].astro` (the structurally identical sibling) always does an explicit `if (!user) return Astro.redirect(...)` before touching the database. If the route is ever removed from `PROTECTED_ROUTES`, or if RLS is absent on `exercises`, this page silently serves data to unauthenticated callers.
- **Fix**: Add `const { user } = Astro.locals;` and `if (!user) return Astro.redirect("/auth/signin?error=Unauthorized");` near the top of the frontmatter, matching the pattern in `results/[id].astro`.
  - Strength: Follows the established pattern in the codebase; makes the authz boundary self-contained regardless of middleware config.
  - Tradeoff: Trivial — two lines added, no logic change.
  - Confidence: HIGH — identical pattern already in results/[id].astro.
  - Blind spot: None significant.
- **Decision**: FIXED

### F2 — UUID validation missing in exercise page

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/exercise/[id].astro:12–21
- **Detail**: `id` is checked only for truthiness, then passed raw to `.eq("id", id)`. `results/[id].astro:17` validates with an explicit UUID regex before any DB call: `!/^[0-9a-f]{8}-...$/.test(id)`. A malformed value (e.g., a very long string or SQL fragment) is forwarded to Supabase. Direct pattern inconsistency between two structurally identical pages.
- **Fix**: Copy the UUID regex guard from `results/[id].astro:17` to `exercise/[id].astro` before the Supabase call.
- **Decision**: FIXED

### F3 — No input validation on sign-in credentials

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/signin.ts:5–7
- **Detail**: `form.get("email")` and `form.get("password")` are cast to string without null/empty checks. A raw POST with missing fields passes `"null"` (string) to Supabase, wasting a round-trip and producing confusing error messages. Same gap exists in `signup.ts`.
- **Fix**: Add a guard before calling Supabase: `if (!email || !password) return context.redirect('/auth/signin?error=...')`. Matches the early-return pattern already used for the missing-supabase check on lines 10–12.
- **Decision**: FIXED

### F4 — Three unplanned files changed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/auth/SubmitButton.tsx, src/pages/dashboard.astro, src/pages/exercise/[id].astro
- **Detail**: Three files not mentioned in the plan were modified: (1) `SubmitButton.tsx` — SSR crash fix (removed `useFormStatus`); (2) `dashboard.astro` — Sign out button moved to top-right; (3) `exercise/[id].astro` — Back to Dashboard link added. All changes are safe and additive, but they are not in the plan's "Changes Required" sections.
- **Fix**: Accept the changes as-is (they are justified and functional). No code changes needed.
- **Decision**: ACCEPTED

### F5 — Supabase error message reflected verbatim to client

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/signin.ts:16
- **Detail**: `error.message` from Supabase is URL-encoded and shown directly in the sign-in banner. Supabase auth errors can reveal distinguishing detail (e.g., whether an email exists), enabling user enumeration. Same pattern in `signup.ts`.

- **Fix A ⭐ Recommended**: Map Supabase auth errors to a single generic message ("Invalid email or password") for sign-in; "An error occurred, please try again" for sign-up.
  - Strength: Eliminates user-enumeration vector entirely; consistent with auth best practices.
  - Tradeoff: Slightly less informative for legitimate users — they can't tell if they mistyped their email vs. password.
  - Confidence: HIGH — standard auth hardening practice.
  - Blind spot: Supabase may return errors for other cases (rate limit, network) — those may warrant distinct messages.

- **Fix B**: Keep current behavior — accept the enumeration risk as low-impact for this app's threat model.
  - Strength: Preserves precise error messaging for users.
  - Tradeoff: User enumeration is a real (if low-severity) attack vector.
  - Confidence: MEDIUM — acceptable in low-threat contexts.
  - Blind spot: App's actual threat model and user base not assessed here.

- **Decision**: FIXED via Fix A

### F6 — Pending spinner in SubmitButton is dead code

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: src/components/auth/SubmitButton.tsx:8
- **Detail**: `SubmitButton` accepts a `pending` prop defaulting to `false`, but no caller passes it. Both `SignInForm` and `SignUpForm` use native `method="POST"` forms with no programmatic submission tracking. The spinner UI and `pendingText` are dead code — users get no loading feedback during slow auth responses and may double-submit.
- **Fix**: Track submission state in `SignInForm`/`SignUpForm` via `useState` + set `pending=true` in `handleSubmit`, pass as prop to `SubmitButton`. (Alternatively, use `useFormStatus` client-side only via `client:load`, but that requires React 19 form actions to work properly.)
- **Decision**: FIXED
