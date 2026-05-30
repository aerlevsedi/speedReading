---
bootstrapped_at: 2026-05-24T13:51:00Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: speed-reading-training-app
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

Verbatim copy from `context/foundation/tech-stack.md`:

```yaml
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
```

### Why this stack

A solo developer shipping a speed-reading training web app in 3 weeks after-hours needs a battle-tested, agent-friendly starter that handles auth, database, and progress charts out of the box. Astro+Supabase+Cloudflare is the recommended default for `(web-app, js)` and clears all four agent-friendly gates: typed (TypeScript + Zod schemas), convention-based (Astro's file-based routing), popular in JS training data, and well-documented. Its bootstrapper confidence is first-class, so scaffolding will be smooth with occasional manual steps. Auth is in scope (email/password or OAuth per FR-001); payments, realtime, AI, and background jobs are out of scope per PRD. CI runs on GitHub Actions with auto-deploy-on-merge to Cloudflare Pages — the starter's default deployment target, chosen for edge performance and low cost.

## Pre-scaffold verification

| Signal      | Value                                                     | Severity | Notes                       |
| ----------- | --------------------------------------------------------- | -------- | --------------------------- |
| npm package | not run                                                   | n/a      | cmd_template uses git clone |
| GitHub repo | przeprogramowani/10x-astro-starter last pushed 2026-05-17 | fresh    | from card.docs_url          |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`

**Strategy**: git-clone

**Exit code**: 0

**Files moved**: 18 files + node_modules/

**Conflicts (.scaffold siblings)**: CLAUDE.md → CLAUDE.md.scaffold

**.gitignore handling**: moved silently (did not exist in cwd)

**.bootstrap-scaffold cleanup**: deleted

**File-by-file move log**:

- MOVE: .env.example
- MOVE: .github
- MOVE: .gitignore
- MOVE: .husky
- MOVE: .nvmrc
- MOVE: .prettierrc.json
- MOVE: .vscode
- MOVE: astro.config.mjs
- CONFLICT: CLAUDE.md → CLAUDE.md.scaffold
- MOVE: components.json
- DROP: context/ (cwd version preserved)
- MOVE: eslint.config.js
- MOVE: package-lock.json
- MOVE: package.json
- MOVE: public
- MOVE: README.md
- MOVE: src
- MOVE: supabase
- MOVE: tsconfig.json
- MOVE: wrangler.jsonc
- MOVE: node_modules/

## Post-scaffold audit

**Tool**: npm audit --json

**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW

**Direct vs transitive**: 0 CRITICAL direct, 0 HIGH direct, 2 MODERATE direct (total: 0/1/9/0)

### HIGH findings

**devalue** (5.6.3 - 5.8.0) - transitive via multiple paths

- Advisory ID: GHSA-77vg-94rm-hx3p
- Severity: HIGH (CVSS 7.5)
- Title: Svelte devalue: DoS via sparse array deserialization
- CWE: CWE-770 (Allocation of Resources Without Limits or Throttling)
- Fix available: update to devalue >5.8.0

### MODERATE findings

**@astrojs/check** - direct dependency

- Severity: MODERATE
- Via: @astrojs/language-server
- Fix available: downgrade to 0.9.2 (semver-major change required)

**@astrojs/language-server** - transitive

- Severity: MODERATE
- Via: volar-service-yaml

**@cloudflare/vite-plugin** - transitive

- Severity: MODERATE
- Via: miniflare, wrangler, ws

**miniflare** - transitive

- Severity: MODERATE
- Via: ws
- Effects: @cloudflare/vite-plugin, wrangler

**volar-service-yaml** - transitive

- Severity: MODERATE
- Via: yaml-language-server

**wrangler** - direct dependency

- Severity: MODERATE
- Via: miniflare
- Effects: @cloudflare/vite-plugin
- Fix available: update available

**ws** (8.0.0 - 8.20.0) - transitive

- Advisory ID: GHSA-58qx-3vcg-4xpx
- Severity: MODERATE (CVSS 4.4)
- Title: ws: Uninitialized memory disclosure
- CWE: CWE-908 (Use of Uninitialized Resource)
- Fix available: update to ws >=8.20.1

**yaml** (2.0.0 - 2.8.2) - transitive

- Advisory ID: GHSA-48c2-rrv3-qjmp
- Severity: MODERATE (CVSS 4.3)
- Title: yaml is vulnerable to Stack Overflow via deeply nested YAML collections
- CWE: CWE-674 (Uncontrolled Recursion)
- Fix available: update to yaml >=2.8.3

**yaml-language-server** - transitive

- Severity: MODERATE
- Via: yaml

### Notes

Total dependencies: 775 packages audited (449 production, 316 dev, 131 optional)

## Hints recorded but not acted on

The following hints from the hand-off were read but not acted upon in v1. A future skill (M1L4 "Memory Architecture") will consume these for AGENTS.md / CLAUDE.md generation and CI setup:

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | first-class          |
| quality_override        | false                |
| path_taken              | standard             |
| self_check_answers      | null                 |
| team_size               | solo                 |
| deployment_target       | cloudflare-pages     |
| ci_provider             | github-actions       |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                 |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | false                |
| has_background_jobs     | false                |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- `git init` (if you have not already) to start your own repo history.
- Review `CLAUDE.md.scaffold` vs `CLAUDE.md` — the scaffold version documents the starter's conventions; your existing version may have custom rules. Merge as appropriate.
- Address audit findings per your project's risk tolerance:
  - **HIGH**: The `devalue` DoS vulnerability is transitive. Run `npm audit fix` to attempt automatic patching, or wait for upstream dependency updates.
  - **MODERATE**: 9 moderate findings, mostly transitive. Review the list above and decide which to address immediately vs defer.
- Run `npm run dev` to start the development server and verify the scaffold works end-to-end.
