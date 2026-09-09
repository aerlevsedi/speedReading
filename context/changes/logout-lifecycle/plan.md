# Logout Lifecycle & Post-Login Redirect Implementation Plan

## Overview

Two auth navigation fixes: (1) after a successful sign-in, redirect to `/dashboard` instead of the landing page; (2) when a logged-in user visits `/`, redirect them to `/dashboard` automatically. Sign-out continues to land on `/`.

## Current State Analysis

- `src/pages/api/auth/signin.ts` — redirects to `/` on success (line 19).
- `src/pages/api/auth/signout.ts` — redirects to `/` on success (line 9). No change needed.
- `src/middleware.ts` — guards `/dashboard`, `/exercise`, `/results` against unauthenticated access; does not redirect authenticated users away from `/`.
- `src/pages/index.astro` — renders the landing page unconditionally; does not check `Astro.locals.user`.
- `src/components/Welcome.astro` — landing page body; shows sign-in/sign-up CTAs regardless of auth state.
- `src/components/Topbar.astro` — already shows a "Dashboard" link for authenticated users, but requires a manual click.

### Key Discoveries:

- `signin.ts:19` — the single redirect that needs to change to `/dashboard`.
- `middleware.ts:4` — `PROTECTED_ROUTES` array is where auth guards live; adding a root-URL redirect here keeps the pattern consistent.
- `middleware.ts:18-22` — existing guard pattern: check pathname, check user, return redirect. The new root guard follows the same shape.
- No `?redirect=` param support is required (explicit decision: always redirect to `/dashboard`).

## Desired End State

- Sign-in → `/dashboard` (always).
- Authenticated user visits `/` → immediately redirected to `/dashboard` (no landing page rendered).
- Sign-out → `/` (no change).
- Unauthenticated user visits `/` → landing page renders normally.

### Key Discoveries:

- No new components, schema changes, or dependencies required.
- Two files, two small edits.

## What We're NOT Doing

- No `?redirect=` / deep-link-restore logic — explicitly out of scope.
- No changes to the landing page UI (`Welcome.astro`, `index.astro`).
- No changes to sign-up or confirm-email flows.
- No changes to sign-out destination.

## Implementation Approach

Edit the two files in parallel — they are independent. Phase 1 fixes the post-login destination; Phase 2 adds the root-URL guard in middleware.

---

## Phase 1: Post-Login Redirect

### Overview

Change `signin.ts` to redirect to `/dashboard` instead of `/` after a successful password sign-in.

### Changes Required:

#### 1. signin.ts — success redirect

**File**: `src/pages/api/auth/signin.ts`

**Intent**: After `signInWithPassword` succeeds (no error), redirect to `/dashboard` instead of `/`.

**Contract**: Replace the final `return context.redirect("/");` with `return context.redirect("/dashboard");`. No other changes.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Sign in with valid credentials → lands on `/dashboard`
- Sign in with invalid credentials → stays on `/auth/signin` with error message (regression check)

**Implementation Note**: After completing this phase and automated verification passes, manually confirm the sign-in redirect before proceeding to Phase 2.

---

## Phase 2: Root-URL Guard in Middleware

### Overview

Extend `middleware.ts` to redirect authenticated users away from `/` to `/dashboard`.

### Changes Required:

#### 1. middleware.ts — root redirect for authenticated users

**File**: `src/middleware.ts`

**Intent**: After the existing protected-route guard, add a complementary guard: if the user is authenticated and the request is for exactly `/`, redirect to `/dashboard`. This prevents authenticated users from ever seeing the landing page.

**Contract**: Add a new block after the existing `PROTECTED_ROUTES` guard (after line 22):

```ts
if (context.url.pathname === "/" && context.locals.user) {
  return context.redirect("/dashboard");
}
```

The check must be `=== "/"` (exact match), not `startsWith`, to avoid accidentally redirecting paths like `/about` if added later.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Logged-in user navigates to `/` → immediately redirected to `/dashboard`
- Logged-out user navigates to `/` → landing page renders normally
- Sign-out from `/dashboard` → lands on `/` (landing page, not redirected back)

**Implementation Note**: After completing this phase and automated verification passes, run the full manual checklist before marking the change done.

---

## Testing Strategy

### Manual Testing Steps:

1. Sign in with valid credentials → verify landing URL is `/dashboard`
2. While logged in, navigate to `/` → verify redirect to `/dashboard` fires
3. Sign out → verify landing URL is `/` (landing page visible)
4. Visit `/` while signed out → verify landing page renders, no redirect

## References

- Auth endpoints: `src/pages/api/auth/`
- Middleware: `src/middleware.ts`
- Topbar (Dashboard link already present): `src/components/Topbar.astro:13`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Post-Login Redirect

#### Automated

- [x] 1.1 Lint passes: `npm run lint`
- [x] 1.2 Build passes: `npm run build`

#### Manual

- [x] 1.3 Sign in with valid credentials → lands on `/dashboard`
- [x] 1.4 Sign in with invalid credentials → stays on `/auth/signin` with error (regression)

### Phase 2: Root-URL Guard in Middleware

#### Automated

- [ ] 2.1 Lint passes: `npm run lint`
- [ ] 2.2 Build passes: `npm run build`

#### Manual

- [ ] 2.3 Logged-in user navigates to `/` → redirected to `/dashboard`
- [ ] 2.4 Logged-out user navigates to `/` → landing page renders normally
- [ ] 2.5 Sign-out from `/dashboard` → lands on `/` (not redirected back)
