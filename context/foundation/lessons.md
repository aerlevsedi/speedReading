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
