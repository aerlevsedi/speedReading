---
change_id: testing-bootstrap-auth-access
title: "Bootstrap + auth/access integration tests"
status: implemented
created: 2026-06-13
updated: 2026-06-25
roadmap_ref: "test-plan.md §3 Phase 1"
---

## Goal

Wire test runner (Vitest) and prove, via real local Supabase integration tests, that:
1. RLS isolates exercise_completions per user (Risk #1)
2. Middleware redirects unauthenticated requests to /auth/signin (Risk #3)
3. Server error responses do not expose Supabase secrets (Risk #6)

## Risks covered

- Risk #1 — cross-user RLS isolation on exercise_completions
- Risk #3 — middleware redirect for unauthenticated requests
- Risk #6 — secret leakage in error responses
