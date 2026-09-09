# Logout Lifecycle & Post-Login Redirect — Plan Brief

> Full plan: `context/changes/logout-lifecycle/plan.md`

## What & Why

After sign-in the app currently dumps the user back on the landing page (`/`), requiring a manual click to reach `/dashboard`. Logged-in users who navigate to `/` see the public landing page instead of their workspace. These two friction points need to be eliminated so the dashboard is the effective home for authenticated users.

## Starting Point

`signin.ts` hard-codes `context.redirect("/")` on success. The middleware guards protected routes but has no rule to redirect authenticated users away from `/`. The landing page (`index.astro`) renders unconditionally without checking auth state.

## Desired End State

Successful sign-in drops the user directly on `/dashboard`. Any authenticated user who navigates to `/` is immediately redirected there. Sign-out continues to land on `/` (public landing page). Unauthenticated users see the landing page normally.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Post-login destination | `/dashboard` always | Simplest, matches stated goal; no `?redirect=` complexity needed | Plan |
| Root-URL guard location | `middleware.ts` | Consistent with existing auth guards; keeps redirect logic in one place | Plan |
| Sign-out destination | `/` (no change) | Public landing page is the natural home for a signed-out user | Plan |
| `?redirect=` deep-link support | Out of scope | Not needed now; can be added later without changing these two files | Plan |

## Scope

**In scope:**
- `signin.ts` success redirect → `/dashboard`
- `middleware.ts` root-URL guard for authenticated users

**Out of scope:**
- `?redirect=` / deep-link-restore logic
- Landing page UI changes
- Sign-up or confirm-email flow changes
- Sign-out destination

## Architecture / Approach

Two independent single-line edits. `signin.ts` changes one redirect target. `middleware.ts` gains one `if` block after the existing protected-route guard — an exact `pathname === "/"` check to avoid over-matching future paths.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Post-Login Redirect | Sign-in lands on `/dashboard` | None — single redirect change |
| 2. Root-URL Guard | Authenticated `/` visits redirect to `/dashboard` | Over-broad match (mitigated: `=== "/"` exact check) |

**Prerequisites:** None — no migrations, no new dependencies.  
**Estimated effort:** ~1 session, both phases completable in under 10 minutes.

## Open Risks & Assumptions

- If a future public path needs to be reachable by authenticated users from `/`, the root guard in middleware will need an explicit exception.
- Sign-up flow currently redirects to `/auth/confirm-email` — untouched and correct.

## Success Criteria (Summary)

- Sign in → `/dashboard` (no intermediate landing page)
- Navigate to `/` while logged in → redirect to `/dashboard` fires
- Sign out → `/` renders the landing page normally
