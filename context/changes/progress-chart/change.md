---
change_id: progress-chart
title: Progress chart comparing current to previous sessions
status: planned
created: 2026-07-28
updated: 2026-07-28
archived_at: null
---

## Notes

Roadmap slice S-05. Outcome: user can see a progress chart comparing current to previous sessions (PRD FR-014). Prerequisite S-01 (completions history) is met. Data comes from `exercise_completions` (duration, errors, `type_data.wpm`) with RLS, read server-side via `src/lib/services/`. Cold-start (no history) must be handled gracefully per FR-014 (placeholder message when no history yet).
