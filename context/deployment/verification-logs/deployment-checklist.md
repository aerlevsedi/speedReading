# Deployment Verification Checklist

**Date**: **********\_**********
**Deployed By**: **********\_**********
**Deployment ID**: **********\_**********
**Environment**: production / preview

## Pre-Deployment Checks

- [ ] Local build succeeds: `npm run build`
- [ ] All tests pass: `npm test` (if applicable)
- [ ] Linting passes: `npm run lint`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] Secrets verified: `npx wrangler secret list --env production`
  - [ ] SUPABASE_URL
  - [ ] SUPABASE_KEY
- [ ] Git status clean or changes committed
- [ ] Branch up to date with remote

## Deployment Steps

### Manual Deployment

- [ ] Build completed: `npm run build`
- [ ] Deployment command executed: `npx wrangler deploy --env production`
- [ ] Deployment URL captured: **********\_**********
- [ ] No errors in deployment output

### Automated Deployment (CI/CD)

- [ ] Code pushed to master branch
- [ ] GitHub Actions CI job passed
- [ ] GitHub Actions deploy job passed
- [ ] Deployment URL from logs: **********\_**********

## Post-Deployment Verification

### Smoke Tests

- [ ] Landing page loads: `https://speed-reading-training-app.<subdomain>.workers.dev`
- [ ] Status code 200
- [ ] No console errors (check browser DevTools)

### Authentication Flow

- [ ] Navigate to `/auth/signin`
- [ ] Sign-in form renders correctly
- [ ] Navigate to `/auth/signup`
- [ ] Sign-up form renders correctly
- [ ] Create test user: **********\_**********
  - Email: **********\_**********
  - Password: (stored securely)
- [ ] Sign-up succeeds (no errors)
- [ ] Sign-in with test user succeeds
- [ ] Redirect to `/dashboard` works
- [ ] Dashboard loads for authenticated user
- [ ] User data displays correctly
- [ ] Sign-out works (session cleared)
- [ ] After sign-out, `/dashboard` redirects to `/auth/signin`

### Protected Routes

- [ ] Unauthenticated access to `/dashboard` redirects to `/auth/signin`
- [ ] Authenticated access to `/dashboard` succeeds
- [ ] Middleware correctly identifies user session

### Performance Checks

- [ ] Landing page load time: **\_** ms (target: <500ms)
- [ ] Dashboard load time: **\_** ms (target: <1000ms)
- [ ] Sign-in flow response time: **\_** ms (target: <800ms)

### Log Verification

```bash
npx wrangler tail --env production
```

- [ ] Logs streaming successfully
- [ ] HTTP 200 responses for successful requests
- [ ] No 500 errors
- [ ] No "process is not defined" errors
- [ ] No "fs module not found" errors
- [ ] Request durations within acceptable range (<500ms)

## Performance Metrics

| Metric               | Value     | Target  | Status  |
| -------------------- | --------- | ------- | ------- |
| Landing page load    | **\_** ms | <500ms  | ✅ / ❌ |
| Dashboard load       | **\_** ms | <1000ms | ✅ / ❌ |
| Sign-in response     | **\_** ms | <800ms  | ✅ / ❌ |
| Average request time | **\_** ms | <500ms  | ✅ / ❌ |

## Rollback Test

- [ ] Rollback command tested: `npx wrangler rollback --env production`
- [ ] Previous deployment restored successfully
- [ ] Site still functional after rollback
- [ ] Re-deploy to current version: `npx wrangler deploy --env production`

## Issues Encountered

| Issue | Severity | Resolution | Time to Resolve |
| ----- | -------- | ---------- | --------------- |
|       |          |            |                 |
|       |          |            |                 |

**Severity**: Critical / High / Medium / Low

## Sign-Off

### Technical Verification

- [ ] All smoke tests passed
- [ ] Performance within acceptable range
- [ ] No critical errors in logs
- [ ] Rollback tested and working

### Business Verification

- [ ] Core user flows working (sign-up, sign-in, dashboard)
- [ ] No breaking changes to existing functionality
- [ ] Ready for production traffic

**Verified By**: **********\_**********
**Date/Time**: **********\_**********

**Deployment Status**: ✅ Success / ⚠️ Success with issues / ❌ Failed

## Notes

_Any additional observations, warnings, or follow-up actions:_

---

## Quick Command Reference

```bash
# Deploy
npx wrangler deploy --env production

# View logs
npx wrangler tail --env production
npx wrangler tail --env production --status error

# Deployments
npx wrangler deployments list --env production
npx wrangler rollback --env production

# Secrets
npx wrangler secret list --env production
npx wrangler secret put <KEY> --env production
```
