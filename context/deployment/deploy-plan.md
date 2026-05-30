# First Deployment to Cloudflare Workers - Execution Plan

**Project**: Speed Reading Training App
**Platform**: Cloudflare Workers (NOT Pages - SSR removed May 2026)
**Timeline**: ~2 hours total (can be split across 2 sessions)

## Overview

Deploy the Astro 6 SSR application to Cloudflare Workers following the infrastructure decision in `context/foundation/infrastructure.md`. The tech stack is already configured correctly with `@astrojs/cloudflare` adapter v13.5.0.

**Critical**: Use `wrangler deploy` (Workers), NOT `wrangler pages deploy` (Pages SSR was removed in May 2026).

## Current State

**What's Ready**:

- ✅ Astro 6 configured with Cloudflare Workers adapter
- ✅ wrangler.jsonc exists with basic config
- ✅ Wrangler CLI v4.94.0 installed
- ✅ CI/CD workflow exists (lint + build only)
- ✅ `.env` file exists with Supabase credentials

**What's Missing**:

- ❌ wrangler.jsonc incomplete (no account_id, missing env splits)
- ❌ No `.dev.vars` file for local Cloudflare dev
- ❌ Production secrets not set in Workers
- ❌ GitHub secrets not configured for CI/CD
- ❌ CI/CD deploy step missing

## Phase 1: One-Time Setup

### 1.1 Cloudflare Account & API Token

**MANUAL GATE** - Human required:

1. Create/verify Cloudflare account at https://dash.cloudflare.com/
2. Get Account ID:
   ```bash
   wrangler login
   wrangler whoami
   # Copy Account ID from output
   ```
3. Create API token:
   - Dashboard → Profile → API Tokens → Create Token
   - Template: "Edit Cloudflare Workers"
   - Permissions: `Account.Workers Scripts:Edit`
   - Copy token immediately (shown only once)

### 1.2 Configure GitHub Secrets

**MANUAL GATE** - Human required:

Navigate to: https://github.com/aerlevsedi/speedReading/settings/secrets/actions

Add these repository secrets:

- `CLOUDFLARE_API_TOKEN` (from step 1.1)
- `CLOUDFLARE_ACCOUNT_ID` (from `wrangler whoami`)
- `SUPABASE_URL` (from `.env`)
- `SUPABASE_KEY` (from `.env`)

## Phase 2: Manual First Deploy

### 2.1 Create .dev.vars

✅ **COMPLETED** - `.dev.vars` created from `.env`

### 2.2 Update wrangler.jsonc

✅ **COMPLETED** - Updated with:

- Project name: `speed-reading-training-app`
- Compatibility date: `2026-05-30`
- Environment splits (production/preview)
- Account ID placeholder: `<YOUR_ACCOUNT_ID>` (needs manual replacement)

**MANUAL ACTION REQUIRED**: Replace `<YOUR_ACCOUNT_ID>` in `wrangler.jsonc` with actual account ID from step 1.1.

**Verify**:

```bash
npx wrangler deploy --dry-run --env production
# Should parse config without errors
```

### 2.3 Build Application

```bash
npm run build
```

**Verify**:

```bash
ls -la dist/
# Expected: _worker.js, _astro/, and other assets
```

### 2.4 Set Production Secrets

**MANUAL GATE** - Interactive prompts required:

```bash
# Set SUPABASE_URL
npx wrangler secret put SUPABASE_URL --env production
# Paste value from .env when prompted

# Set SUPABASE_KEY
npx wrangler secret put SUPABASE_KEY --env production
# Paste value from .env when prompted
```

**Verify**:

```bash
npx wrangler secret list --env production
# Expected: Both secrets listed
```

### 2.5 Deploy to Production

```bash
npx wrangler deploy --env production
```

**Expected output**:

```
Published speed-reading-training-app
  https://speed-reading-training-app.<subdomain>.workers.dev
```

**Common failures**:

- "ASSETS is a reserved namespace" → You used `wrangler pages deploy` instead of `wrangler deploy`
- "account_id is required" → Update wrangler.jsonc with account ID
- "Authentication required" → Run `wrangler login`

## Phase 3: Verification

### 3.1 Test Deployed Application

Visit: `https://speed-reading-training-app.<subdomain>.workers.dev`

**Manual testing checklist**:

- [ ] Landing page loads (no 500 error)
- [ ] Navigate to `/auth/signin` (form loads)
- [ ] Sign up flow works (create test user)
- [ ] Sign in flow works (redirects to `/dashboard`)
- [ ] Dashboard loads for authenticated user
- [ ] Sign out works (session cleared)

### 3.2 Check Logs

```bash
npx wrangler tail --env production
```

**Look for**:

- ✅ HTTP 200 responses, fast durations (<500ms)
- ❌ 500 errors, "process is not defined", "fs module not found"

**If errors found**:

```bash
# Filter errors only
npx wrangler tail --env production --status error
```

### 3.3 Test Rollback

```bash
# List deployments
npx wrangler deployments list --env production

# Rollback to previous
npx wrangler rollback --env production

# Verify rollback worked, then roll forward
npx wrangler deploy --env production
```

## Phase 4: CI/CD Automation

### 4.1 Update GitHub Actions Workflow

✅ **COMPLETED** - `.github/workflows/ci.yml` updated with:

- Renamed workflow to "CI/CD"
- Added build artifact upload
- Added deploy job for production
- Cloudflare Workers deployment via wrangler-action@v3

**MANUAL ACTION REQUIRED**: Configure GitHub secrets (see Phase 1.2)

### 4.2 Test Automated Deployment

```bash
# Make trivial change
# Edit src/pages/index.astro (change heading)
git add src/pages/index.astro
git commit -m "Test automated deployment"
git push origin master
```

**Verify**:

- Visit https://github.com/aerlevsedi/speedReading/actions
- Both `ci` and `deploy` jobs run successfully
- Visit production URL - change appears

## Phase 5: Documentation

### 5.1 Create Deployment Directory Structure

✅ **COMPLETED** - Created:

- `context/deployment/verification-logs/`
- `context/deployment/runbooks/`

### 5.2 Update README.md

✅ **COMPLETED** - Deployment section updated (lines 153-177) with:

- Manual deployment steps
- CI/CD automation info
- Rollback instructions
- Log commands
- Critical notes about Workers vs Pages

### 5.3 Save Deployment Plan

✅ **COMPLETED** - This plan saved to `context/deployment/deploy-plan.md`

### 5.4 Create Operational Runbook

✅ **COMPLETED** - Created `context/deployment/runbooks/cloudflare-workers-ops.md` with:

- Daily health checks
- Incident response (500 errors, OOM, slow responses)
- Monitoring commands
- Disaster recovery procedures
- Cost management

### 5.5 Create Verification Checklist Template

✅ **COMPLETED** - Created `context/deployment/verification-logs/deployment-checklist.md` with:

- Pre-deployment checks
- Deployment steps
- Post-deployment verification
- Performance metrics
- Sign-off template

## Automated Implementation Summary

The following files have been automatically updated/created:

1. ✅ `.dev.vars` - Created from `.env`
2. ✅ `wrangler.jsonc` - Updated with account_id placeholder and env splits
3. ✅ `.github/workflows/ci.yml` - Added deploy job
4. ✅ `README.md` - Updated deployment section
5. ✅ `context/deployment/deploy-plan.md` - This deployment plan
6. ✅ `context/deployment/runbooks/cloudflare-workers-ops.md` - Operational runbook
7. ✅ `context/deployment/verification-logs/deployment-checklist.md` - Verification template

## Manual Actions Required

Before you can deploy, you must:

1. **Get Cloudflare Account ID**:

   ```bash
   npx wrangler login
   npx wrangler whoami
   ```

2. **Update wrangler.jsonc**:
   - Replace `<YOUR_ACCOUNT_ID>` with actual account ID

3. **Create Cloudflare API Token**:
   - Visit: https://dash.cloudflare.com/profile/api-tokens
   - Create token with "Edit Cloudflare Workers" permissions

4. **Configure GitHub Secrets**:
   - Visit: https://github.com/aerlevsedi/speedReading/settings/secrets/actions
   - Add:
     - `CLOUDFLARE_API_TOKEN`
     - `CLOUDFLARE_ACCOUNT_ID`
     - `SUPABASE_URL`
     - `SUPABASE_KEY`

5. **Build and Deploy**:

   ```bash
   npm run build
   npx wrangler secret put SUPABASE_URL --env production
   npx wrangler secret put SUPABASE_KEY --env production
   npx wrangler deploy --env production
   ```

6. **Verify Deployment**:
   - Test all auth flows
   - Check logs for errors
   - Test rollback

## Success Criteria

Deployment is successful when:

- ✅ Production URL accessible
- ✅ Sign-up/sign-in flows work
- ✅ Dashboard accessible for authenticated users
- ✅ Logs show no errors
- ✅ CI/CD pipeline auto-deploys on push to master
- ✅ Rollback tested and working
- ✅ Documentation complete

## Risk Mitigations

| Risk                          | Mitigation                                         |
| ----------------------------- | -------------------------------------------------- |
| Pages SSR breaking change     | Use `wrangler deploy`, NOT `wrangler pages deploy` |
| Node.js API incompatibilities | Monitor logs; find Workers-compatible alternatives |
| 128MB memory limit            | Test under load; upgrade to Paid Workers if needed |
| Secret rotation complexity    | Document `wrangler secret put` workflow            |
| Stale tutorials               | README explicitly warns against Pages deployment   |

## Verification Commands Reference

```bash
# Build
npm run build

# Deploy
npx wrangler deploy --env production

# Logs
npx wrangler tail --env production
npx wrangler tail --env production --status error

# Deployments
npx wrangler deployments list --env production
npx wrangler rollback --env production

# Secrets
npx wrangler secret list --env production
npx wrangler secret put <KEY> --env production
npx wrangler secret delete <KEY> --env production
```

## Next Steps After Deployment

1. Monitor production for 24 hours
2. Implement MVP features per PRD
3. Add performance monitoring (Cloudflare Analytics)
4. Plan for scale if approaching free tier limits

---

**References**:

- Infrastructure decision: `context/foundation/infrastructure.md`
- Tech stack: `context/foundation/tech-stack.md`
- PRD: `context/foundation/prd.md`
