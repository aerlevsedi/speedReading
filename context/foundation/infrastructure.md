---
project: speed-reading-training-app
researched_at: 2026-05-30
recommended_platform: Cloudflare Workers
runner_up: Netlify
context_type: mvp
tech_stack:
  language: JavaScript/TypeScript
  framework: Astro 6
  runtime: Cloudflare Workers (workerd)
---

## Recommendation

**Deploy on Cloudflare Workers.**

Cloudflare Workers scores 5/5 on agent-friendly criteria (CLI-first, managed/serverless, agent-readable docs, stable deploy API, GA MCP server) and costs $0 at MVP scale (3M requests/month free tier). The tech stack already specifies `deployment_target: cloudflare-pages`, but **critical caveat**: Cloudflare removed Pages SSR support in May 2026 — you must deploy to Workers (not Pages). The `@astrojs/cloudflare` adapter v13+ supports Workers SSR natively. The cost advantage ($0 vs $5–20/mo for alternatives), native MCP integration, and mature `wrangler` CLI outweigh the runtime constraints (no Node.js APIs, 128MB memory on free tier). Vendor lock-in (D1, KV, Durable Objects) is acceptable for MVP scope; migration paths exist if needed post-MVP.

## Platform Comparison

| Platform               | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP/Integration | Total   | Est. Monthly Cost                           |
| ---------------------- | --------- | ------------------ | ------------------- | ----------------- | --------------- | ------- | ------------------------------------------- |
| **Cloudflare Workers** | **Pass**  | **Pass**           | **Pass**            | **Pass**          | **Pass**        | **5/5** | **$0** (3M req/mo free)                     |
| **Netlify**            | Pass      | Pass               | **Pass**            | Pass              | **Pass**        | **5/5** | **$0** (300 credits, 1.5M req if optimized) |
| **Railway**            | Pass      | Pass               | **Pass**            | Pass              | Partial         | 4.5/5   | $15–20                                      |
| **Render**             | Partial   | Pass               | **Pass**            | Partial           | Pass            | 3.5/5   | $7 (free tier unusable for SSR)             |
| **Vercel**             | Pass      | Pass               | Partial             | Pass              | Pass            | 4/5     | $0 Hobby (commercial use prohibited)        |
| **Fly.io**             | Pass      | Pass               | Fail                | Pass              | Fail            | 3/5     | $5 (no free tier)                           |

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

**Why it won**: Perfect agent-friendliness (5/5 criteria) combined with zero cost at MVP scale. `wrangler` CLI is mature (deploy, rollback, logs all GA), MCP server is GA and reduces 2,500+ API endpoints to ~1,000 tokens, docs publish `llms.txt` and markdown. Free tier (100k requests/day = 3M/month) covers MVP traffic with room to spare. Native edge distribution (though single-region is fine per interview), co-located services (D1 SQLite, R2 storage, KV, Queues) available but external Supabase Postgres already chosen per tech stack. **Key strength vs. alternatives**: $0 baseline cost + agent-native tooling (MCP, llms.txt) + no commercial-use restrictions.

**Runtime caveat**: Workers runtime is V8 isolates (workerd), not Node.js — no `fs`, `child_process`, limited `node:crypto`. Any dependency using Node.js-specific APIs will fail at runtime. Astro 6 dev server now uses real Workers runtime (improving dev-prod parity), so incompatibilities surface locally. 128MB memory limit on free tier can cause OOM under concurrent SSR load; paid tier ($5/mo) raises cap to 256MB.

**Breaking change surfaced**: Cloudflare removed Pages SSR support in May 2026 (GitHub issue #30405). Deploy to Workers using `wrangler deploy`, not `wrangler pages deploy`. Stale tutorials referencing Pages SSR will fail with "ASSETS reserved name" errors.

#### 2. Netlify

**Why it scored second**: Tied 5/5 criteria but loses on cost predictability. Free tier is generous (300 credits/month = 1.5M requests if no other resource consumption), GA MCP server, `netlify` CLI mature, `llms.txt` published. New `netlify logs` command (GA May 2026) enables agent-driven log tailing. **Gap vs. Cloudflare**: credit-based billing is harder to predict than request-based; "300 credits" converts to ~1.5M requests only if bandwidth/compute overhead is minimal. Netlify Database (GA April 2026, free storage until July 1, 2026) co-locates Postgres, but Supabase is already chosen per tech stack.

**Hard limitation**: No persistent connections (serverless-only architecture). WebSockets impossible; SSE (Server-Sent Events) works as a long-lived HTTP stream. This is fine for the current MVP (no realtime requirement per PRD), but becomes a blocker if leaderboard or live progress features are added post-MVP.

#### 3. Railway

**Why it scored third**: 4.5/5 criteria (beta MCP, 15-min WebSocket limit) at $15–20/mo cost. Excellent DX (managed Postgres HA on Patroni, native WebSocket support, `llms.txt` GA, CLI GA), but cost-sensitive MVP makes this a fallback choice. **When Railway wins**: If Cloudflare's runtime constraints (no Node.js APIs, memory limits) prove too restrictive, Railway's native Node.js environment + co-located Postgres + cron jobs cover the gap. 15-min WebSocket timeout requires client reconnection logic but is manageable with Socket.IO auto-reconnect.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **No Node.js APIs in Workers runtime** — any dependency using `fs`, `child_process`, or native Node modules will fail at runtime. Polyfills may not cover all cases. This is a breaking constraint, not a performance trade-off. Charts, PDF generation, or heavy computation libraries often assume Node.js; alternatives must be found or logic rewritten.

2. **Pages SSR removal is a recent breaking change (May 2026)** — deployment targets documented across the web (Stack Overflow, tutorials, even Astro's own guides) may reference `@astrojs/cloudflare` + Pages SSR, which no longer works. Developers following stale tutorials will hit "ASSETS reserved name" errors and waste time debugging. The tech stack already specifies Workers, but external docs lag.

3. **128MB memory limit on free tier** — if the SSR app does any non-trivial computation (chart generation, PDF rendering, heavy JSON processing), 128MB is tight. No option to increase memory on free tier; upgrading to Paid Workers ($5/mo) raises the cap to 256MB, but that's still constrained compared to traditional Node.js hosts.

4. **Vendor lock-in to Cloudflare-specific APIs** — D1 (SQLite), KV, Durable Objects, R2 all use Cloudflare-specific SDKs. Migrating away later requires rewriting data access layers. This is fine for MVP but compounds technical debt if the platform doesn't scale with product needs. Supabase (already chosen) mitigates database lock-in, but any Workers-native storage adds exit friction.

5. **30-second CPU timeout** — not wall-clock time, but actual CPU execution. For SSR apps with slow external API calls (Supabase Auth, third-party services), this is usually not a problem, but if the app does synchronous heavy lifting (parsing large datasets, running algorithms), 30s CPU can be hit faster than expected.

### Pre-Mortem — How This Could Fail

Six months after deploying the speed-reading training app to Cloudflare Workers, the project is abandoned. Here's how it happened:

The developer followed the tech stack's recommendation to deploy to Cloudflare Pages with `@astrojs/cloudflare`, unaware that Pages SSR support was removed in May 2026. The first deploy failed with "ASSETS is a reserved namespace" errors. After 3 hours of debugging and finding a GitHub issue confirming Pages SSR is dead, they switched to Workers. That worked.

Two weeks later, they added a progress chart library (`recharts` or similar) that internally used Node's `stream` module. The app built fine but crashed at runtime in Workers with "process.env.STREAM is undefined". They spent 6 hours trying polyfills, eventually discovering the library was fundamentally incompatible with Workers' V8 isolate runtime. They had to switch to a different charting library or rewrite the chart logic from scratch.

At week 4, MVP traffic hit 50 concurrent users during a demo. The free tier's 128MB memory limit caused OOM errors when multiple SSR requests rendered the dashboard simultaneously (each request loaded session history + charts). Upgrading to Paid Workers fixed it, but now the project had a $5/mo baseline cost — not catastrophic, but the "free forever" pitch was broken.

At month 3, a feature request required background job processing (send reminder emails when users haven't practiced in 7 days). Workers doesn't support cron natively for free-tier users; the developer had to use Cloudflare Workers + Queues, which are billed separately and add complexity. Railway or Render would've had cron jobs as a first-class feature.

Finally, when the developer tried to migrate user data to a different platform (a client requirement), they discovered D1 exports were SQLite dumps with Cloudflare-specific metadata. The export/import path to Postgres required manual schema mapping and data cleaning. What should've been a 1-hour migration took 2 days.

The compounding friction — runtime incompatibilities, memory limits, lack of built-in cron, vendor lock-in — turned a "fast MVP" into a maintenance burden. The developer switched to Netlify (accepting the serverless constraint) or Railway (paying $15/mo for native Node.js and cron).

### Unknown Unknowns

1. **Cloudflare's Workers billing model is CPU-time-based, not wall-time** — if an external API call (Supabase, auth provider, third-party service) takes 2 seconds to respond, that doesn't count as CPU time. But if your code does 2 seconds of synchronous processing, that's billable CPU. Developers coming from serverless functions (Vercel, Netlify) expect to be charged by wall-clock invocation time, not CPU execution. This can lead to surprise bills if the app does heavy computation.

2. **Wrangler dev mode now uses the real Workers runtime** — this is a pro, not a con, but it means dev dependencies that work in Node.js may break locally during development, not just in production. The feedback loop is faster, but the local environment is less forgiving. Any Node.js-specific library (e.g., `fs`, `child_process`) will fail immediately during `npm run dev`, not later during deploy.

3. **D1 is SQLite, not Postgres** — developers familiar with Postgres (or using Supabase Postgres per the tech stack) may assume D1 is "just a hosted database". It's not. SQLite has different constraints: no `ALTER TABLE` for some schema changes, different JSON handling, no native full-text search (must use FTS5 extension). If the project later needs advanced SQL features, D1 may not be enough. This project uses Supabase Postgres, so D1 is irrelevant unless Workers-native storage is added.

4. **Cloudflare's free tier rate limits are per-account, not per-project** — if the developer has other side projects on the same Cloudflare account, all projects share the 100k requests/day limit. A spike in one project can throttle another. Paid Workers have per-project billing, which isolates usage.

5. **MCP server OAuth flow requires Claude Pro/Team** — the Cloudflare MCP server is GA, but OAuth-based access (for Claude Desktop, Cursor, etc.) requires a paid Claude subscription. If the developer is using Claude Free, they can't authenticate the MCP server. The CLI (`wrangler`) works fine, but the "agent-friendly MCP integration" selling point doesn't apply without a paid Claude account.

## Operational Story

How Cloudflare Workers actually operates day to day:

- **Preview deploys**: Each `git push` triggers a GitHub Actions workflow (`.github/workflows/ci.yml` already exists) that can run `wrangler deploy --env preview` to create a preview URL (e.g., `preview.speed-reading-training-app.workers.dev`). Preview deployments are not automatic on Workers (unlike Pages); they require explicit CI configuration. No built-in fork PR protection; preview URLs are public unless protected via Cloudflare Access (requires Cloudflare Zero Trust, free tier available but setup overhead). Recommendation: configure GitHub Actions to deploy PRs to preview env, add Cloudflare Access if previews leak sensitive data.

- **Secrets**: Environment variables live in Workers Secrets (set via `wrangler secret put <KEY>` or dashboard). Secrets are encrypted at rest, scoped per-environment (production, preview), readable only by Workers code at runtime (not via CLI after set). GitHub Secrets store CI/CD credentials (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`). Rotation flow: `wrangler secret put <KEY>` (prompts for new value), old value overwritten immediately. No secret versioning on free tier; paid Workers support secret history.

- **Rollback**: `wrangler rollback [VERSION_ID]` defaults to previous version if ID omitted. Rollback is instantaneous (edge nodes update within seconds). List versions: `wrangler versions list`. View version details: `wrangler versions view <ID>`. Rollback does NOT revert database migrations or external state (Supabase schema changes, R2 object deletions) — only the Workers code. Always test rollback locally with `wrangler dev` before applying to production.

- **Approval**: Human-required actions: (1) Initial Cloudflare account creation + API token generation, (2) `wrangler secret put` for production secrets (SUPABASE_URL, SUPABASE_KEY), (3) Force-push to main (if configured as protected branch), (4) Deleting a Workers project (destructive, no undo). Agent-allowed unattended: (1) Deploy to preview env, (2) Tail logs (`wrangler tail`), (3) Rollback to previous version (non-destructive), (4) List deployments/versions (read-only). Never grant agents write access to production secrets or project deletion.

- **Logs**: `wrangler tail` streams real-time logs with filters (`--status error`, `--search "term"`, `--format json`, `--sampling-rate 0.1`). Logs include console output, uncaught exceptions, request metadata (method, URL, status, duration). Historical logs available in Cloudflare dashboard (Analytics > Logs) but not via CLI on free tier (requires Workers Paid + Logpush). Agent reads logs via CLI: `wrangler tail --env production --status error` or MCP server (read-only logs tool). No log retention guarantees on free tier; Logpush (paid) sends logs to external storage (S3, R2, etc.).

## Risk Register

| Risk                                                                                   | Source                       | Likelihood | Impact     | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------- | ---------------------------- | ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js dependency breaks at runtime (no `fs`, `child_process`, limited `node:crypto`) | Devil's advocate             | **High**   | **High**   | Audit dependencies before adding (check for Node.js-specific APIs). Prefer Workers-compatible libraries (e.g., `date-fns` over `moment`, `zod` over `ajv`). Test locally with `npm run dev` (Astro 6 uses real Workers runtime). Keep a list of known-incompatible libs (e.g., `sharp` for image processing, `pdf-lib` for PDFs) and have Workers-compatible alternatives ready (`@cloudflare/workers-image`, client-side PDF.js).                                                                                                   |
| Pages SSR breaking change causes deploy failures                                       | Devil's advocate             | **Medium** | **Medium** | Ignore all references to `wrangler pages deploy` or `@astrojs/cloudflare` + Pages SSR. Use `wrangler deploy` (Workers, not Pages). Verify `astro.config.mjs` specifies `output: "server"` and `adapter: cloudflare()` with no `mode: "directory"` (Pages-specific). If following external tutorials, cross-check against Cloudflare's official docs (last updated post-May 2026).                                                                                                                                                    |
| 128MB memory limit causes OOM under concurrent SSR load                                | Devil's advocate, Pre-mortem | **Medium** | **High**   | Monitor memory usage via `wrangler tail` (OOM errors show as "Worker exceeded memory limit"). Optimize SSR rendering: lazy-load components, paginate large datasets, cache static content at edge (Cloudflare Cache API). If free tier OOM persists, upgrade to Paid Workers ($5/mo, 256MB limit). For heavy computation (charts, reports), move to client-side rendering or background jobs (Cloudflare Queues).                                                                                                                    |
| Vendor lock-in to Cloudflare-specific APIs (D1, KV, Durable Objects)                   | Devil's advocate, Pre-mortem | **Low**    | **Medium** | This project uses Supabase Postgres (already chosen), so database lock-in is avoided. If Workers KV or D1 are added later, abstract behind a data access layer (e.g., `src/lib/storage.ts` with swappable backends). Document migration paths in `context/foundation/lessons.md` as they're discovered. KV → Redis migration is straightforward (key-value semantics identical). D1 → Postgres requires schema conversion (SQLite → Postgres dialect differences).                                                                   |
| 30-second CPU timeout hit during synchronous processing                                | Devil's advocate             | **Low**    | **Medium** | Astro SSR is I/O-bound (database queries, API calls), not CPU-bound. 30s CPU timeout is unlikely to be hit unless the app does heavy computation (e.g., server-side chart rendering, large JSON parsing). If timeout occurs, offload to background job (Cloudflare Queues) or client-side (move chart rendering to React component with `client:load`). Monitor CPU time via `wrangler tail` (log entries include CPU duration).                                                                                                     |
| Billing surprise from CPU-time vs wall-time model                                      | Unknown unknowns             | **Low**    | **Low**    | Cloudflare bills by CPU execution time, not wall-clock invocation time. External API waits (Supabase, OAuth) don't count toward CPU. Free tier (100k req/day, 10ms CPU/invocation) covers typical SSR workloads with margin. Monitor usage in Cloudflare dashboard (Analytics > Workers). If CPU usage spikes unexpectedly, profile with `console.time()` / `console.timeEnd()` to find hot paths. Paid tier overages: $0.02/million CPU-ms (cheap unless doing heavy computation).                                                  |
| Dev dependencies break locally with real Workers runtime                               | Unknown unknowns             | **Medium** | **Low**    | Astro 6 dev server (`npm run dev`) now uses workerd (real Workers runtime) instead of Node.js. This surfaces runtime incompatibilities earlier (a pro), but means dev environment is stricter. If a dev dependency (e.g., test fixture generator, dev-only script) uses Node.js APIs, move it to a separate Node.js script (`scripts/seed-data.js`) and run outside Astro's dev server. Keep `package.json` devDependencies clean of Node.js-specific libs.                                                                          |
| D1 (SQLite) vs Postgres semantic differences                                           | Unknown unknowns             | **Low**    | **Low**    | Not applicable — this project uses Supabase Postgres. If D1 is added later for Workers-local caching, be aware: D1 is SQLite (different `ALTER TABLE` support, JSON handling, no full-text search without FTS5). Document D1 usage in `context/foundation/tech-stack.md` if adopted.                                                                                                                                                                                                                                                 |
| Free tier rate limits shared across all projects on account                            | Unknown unknowns             | **Low**    | **Low**    | Cloudflare free tier limits (100k req/day) apply per-account, not per-project. If multiple side projects share the same account, they compete for quota. Mitigation: use separate Cloudflare accounts for unrelated projects, or upgrade to Paid Workers ($5/mo, per-project billing). Monitor per-project usage in dashboard (Workers > Analytics).                                                                                                                                                                                 |
| MCP server requires paid Claude subscription for OAuth                                 | Unknown unknowns             | **Low**    | **Low**    | Cloudflare MCP server (GA) supports OAuth-authenticated access, but OAuth flow requires Claude Pro/Team/Enterprise (not Free). If using Claude Free, MCP server can't authenticate. Fallback: use `wrangler` CLI directly (no MCP). CLI works identically; MCP adds convenience (structured tools vs CLI parsing). If MCP is critical, upgrade to Claude Pro ($20/mo).                                                                                                                                                               |
| Chart library incompatibility with Workers runtime                                     | Pre-mortem                   | **Medium** | **High**   | If adding progress charts (FR-014 requirement), verify library compatibility. Server-side chart rendering (e.g., `recharts`, `chart.js` in SSR) may use Node.js `canvas` or `stream` APIs (incompatible with Workers). Mitigation: use client-side rendering (`client:load` in Astro) for charts, or Workers-compatible libraries (`@cloudflare/d3` if available, or raw SVG generation). Test chart rendering locally with `npm run dev` before deploy.                                                                             |
| Lack of built-in cron for background jobs                                              | Pre-mortem                   | **Low**    | **Medium** | Workers doesn't support cron on free tier. If background jobs are needed post-MVP (e.g., send reminder emails when users haven't practiced in 7 days), use Cloudflare Queues (GA, paid) or external cron (GitHub Actions scheduled workflows, Supabase Edge Functions + pg_cron). Railway or Render have built-in cron ($1/mo), but that's a platform swap. For MVP, defer background jobs until required.                                                                                                                           |
| Data migration friction if platform swap needed                                        | Pre-mortem                   | **Low**    | **Medium** | Supabase Postgres (already chosen) is platform-agnostic, so database migration is trivial (export SQL dump, import to new host). If Workers KV or D1 are used, migration requires custom scripts. Mitigation: minimize use of Workers-native storage. If KV is adopted, document export process (`wrangler kv:key list` + `wrangler kv:key get` scripted to JSON dump). D1 exports are SQLite dumps (`.db` file), convertible to Postgres with schema mapping tools.                                                                 |
| Concurrent SSR OOM during traffic spikes                                               | Pre-mortem                   | **Medium** | **High**   | Duplicate of "128MB memory limit" risk above. Covered in mitigation: monitor via logs, optimize rendering, cache static content, upgrade to Paid Workers if needed.                                                                                                                                                                                                                                                                                                                                                                  |
| Stale tutorial confusion on Pages vs Workers                                           | Research finding             | **Medium** | **Low**    | Cloudflare removed Pages SSR support in May 2026. External tutorials, Stack Overflow answers, and even Astro's own guides may reference Pages SSR (now broken). Developers following stale docs will hit "ASSETS reserved name" errors. Mitigation: always cross-check against official Cloudflare docs (post-May 2026). Trust `wrangler deploy` (Workers), not `wrangler pages deploy` (broken for SSR). Add a note in `CLAUDE.md` or `context/foundation/lessons.md`: "Deploy to Workers, not Pages — Pages SSR removed May 2026." |

## Getting Started

1. **Install Wrangler CLI** (if not already installed):

   ```bash
   npm install -g wrangler
   ```

2. **Authenticate Wrangler** with your Cloudflare account:

   ```bash
   wrangler login
   ```

   Opens a browser window for OAuth. Grants CLI access to your Cloudflare account.

3. **Verify Astro configuration** (`astro.config.mjs`) specifies Workers deployment (not Pages):

   ```typescript
   import { defineConfig } from "astro/config";
   import cloudflare from "@astrojs/cloudflare";

   export default defineConfig({
     output: "server", // SSR mode
     adapter: cloudflare(), // Workers runtime (NOT Pages)
   });
   ```

   Ensure `@astrojs/cloudflare` is v13+ (Astro 6 requirement).

4. **Create `wrangler.toml`** in project root (if not already present):

   ```toml
   name = "speed-reading-training-app"
   main = "dist/_worker.js"
   compatibility_date = "2026-05-30"
   account_id = "<YOUR_ACCOUNT_ID>"  # Get from Cloudflare dashboard
   workers_dev = true  # Enable *.workers.dev subdomain for testing

   [env.production]
   name = "speed-reading-training-app"
   routes = [
     { pattern = "speedreading.example.com", zone_name = "example.com" }
   ]

   [env.preview]
   name = "speed-reading-training-app-preview"
   ```

5. **Set secrets** (Supabase credentials from `.env`):

   ```bash
   wrangler secret put SUPABASE_URL
   # Paste value when prompted
   wrangler secret put SUPABASE_KEY
   # Paste value when prompted
   ```

6. **Build and deploy** to Workers:

   ```bash
   npm run build
   wrangler deploy
   ```

   First deploy creates a `*.workers.dev` URL (e.g., `speed-reading-training-app.sobas.workers.dev`). Custom domain configuration requires adding a route in `wrangler.toml` and DNS setup in Cloudflare dashboard.

7. **Tail logs** to verify deployment:
   ```bash
   wrangler tail
   ```
   Visit the `*.workers.dev` URL in a browser, check for SSR rendering and Supabase auth flow.

**Critical gotcha**: Do NOT use `wrangler pages deploy` — Pages SSR was removed in May 2026. Always use `wrangler deploy` (Workers).

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration (not applicable to Workers — uses V8 isolates, not containers)
- CI/CD pipeline setup (GitHub Actions workflow already exists; Wrangler integration deferred to implementation phase)
- Production-scale architecture (multi-region, HA, DR) — MVP scope only
- Cloudflare Pages (static site hosting) — this research focused on SSR deployment, which requires Workers
