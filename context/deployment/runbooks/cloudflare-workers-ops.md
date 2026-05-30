# Cloudflare Workers Operational Runbook

**Project**: Speed Reading Training App
**Platform**: Cloudflare Workers
**Last Updated**: 2026-05-30

## Daily Health Checks

### Quick Status Check

```bash
# Check if site is accessible
curl -I https://speed-reading-training-app.<subdomain>.workers.dev

# View recent logs
npx wrangler tail --env production --format json | head -20
```

### Performance Metrics

```bash
# Real-time request monitoring
npx wrangler tail --env production

# Check for slow responses (>500ms)
npx wrangler tail --env production | grep -E "duration.*[5-9][0-9]{2,}"
```

### Error Monitoring

```bash
# Show only errors
npx wrangler tail --env production --status error

# Count errors in last 5 minutes
npx wrangler tail --env production --status error --format json | jq -s 'length'
```

## Incident Response

### 500 Errors

**Symptoms**: Users see "Internal Server Error"

**Diagnosis**:

```bash
# Get error logs
npx wrangler tail --env production --status error

# Check recent deployments
npx wrangler deployments list --env production
```

**Resolution**:

1. Identify the error from logs
2. If recent deployment caused it:
   ```bash
   npx wrangler rollback --env production
   ```
3. Fix the issue locally
4. Test with `npm run build && npm run preview`
5. Redeploy: `npx wrangler deploy --env production`

### Out of Memory (OOM)

**Symptoms**:

- 500 errors
- Logs show "Exceeded memory limit"
- Workers free tier: 128MB limit

**Diagnosis**:

```bash
# Check for memory-related errors
npx wrangler tail --env production | grep -i "memory"
```

**Resolution**:

1. Identify memory-heavy operations
2. Optimize:
   - Reduce payload sizes
   - Implement pagination
   - Stream large responses
   - Cache static data
3. If optimization insufficient, upgrade to Paid Workers ($5/month, 256MB)

### Slow Responses

**Symptoms**: Pages load slowly (>2s)

**Diagnosis**:

```bash
# Monitor response times
npx wrangler tail --env production --format json | jq '.event.request.duration'

# Check for database bottlenecks
npx wrangler tail --env production | grep -i "supabase"
```

**Resolution**:

1. Identify slow operations from logs
2. Common fixes:
   - Add database indexes (Supabase)
   - Implement caching
   - Optimize queries (select only needed fields)
   - Use edge caching for static content
3. Monitor after fix:
   ```bash
   npx wrangler tail --env production | grep "duration"
   ```

### Authentication Failures

**Symptoms**: Users cannot sign in/up

**Diagnosis**:

```bash
# Check auth-related errors
npx wrangler tail --env production | grep -i "auth"

# Verify secrets are set
npx wrangler secret list --env production
```

**Resolution**:

1. Verify Supabase credentials:
   ```bash
   npx wrangler secret list --env production
   # Should show: SUPABASE_URL, SUPABASE_KEY
   ```
2. If secrets missing:
   ```bash
   npx wrangler secret put SUPABASE_URL --env production
   npx wrangler secret put SUPABASE_KEY --env production
   ```
3. Test sign-in flow manually
4. Check Supabase dashboard for service status

## Monitoring Commands

### Deployment Status

```bash
# List recent deployments
npx wrangler deployments list --env production

# View specific deployment
npx wrangler deployments view <deployment-id> --env production
```

### Secrets Management

```bash
# List all secrets
npx wrangler secret list --env production

# Add/update secret
npx wrangler secret put <SECRET_NAME> --env production

# Delete secret
npx wrangler secret delete <SECRET_NAME> --env production
```

### Account Info

```bash
# Show account details
npx wrangler whoami

# Show Worker details
npx wrangler deployments list --env production
```

## Disaster Recovery

### Complete Service Outage

**Steps**:

1. Check Cloudflare status: https://www.cloudflarestatus.com/
2. Verify DNS resolution:
   ```bash
   nslookup speed-reading-training-app.<subdomain>.workers.dev
   ```
3. If Cloudflare service is up, check deployment:
   ```bash
   npx wrangler deployments list --env production
   ```
4. Rollback to last known good deployment:
   ```bash
   npx wrangler rollback --env production
   ```

### Lost Secrets

**Prevention**: Store secrets in password manager

**Recovery**:

1. Get secrets from `.env` file (local backup)
2. Re-set in production:
   ```bash
   npx wrangler secret put SUPABASE_URL --env production
   npx wrangler secret put SUPABASE_KEY --env production
   ```
3. Verify application works

### Database Corruption (Supabase)

**Steps**:

1. Check Supabase dashboard: https://app.supabase.com/
2. Verify database connectivity:
   ```bash
   # Test from local
   npm run dev
   # Try sign-up flow
   ```
3. If Supabase migration needed:
   ```bash
   npx supabase db reset
   npx supabase db push
   ```
4. Redeploy application:
   ```bash
   npx wrangler deploy --env production
   ```

## Cost Management

### Free Tier Limits

- **Requests**: 100,000/day (3M/month)
- **CPU Time**: 10ms/request
- **Memory**: 128MB
- **Duration**: No limit on Workers

### Monitoring Usage

```bash
# Cloudflare dashboard → Workers & Pages → Analytics
# Or use wrangler:
npx wrangler tail --env production --format json | jq -s 'length'
# Run for 1 minute, multiply by 1440 for daily estimate
```

### Approaching Limits

**Warning signs**:

- Dashboard shows >80% of daily request limit
- Requests start failing with 429 (rate limit)

**Actions**:

1. Identify traffic patterns:
   ```bash
   npx wrangler tail --env production --format json | jq '.event.request.url'
   ```
2. Implement rate limiting
3. Add caching for static content
4. Upgrade to Paid Workers ($5/month):
   - 10M requests/month included
   - $0.50 per additional 1M requests

### Cost Optimization

1. **Cache static assets**:
   - CSS, JS, images served from Cloudflare edge
   - Reduces Worker invocations
2. **Optimize Workers**:
   - Return early for invalid requests
   - Use conditional requests (304 Not Modified)
3. **Monitor regularly**:
   ```bash
   # Weekly usage check
   npx wrangler tail --env production --format json | jq -s 'length'
   ```

## Scheduled Maintenance

### Weekly Tasks

- [ ] Review error logs: `npx wrangler tail --env production --status error`
- [ ] Check deployment history: `npx wrangler deployments list --env production`
- [ ] Verify secrets exist: `npx wrangler secret list --env production`
- [ ] Test critical flows (sign-up, sign-in, dashboard)

### Monthly Tasks

- [ ] Review usage/costs in Cloudflare dashboard
- [ ] Update dependencies: `npm outdated`
- [ ] Check for Cloudflare Workers updates
- [ ] Review and archive old deployments

## Emergency Contacts

- **Cloudflare Support**: https://dash.cloudflare.com/support
- **Cloudflare Status**: https://www.cloudflarestatus.com/
- **Supabase Support**: https://app.supabase.com/support
- **GitHub Issues**: https://github.com/aerlevsedi/speedReading/issues

## Useful Links

- **Cloudflare Dashboard**: https://dash.cloudflare.com/
- **Workers Analytics**: Dashboard → Workers & Pages → speed-reading-training-app → Analytics
- **Supabase Dashboard**: https://app.supabase.com/
- **GitHub Repository**: https://github.com/aerlevsedi/speedReading
- **GitHub Actions**: https://github.com/aerlevsedi/speedReading/actions
