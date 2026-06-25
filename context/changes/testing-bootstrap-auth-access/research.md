---
date: 2026-06-13T12:00:00+02:00
researcher: claude-sonnet-4-6
git_commit: 9ee150e695a64a2f8cb791af405cb55504fbfc9f
branch: main
repository: speedReading
topic: "Risk #1 — Cross-user RLS isolation on exercise_completions"
tags: [research, rls, supabase, exercise-completions, security, access-control, middleware, secret-leak]
status: complete
last_updated: 2026-06-17
last_updated_by: claude-sonnet-4-6
last_updated_note: "Added follow-up research for Risk #3 (middleware redirect) and Risk #6 (secret leak)"
---

# Research: Risk #1 — Cross-user RLS isolation on exercise_completions

**Date**: 2026-06-13  
**Git Commit**: 9ee150e695a64a2f8cb791af405cb55504fbfc9f  
**Branch**: main  
**Repository**: aerlevsedi/speedReading

## Research Question

Can an authenticated User B read User A's exercise_completions rows — even with a direct completion ID?  
Is the SELECT policy genuinely per-user (auth.uid() = user_id) or just per-authenticated-user?  
Do API routes derive user_id from session or accept it from client input?

## Summary

**Risk #1 has two independent layers of protection, both of which are correctly implemented.** The RLS SELECT policy is genuinely per-user (`auth.uid() = user_id`). All four code paths that touch exercise_completions derive user_id exclusively from the authenticated session — none accept user_id or completion ownership from client input.

**However, the risk is still real and worth testing**, because:
1. RLS is the last line of defence — if the Supabase client is ever called without a session token (e.g., service-role key used accidentally), RLS is bypassed entirely.
2. The only endpoint that accepts a completion ID from the URL (`/results/[id]`) does add a `.eq("user_id", user.id)` application-level filter — but that filter is in application code, not SQL. A future refactor that drops that `.eq()` call would silently remove the application-level check while RLS alone enforces correctness. A test proves both layers hold.
3. No test currently exists. This is the first evidence of the policy working correctly — it has never been verified by an automated test.

**Cheapest test layer:** Integration test against local Supabase (Docker) with two fixture users and real JWT tokens. Mocking RLS is explicitly ruled out — a mock client bypasses the policy entirely and would produce a false green.

---

## Detailed Findings

### RLS Policies on exercise_completions

**Source:** `supabase/migrations/20260605000000_create_exercises_schema.sql:44–54`

```sql
ALTER TABLE exercise_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY completions_select_own ON exercise_completions
  FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY completions_insert_own ON exercise_completions
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
```

**Verdict:** The SELECT policy is genuinely per-user. `auth.uid()` returns the UID of the authenticated caller; if no JWT is present, `auth.uid()` returns `null`, which never equals a real `user_id` UUID — so unauthenticated reads return zero rows. No UPDATE or DELETE policies exist (implicit deny for those operations).

**Correction to test-plan §2:** The plan's "Must challenge" cell says `"verify SELECT policy is actually per-user, not just per-authenticated-user"` — this is confirmed: the policy is per-user. The challenge is satisfied.

**Residual risk (post-correction):** The policy uses `(select auth.uid())` rather than `auth.uid()` — the subquery form is a Supabase performance optimisation that prevents re-evaluation per row. It is functionally identical for security purposes.

### exercises Table Policies

**Source:** `supabase/migrations/20260605000000_create_exercises_schema.sql:20–25`

```sql
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY exercises_select_policy ON exercises
  FOR SELECT
  USING (true);
```

Exercises are publicly readable (SELECT is open to all authenticated and unauthenticated callers via `USING (true)`). No INSERT/UPDATE/DELETE policies exist — those operations are implicitly denied to authenticated users and require service-role key. This is correct: exercise content is not user-private.

### Code Paths That Read exercise_completions

Four distinct access paths were found. All are secure:

#### 1. `src/pages/results/[id].astro` — Direct completion ID lookup
**Permalink:** https://github.com/aerlevsedi/speedReading/blob/9ee150e695a64a2f8cb791af405cb55504fbfc9f/src/pages/results/[id].astro

This is the **highest-risk path**: a completion ID is accepted from the URL and used directly in a query.

```typescript
// Line 10 — ID from URL
const { id } = Astro.params;

// Line 11 — user from session (Astro.locals, set by middleware)
const { user } = Astro.locals;

// Lines 26–31 — query filters by BOTH id AND user_id
const result = await supabase
  .from("exercise_completions")
  .select("*, exercises(*)")
  .eq("id", id)            // completion ID from URL
  .eq("user_id", user.id)  // user_id from session — NOT from URL
  .single();
```

**Finding:** Application-level filter correctly combines ID + ownership. If User B requests `/results/<user_A_completion_id>`, the query returns no rows (`.single()` then fails) because `.eq("user_id", user.id)` eliminates User A's row for User B's session. RLS also enforces this at the DB layer.

**Test target:** This is the primary test scenario. A test should:
- Create User A's completion
- Authenticate as User B
- Request `/results/<user_A_completion_id>` (or call the Supabase query directly with User B's token)
- Assert: no data returned (or redirect/error, not User A's data)

#### 2. `src/lib/services/exerciseService.ts:getNextExerciseForType()` — History lookup for dataset alternation
**Permalink:** https://github.com/aerlevsedi/speedReading/blob/9ee150e695a64a2f8cb791af405cb55504fbfc9f/src/lib/services/exerciseService.ts

```typescript
// Line 11 — userId parameter (passed by caller, not from client)
export async function getNextExerciseForType(
  supabase: SupabaseClient,
  userId: string,
  exerciseType: "animated_pacer" | ...
): Promise<Exercise | null> {

  // Lines 15–22 — filters by userId
  const historyResult = await supabase
    .from("exercise_completions")
    .select("exercise_id, exercises!inner(dataset_id)")
    .eq("user_id", userId)
    .eq("exercises.exercise_type", exerciseType)
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();
```

**Finding:** `userId` is passed as a parameter by the caller (dashboard.astro and next-for-type.ts both derive it from `user.id` in session/locals). The query's `.eq("user_id", userId)` is application-level filtering — RLS also applies. Secure.

#### 3. `src/pages/api/exercises/next-for-type.ts` — API route calling exerciseService
**Permalink:** https://github.com/aerlevsedi/speedReading/blob/9ee150e695a64a2f8cb791af405cb55504fbfc9f/src/pages/api/exercises/next-for-type.ts

```typescript
// Line 8 — user from session context.locals (set by middleware)
const { user } = context.locals;

// Lines 44–47 — passes user.id from session to the service
const exercise = await getNextExerciseForType(
  supabase,
  user.id,  // from session, not from URL/query/body
  type as "animated_pacer" | ...
);
```

**Finding:** `user.id` sourced from `context.locals` (middleware-resolved). No client input accepted for the user identity. Secure.

#### 4. `src/pages/api/exercises/complete.ts` — INSERT only, not a read path
**Permalink:** https://github.com/aerlevsedi/speedReading/blob/9ee150e695a64a2f8cb791af405cb55504fbfc9f/src/pages/api/exercises/complete.ts

```typescript
// Line 5 — user from context.locals
const { user } = context.locals;

// Lines 36–44 — INSERT with user.id from session
const completionResult = await supabase
  .from("exercise_completions")
  .insert({
    user_id: user.id,  // from session
    exercise_id: exerciseId,
    ...
  })
```

**Finding:** INSERT only — not a read path for Risk #1. `user_id` comes from session, consistent with lessons.md rule "Never accept user_id from client input."

### Middleware: PROTECTED_ROUTES coverage

**Source:** `src/middleware.ts`

```typescript
const PROTECTED_ROUTES = ["/dashboard", "/exercise", "/results"];

export const onRequest = defineMiddleware(async (context, next) => {
  // ...
  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }
  return next();
});
```

**Finding relevant to Risk #1:** `/results` is in PROTECTED_ROUTES. An unauthenticated request to `/results/<any_id>` is redirected to `/auth/signin` before reaching the page's query. So the primary attack vector (unauthenticated probe) is blocked by middleware before RLS even fires. The real test scenario is an *authenticated* User B probing User A's data — which exercises RLS + the application-level `.eq("user_id", user.id)`.

**Finding relevant to Risk #3 (middleware, for later):** `PROTECTED_ROUTES` uses `startsWith` — covers `/results/[id]`, `/exercise/[id]`, `/dashboard` and all sub-paths. This is noted here but belongs to the Phase 1 Risk #3 test.

---

## Code References

| File | Line(s) | What's there |
|---|---|---|
| `supabase/migrations/20260605000000_create_exercises_schema.sql` | 44–54 | RLS enable + SELECT/INSERT policies on exercise_completions |
| `src/pages/results/[id].astro` | 10, 11, 26–31 | Completion ID from URL + ownership filter (primary test target) |
| `src/lib/services/exerciseService.ts` | 11, 15–22 | History query scoped to userId param |
| `src/pages/api/exercises/next-for-type.ts` | 8, 44–47 | user.id from session → service call |
| `src/pages/api/exercises/complete.ts` | 5, 36–44 | INSERT with session user_id (not a read path) |
| `src/middleware.ts` | 3, 6–18 | PROTECTED_ROUTES, session resolution, redirect logic |

---

## Architecture Insights

**Two-layer defence is in place and both layers are correct:**
- Layer 1 (DB): RLS `completions_select_own` — `auth.uid() = user_id` — enforced at PostgreSQL level for every query that goes through the Supabase anon/authenticated role.
- Layer 2 (App): Every read path adds `.eq("user_id", user.id)` or passes `userId` from the session explicitly.

**The single point where both layers could fail simultaneously:** If a future code path uses the Supabase service-role key (which bypasses RLS) and also forgets to filter by `user_id`. Service-role usage is not present in current codebase — but as the app grows, this is the class of mistake the test guards against.

**What the test proves:** That **with a real authenticated JWT** for User B, querying `exercise_completions` for a row that belongs to User A returns no data — whether via the Supabase client directly or via the `/results/[id]` page. This proves both layers simultaneously: the DB-level RLS policy, and the application-level filter, are both in force and neither has been accidentally broken.

---

## Cheapest Test Layer — Verdict

**Integration test against local Supabase Docker**, using real Supabase Auth JWT tokens obtained via `supabase.auth.signInWithPassword()` in test setup.

**Why not mock:**
- A mocked Supabase client bypasses RLS entirely. The mock always returns whatever `.data` you configure — it never evaluates the SQL policy. A test with a mock Supabase would be green even if the RLS policy was deleted. Lessons.md lesson "Never accept user_id from client input" already documents one class of this failure.
- The mock would test that the application's `.eq("user_id", ...)` call was made — but not that the DB actually enforces it.

**Why not e2e (Playwright):**
- Risk #1 is a data isolation property, not a UI property. The browser is irrelevant. An e2e test would add browser overhead while testing the same Supabase query that an HTTP-level integration test covers.

**Recommended setup:**
- Vitest as test runner (TypeScript-native, no browser runtime needed)
- `@supabase/supabase-js` Admin client (service-role key) for fixture setup (create two users + their data)
- Regular authenticated client with User B's JWT for the actual assertion
- Local Supabase via `npx supabase start` (already configured in project, per roadmap Baseline)

**Test shape (behaviour-first, not implementation):**
```
GIVEN: User A has one exercise_completion (known ID)
AND:   User B is authenticated (has a valid JWT)
WHEN:  User B queries exercise_completions with User A's completion ID
THEN:  Zero rows are returned
```

This maps to testing the Supabase client call directly (unit of test: the DB policy + query), not via the Astro page. The page-level test (`/results/[id]` returns redirect/error for User B) is a secondary integration test that validates the app-level filter on top of RLS.

---

## Risk Response Guidance — Corrections to test-plan.md §2

| Field | Original | Correction after research |
|---|---|---|
| "Must challenge" | "RLS WITH CHECK on SELECT is enough" | **Confirmed correct** — the SELECT policy is `USING`, not `WITH CHECK` (INSERT uses `WITH CHECK`). The `USING` clause is the right construct for SELECT; the plan's wording was slightly imprecise but the underlying concern is valid. |
| "Context needed" | RLS SELECT policy text | **Found and confirmed** — `USING ((select auth.uid()) = user_id)`. No change needed. |
| "Context needed" | Whether API derives user_id from session | **Confirmed** — all four paths use session. Consistent with lessons.md "Never accept user_id from client input." |
| "Likely cheapest layer" | "Integration test (real Supabase or local Docker, two fixture users)" | **Confirmed** — no cheaper layer gives real signal here. Mock is excluded. |
| "Anti-pattern to avoid" | "Mocking RLS" | **Confirmed** — mocking bypasses the SQL policy entirely. Test must use real local Supabase. |

No risks dropped or reframed. No corrections that require backporting to §2 Source column (all evidence cited in plan already matches findings).

---

## Historical Context

- `context/archive/2026-06-05-exercise-data-model-seed/plan.md` — migration was written with RLS as a hard requirement per CLAUDE.md. The policies found today are the ones from that plan.
- `context/foundation/lessons.md` — "Never accept user_id from client input" lesson is already baked into all four access paths. The lesson pre-dates this research.

---

## Open Questions

1. **Service-role key usage in tests:** Vitest setup will need the Supabase service-role key to create fixture users and data. This key must be read from `.env.test` or `.dev.vars` — never hardcoded. Plan should address where test env vars live.

2. **Supabase local URL for tests:** Local Supabase runs on `http://127.0.0.1:54321` by default. The plan should confirm the test client uses the local URL, not the cloud project URL, to avoid polluting production data.

3. **Teardown strategy:** Fixture users created via Admin client in test setup must be deleted in teardown. Supabase local Docker is reset-able (`npx supabase db reset`) but individual test runs should clean up their own fixtures to allow parallel test runs in the future.

---

## Follow-up Research 2026-06-17 — Risk #3 (Middleware Redirect) and Risk #6 (Secret Leak)

**Git commit**: ae2690559ae6ce79730893183deab92e62f2f9b1  
**Branch**: main

---

### Risk #3 — Middleware Redirect: Oracle and Findings

#### What the middleware does

`src/middleware.ts` runs on **every** request via Astro's `defineMiddleware`. There is exactly one middleware file — no other instances exist.

```
PROTECTED_ROUTES = ["/dashboard", "/exercise", "/results"]

Logic (lines 18–22):
  if any PROTECTED_ROUTES prefix matches pathname.startsWith():
    if no user in context.locals:
      return context.redirect("/auth/signin")  ← HTTP 302 (Astro default)
  return next()
```

`context.redirect()` defaults to **HTTP 302** (Temporary Redirect). All page-level `Astro.redirect()` calls also default to 302. This is the observable contract the test must assert.

#### Complete route inventory

All routes and their middleware coverage:

| URL | File | In PROTECTED_ROUTES? | Page-level auth check too? |
|-----|------|---------------------|--------------------------|
| `/` | `src/pages/index.astro` | No | No |
| `/dashboard` | `src/pages/dashboard.astro` | **Yes** (`/dashboard`) | Yes (lines 15–17, redundant) |
| `/exercise/[id]` | `src/pages/exercise/[id].astro` | **Yes** (`/exercise`) | Not confirmed from code read, but middleware covers it |
| `/results/[id]` | `src/pages/results/[id].astro` | **Yes** (`/results`) | Yes (lines 22–24, redundant) |
| `/auth/signin` | `src/pages/auth/signin.astro` | No | No — publicly accessible |
| `/auth/signup` | `src/pages/auth/signup.astro` | No | No |
| `/auth/confirm-email` | `src/pages/auth/confirm-email.astro` | No | No |
| `/api/auth/signin` | `src/pages/api/auth/signin.ts` | No | No |
| `/api/auth/signup` | `src/pages/api/auth/signup.ts` | No | No |
| `/api/auth/signout` | `src/pages/api/auth/signout.ts` | No | No |
| `/api/exercises/[id]` | `src/pages/api/exercises/[id].ts` | No | **None — unauthenticated reads succeed** |
| `/api/exercises/complete` | `src/pages/api/exercises/complete.ts` | No | Own check (line 7) → 302 redirect |
| `/api/exercises/next-for-type` | `src/pages/api/exercises/next-for-type.ts` | No | Own check (line 9) → **JSON 401** |

#### Loop-risk verdict

`/auth/signin` does not start with `/dashboard`, `/exercise`, or `/results` — the middleware passes it through unconditionally. **No redirect loop.** The design is correct.

#### API routes: two different auth patterns

Two API routes protect themselves independently and return **different status codes**:

- `src/pages/api/exercises/complete.ts:7–9` — own `if (!user)` check → `context.redirect("/auth/signin?error=Authentication+required")` = **302**
- `src/pages/api/exercises/next-for-type.ts:9–12` — own `if (!user)` check → `new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })` = **401 JSON**

**Noteworthy gap:** `src/pages/api/exercises/[id].ts` has **no auth check at all**. An unauthenticated caller can fetch exercise content (text/metadata). This is a scope question for the team — exercises are not user-private data (the RLS policy on the `exercises` table uses `USING (true)`, i.e., public). This is not a secret-leak risk; it is a business-logic coverage gap. It does NOT need to be covered by Risk #3's test.

#### Oracle — Risk #3

The oracle comes from: PRD §Access Control ("authenticated-only is a hard requirement") + Interview Q3 ("auth middleware is my lowest-confidence area").

**What a correct implementation guarantees:**

```
GIVEN: a GET request to /dashboard (or /exercise/*, /results/*) with no session cookie
THEN:
  - HTTP status is 302 (not 200, not 401, not 500)
  - Location header is /auth/signin (or starts with /auth/signin)
  - No page content is returned in the response body
```

**What constitutes a regression (failure scenarios):**
1. Middleware disabled or removed → protected route returns 200 with page content
2. `PROTECTED_ROUTES` emptied → same as above
3. `startsWith` replaced with `===` → subpaths like `/exercise/abc` bypass protection (middleware only catches `/exercise` exactly)
4. `if (!context.locals.user)` condition inverted → authenticated users get redirected, unauthenticated users get through
5. Redirect target changed → redirect loops or sends unauthenticated users to wrong page

**Cheapest test layer (confirmed):** HTTP-level integration test. No browser. No Supabase needed for the no-session case — sending a plain GET with no `Cookie` header is sufficient to trigger the redirect path. The test does not need to sign in; it needs to confirm the unauthenticated path redirects.

**Test shape (behaviour-first):**

```
GIVEN: a GET request to /dashboard with no cookie header
WHEN:  the Astro server handles the request (middleware runs)
THEN:  response status is 302
AND:   Location header value is /auth/signin (or starts with /auth/signin)

GIVEN: a GET request to /exercise/<any-id> with no cookie header
THEN:  same redirect

GIVEN: a GET request to /results/<any-id> with no cookie header
THEN:  same redirect

GIVEN: a GET request to /auth/signin with no cookie header
THEN:  response status is 200 (not redirected — no loop)
```

**Expired vs missing session:** Two distinct sub-cases exist. A missing session (no `Cookie` header) is the primary test. An expired session (stale cookie) causes `supabase.auth.getUser()` to return `{ data: { user: null } }`, which sets `context.locals.user = null` — functionally identical result. Testing missing-session covers the middleware logic; expired-session is a Supabase token validation property tested by the Supabase SDK itself.

**Test infrastructure needed:** An Astro dev server running during the test (or a lightweight fetch against the local server). The test helper needs to send HTTP requests without a cookie jar. No Supabase Docker needed for the primary assertion; the server just needs to be up. This differs from the RLS test which needs Supabase running.

---

### Risk #6 — Secret Leak: Oracle and Findings

#### What secrets exist and where they live

`src/lib/supabase.ts` imports `SUPABASE_URL` and `SUPABASE_KEY` from `astro:env/server`. Both are declared in `astro.config.mjs` as:

```typescript
SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
```

`access: "secret"` instructs Astro/Vite to strip these values from all client-side bundles. They are only available in server-side code via the `astro:env/server` virtual module. They are **not** available via `process.env` in tests (this is why tests use their own `process.env["SUPABASE_TEST_*"]` vars).

#### All error response paths — comprehensive audit

| Route | Error condition | Response body | Secret exposed? |
|-------|----------------|---------------|-----------------|
| `GET /api/exercises/[id]` | `createClient()` null | `{"error":"Server configuration error"}` | No |
| `GET /api/exercises/[id]` | Supabase query fails | `{"error":"Exercise not found"}` | No — `result.error` not serialized |
| `GET /api/exercises/next-for-type` | `createClient()` null | `{"error":"Server error"}` | No |
| `GET /api/exercises/next-for-type` | Service returns null | `{"error":"Not found"}` | No |
| `POST /api/exercises/complete` | `createClient()` null | 302 → `/dashboard?error=Server+configuration+error` | No — URL param, generic string |
| `POST /api/exercises/complete` | Completion insert fails | 302 → `/dashboard?error=Failed+to+save+completion` | No — `console.error` goes to Workers log, not response |
| `POST /api/auth/signin` | `createClient()` null | 302 → `/auth/signin?error=Supabase+is+not+configured` | No |
| `POST /api/auth/signin` | Supabase auth error | 302 → `/auth/signin?error={error.message}` | Low risk — Supabase auth error messages never contain keys |
| `POST /api/auth/signup` | Supabase auth error | 302 → `/auth/signup?error={error.message}` | Low risk — same as above |
| Middleware — `getUser()` failure | No try-catch | Astro default 500 page (generic HTML) | No |

#### `console.error` calls

Two `console.error` calls exist:
- `src/pages/api/exercises/complete.ts:49` — logs `completionResult.error` (Supabase error object)
- `src/pages/dashboard.astro:32` — logs error from `Promise.all` of Supabase queries

In Cloudflare Workers, `console.error()` writes to the **Workers log** (visible in Wrangler CLI output or Cloudflare Dashboard). It does **not** appear in the HTTP response body. These calls are not a secret-leak path.

#### Astro default 500 behavior

There is no `src/pages/500.astro` or custom error page. Astro's default error handler:
- Logs the exception server-side
- Returns a generic 500 HTML page (does not include stack trace or env var values in the response body)
- Supabase key values are never interpolated into any response string

#### Oracle — Risk #6

The oracle comes from: PRD §Privacy + abuse/security lens ("secret leakage class") + roadmap Baseline ("no structured error handling wired").

**What a correct implementation guarantees:**

```
GIVEN: any API route forced into its error branch
THEN:
  - HTTP response body does NOT contain the string value of SUPABASE_KEY
  - HTTP response body does NOT contain the string value of SUPABASE_URL
  - HTTP response body does NOT contain "Bearer " followed by a token
  - HTTP response body does NOT contain a stack trace
```

**The verifiable risk is narrow but real:** If a future refactor serializes a raw error object into a JSON response, and that error object somehow contains the connection string or API key, the test would catch it. The current code does not do this — but the test is the guard against regression.

**How to trigger the error branch in a test:**

The safest triggerable error path is the `createClient()` → `null` path. In tests, if `SUPABASE_URL` or `SUPABASE_KEY` are absent/empty, `createClient` returns `null` and routes return their 500 error bodies. However, the test server needs Supabase configured to serve requests at all.

**Better approach — force a Supabase query failure:** Make a request that will cause a valid Supabase client to return an error. Options:
1. Request a non-existent exercise ID: `GET /api/exercises/00000000-0000-0000-0000-000000000000` with valid session → Supabase returns `{data: null, error: {...}}` → route returns `{"error":"Exercise not found"}` (404, not 500). The body can be checked for absence of key string.
2. For the "complete" route error path — harder to trigger without a valid session + exercise.

**Simplest test approach:** Send a request that forces a known error branch, then assert that the real secret value (`process.env.SUPABASE_TEST_KEY` or the actual key string) does not appear anywhere in the response body. This requires:
- The Astro server to be running (same infra as Risk #3 test)
- Knowledge of the actual key value at test time (read from `process.env` in the test itself)

**Test shape (behaviour-first):**

```
GIVEN: the actual value of SUPABASE_KEY known to the test runner
WHEN:  any error-path response is received from an API route
THEN:  response body does not contain the SUPABASE_KEY value
AND:   response body does not contain the SUPABASE_URL value
AND:   response body does not contain "Bearer " + any token substring

SPECIFIC trigger: GET /api/exercises/next-for-type?type=animated_pacer
  with no session cookie (returns 401 JSON)
  response body: {"error":"Unauthorized"}
  assert: does not contain process.env.SUPABASE_TEST_KEY
  assert: does not contain process.env.SUPABASE_TEST_URL
  assert: does not contain "Bearer "
```

**Why the 401 path is the best test trigger:** It requires no Supabase connection (the check fires before any Supabase call), so the test can run even if local Supabase is not started. The response body is deterministic. The test proves the "no secret in error responses" property for the class of responses that include error messages.

**An additional trigger for deeper coverage:**

```
GET /api/exercises/next-for-type?type=animated_pacer  (no auth, no Supabase needed)
→ 401 {"error":"Unauthorized"}  ← assert no secrets in body

GET /api/exercises/00000000-0000-0000-0000-000000000000  (no auth needed — unprotected route)
→ 404 {"error":"Exercise not found"}  ← assert no secrets in body
```

These two cover both: the session-check error branch and the Supabase-query error branch.

#### Correction to test-plan §2 Risk #6 guidance

| Field | Original guidance | Post-research status |
|-------|------------------|---------------------|
| "What would prove protection" | "A forced 500 error response body does not contain the string value of SUPABASE_KEY, SUPABASE_URL, or a Bearer token" | **Refined**: The 401 and 404 error branches are easier to trigger reliably and serve as the oracle. A genuine 500 requires an uncaught exception, which the middleware's lack of try-catch could produce — but that path is harder to trigger deterministically in a test. Start with 401/404. |
| "Context needed" | "How errors are currently surfaced to the client (raw Supabase error message, stack trace, custom wrapper)" | **Answered**: All API routes return hardcoded generic strings. No raw error objects. Auth routes pass `error.message` to URL params (not response body). |
| "Likely cheapest layer" | "Integration test (trigger deliberate error, assert response body)" | **Confirmed and refined**: HTTP fetch against running Astro server. No Supabase Docker needed for the 401 assertion. |

---

### Open Questions (updated)

4. **Risk #3 test server**: The middleware redirect test requires an Astro dev server running. Options: (a) start `npm run dev` in `globalSetup` and stop it in teardown; (b) use `astro preview` with a pre-built artifact; (c) use Vitest's `globalSetup` hook to spawn the server process. The plan must choose one.

5. **Risk #6 real key value in test**: To assert "response body does not contain SUPABASE_KEY value", the test must know the key value. Reading it from `process.env.SUPABASE_TEST_SERVICE_ROLE_KEY` or `SUPABASE_TEST_ANON_KEY` at test time is the right approach — these are already in `.env.test`.

6. **`/api/exercises/[id]` unprotected**: This route has no auth check. Exercise content is publicly readable (RLS policy is `USING (true)`). This is a conscious product decision (exercises are not user-private), not a security gap. Does not need to be covered by Risk #3 or Risk #6 tests. Noted here for team awareness.
