# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Never accept user_id from client input

- **Context**: API routes handling user-scoped data
- **Problem**: User impersonation - attacker can submit requests as any user
- **Rule**: Never accept user_id from client input. Always derive from authenticated session (context.locals.user).
- **Applies to**: plan, plan-review, implement, impl-review
