---
starter_id: 10x-astro-starter
package_manager: npm
project_name: speed-reading-training-app
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

A solo developer shipping a speed-reading training web app in 3 weeks after-hours needs a battle-tested, agent-friendly starter that handles auth, database, and progress charts out of the box. Astro+Supabase+Cloudflare is the recommended default for `(web-app, js)` and clears all four agent-friendly gates: typed (TypeScript + Zod schemas), convention-based (Astro's file-based routing), popular in JS training data, and well-documented. Its bootstrapper confidence is first-class, so scaffolding will be smooth with occasional manual steps. Auth is in scope (email/password or OAuth per FR-001); payments, realtime, AI, and background jobs are out of scope per PRD. CI runs on GitHub Actions with auto-deploy-on-merge to Cloudflare Pages — the starter's default deployment target, chosen for edge performance and low cost.
