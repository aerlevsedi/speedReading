# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Never accept user_id from client input

- **Context**: API routes handling user-scoped data
- **Problem**: User impersonation - attacker can submit requests as any user
- **Rule**: Never accept user_id from client input. Always derive from authenticated session (context.locals.user).
- **Applies to**: plan, plan-review, implement, impl-review

## Use result variable pattern for Supabase queries

- **Context**: Supabase client queries returning {data, error} tuples
- **Problem**: Plan specified destructuring pattern `const { data, error } = await supabase...` but implementation consistently uses `const result = await supabase...` then accesses `result.data` / `result.error`. Creates confusion about the canonical pattern.
- **Rule**: Use the `result` variable pattern for Supabase queries: `const result = await supabase...` then access `result.data` and `result.error`. This is the de facto convention across the codebase (5/5 files use this pattern).
- **Applies to**: plan, implement, impl-review

## Always null-check createClient before use

- **Context**: Any file calling `createClient` from `@/lib/supabase` (API routes, Astro pages)
- **Problem**: TypeScript error "supabase is possibly null" because `createClient` returns `null` when `SUPABASE_URL` or `SUPABASE_KEY` environment variables are missing. Code crashes at runtime if env vars are misconfigured instead of returning a proper error response.
- **Rule**: Always add a null check immediately after calling `createClient`. Return an appropriate error response (500 with error message for API routes, redirect with error parameter for pages) before attempting to use the client.
- **Applies to**: implement, impl-review
