# Operational Runbook

**Last Updated:** 2025-10-03
**Status:** Production Ready
**Priority:** 5.4 - Ops Documentation

---

## Overview

This runbook provides operational procedures for running Moose Mission Control in production, including:
1. Daily operations
2. Monitoring and alerting
3. Escalation response
4. Troubleshooting procedures
5. Emergency response

---

## 1. Daily Operations

### 1.1 Morning Health Check (10 minutes)

**Access Health Dashboard:**
```
URL: https://your-app.vercel.app
Login: Supabase credentials
Navigate to: Health Monitor tab
```

**Check Key Metrics:**
- [ ] **System Status:** Should be "Healthy" (green)
- [ ] **Stuck Work Orders:** Should be 0 (or investigate if >0)
- [ ] **Open Escalations:** Review any pending escalations
- [ ] **Budget Usage:** Should be <80% of daily limit ($100)
- [ ] **Error Rate:** Should be <5% in last 24 hours

**Dashboard Interpretation:**

| Status | Indicator | Action Required |
|--------|-----------|-----------------|
| ✅ HEALTHY | All metrics green | None - system operating normally |
| ⚠️ WARNING | Budget >80% OR errors >5% | Monitor closely, investigate trends |
| 🚨 ERROR | Stuck WOs OR pending escalations | **Immediate action required** |

### 1.2 Review Escalations (5-15 minutes)

**Check Escalations Tab:**
```
Mission Control → Escalations Tab
Badge shows count of pending escalations
```

**For Each Escalation:**
1. **Read context:** Work Order ID, failure reason, cost spent
2. **Review AI recommendation:** Recommended resolution with confidence
3. **Evaluate options:** 4-5 resolution strategies with pros/cons
4. **Make decision:** Select option and add notes
5. **Execute:** Click "Execute Decision" button
6. **Verify:** Check Work Order status updates

**Typical Resolution Time:** 5-10 minutes per escalation

**Escalation Response SLA:**
- **High Priority:** <30 minutes (budget critical, security issues)
- **Medium Priority:** <2 hours (test failures, retry exhausted)
- **Low Priority:** <24 hours (optimization suggestions)

### 1.3 Budget Monitoring

**Check Daily Spend:**
```bash
curl https://your-app.vercel.app/api/budget-status

# Expected response:
{
  "daily_total": 12.50,
  "limit": 100,
  "percentage": 12.5,
  "status": "healthy"
}
```

**Budget Thresholds:**
- **$0-20 (Soft Cap):** Normal operations, continue
- **$20-50 (Warning):** Monitor closely, system switches to cheaper models
- **$50-80 (Hard Cap):** System forces gpt-4o-mini for all requests
- **$80-100 (Critical):** Prepare for emergency kill
- **$100+ (Emergency Kill):** All LLM operations stop, escalations created

**Action on Budget Alerts:**
```bash
# If budget >80%, review cost breakdown:
# 1. Check outcome_vectors for highest-cost work orders
SELECT work_order_id, SUM(cost) as total_cost
FROM outcome_vectors
WHERE created_at >= CURRENT_DATE
GROUP BY work_order_id
ORDER BY total_cost DESC
LIMIT 10;

# 2. Identify expensive patterns (high refinement cycles, complex WOs)
# 3. Consider pausing non-critical work orders
# 4. Adjust complexity thresholds if needed
```

### 1.4 Work Order Status Review (5 minutes)

**Check Active Work Orders:**
```
Mission Control → Work Orders Tab
Filter: Status = "in_progress" or "pending"
```

**Red Flags:**
- Work Orders stuck in "pending" >2 hours
- Work Orders in "in_progress" >24 hours
- Work Orders with >3 refinement attempts

**Investigation:**
```sql
-- Find stuck work orders
SELECT id, title, status, created_at, updated_at,
       EXTRACT(EPOCH FROM (NOW() - updated_at))/3600 as hours_stuck
FROM work_orders
WHERE status IN ('pending', 'in_progress')
  AND updated_at < NOW() - INTERVAL '24 hours'
ORDER BY hours_stuck DESC;

-- Check for error patterns
SELECT metadata->'error_message' as error, COUNT(*)
FROM outcome_vectors
WHERE success = false
  AND created_at >= CURRENT_DATE
GROUP BY metadata->'error_message'
ORDER BY COUNT(*) DESC;
```

---

## 2. Monitoring and Alerting

### 2.1 Health Endpoint Monitoring

**Setup Automated Checks (Recommended):**

**Option 1: Vercel Cron (Serverless Functions):**
```typescript
// api/cron/health-check.ts
export const config = {
  runtime: 'edge',
  // Run every 5 minutes
  schedule: '*/5 * * * *'
};

export default async function handler() {
  const health = await fetch('https://your-app.vercel.app/api/admin/health');
  const data = await health.json();

  if (data.status !== 'healthy') {
    // Send alert (email, Slack, etc.)
    await sendAlert({
      level: 'error',
      message: `System unhealthy: ${JSON.stringify(data)}`
    });
  }

  return Response.json({ checked: true });
}
```

**Option 2: External Monitoring (UptimeRobot, Pingdom):**
```
Monitor URL: https://your-app.vercel.app/api/admin/health
Interval: 5 minutes
Alert on: status != "healthy" OR response time >2000ms
```

### 2.2 Alert Configuration

**Alert Channels:**

**Email Alerts (via Supabase Functions):**
```sql
-- Create notification function
CREATE OR REPLACE FUNCTION notify_stuck_work_orders()
RETURNS trigger AS $$
BEGIN
  -- Send email when work order stuck >24h
  PERFORM net.http_post(
    url := 'https://api.sendgrid.com/v3/mail/send',
    headers := '{"Authorization": "Bearer YOUR_SENDGRID_KEY"}'::jsonb,
    body := jsonb_build_object(
      'personalizations', jsonb_build_array(
        jsonb_build_object('to', jsonb_build_array(
          jsonb_build_object('email', 'team@example.com')
        ))
      ),
      'from', jsonb_build_object('email', 'alerts@moose.ai'),
      'subject', 'Alert: Work Order Stuck >24h',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'text/plain', 'value',
          'Work Order ' || NEW.id || ' has been stuck for >24 hours')
      )
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on work order updates
CREATE TRIGGER stuck_work_order_alert
AFTER UPDATE ON work_orders
FOR EACH ROW
WHEN (NEW.updated_at < NOW() - INTERVAL '24 hours')
EXECUTE FUNCTION notify_stuck_work_orders();
```

**Slack Alerts (Webhook Integration):**
```typescript
// lib/alerting.ts
export async function sendSlackAlert(message: string, severity: 'info' | 'warning' | 'error') {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  const color = severity === 'error' ? 'danger' : severity === 'warning' ? 'warning' : 'good';

  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attachments: [{
        color,
        text: message,
        footer: 'Moose Mission Control',
        ts: Math.floor(Date.now() / 1000)
      }]
    })
  });
}

// Usage in health monitor
if (stuckWorkOrders.length > 0) {
  await sendSlackAlert(
    `⚠️ ${stuckWorkOrders.length} work orders stuck >24h`,
    'warning'
  );
}
```

### 2.3 Key Metrics to Monitor

**Application Metrics:**
- API response times (P50, P95, P99)
- Error rate (4xx, 5xx responses)
- Database query performance
- Active work order count
- Daily budget usage

**Infrastructure Metrics (Vercel Dashboard):**
- Function execution count
- Function duration
- Bandwidth usage
- Build success rate

**Database Metrics (Supabase Dashboard):**
- Connection count
- Query performance (slow queries)
- Database size
- Table sizes (work_orders, outcome_vectors growth)

---

## 3. Escalation Response Procedures

### 3.1 Escalation Types and Response

**Type 1: Retry Exhausted**

**Trigger:** Work Order failed after 3+ refinement cycles

**Investigation:**
```sql
-- Check failure history
SELECT metadata->'refinement_metadata' as refinement_history
FROM outcome_vectors
WHERE work_order_id = '[work-order-id]'
ORDER BY created_at DESC;

-- Review error patterns
SELECT metadata->'error_details' as errors
FROM outcome_vectors
WHERE work_order_id = '[work-order-id]'
  AND success = false;
```

**Resolution Options:**
1. **Retry with different approach:** Change model (gpt-4o-mini → claude-sonnet-4.5)
2. **Pivot solution:** Modify acceptance criteria or files in scope
3. **Amend work orders:** Split into smaller chunks
4. **Abort and redesign:** Escalate to Architect for re-decomposition

**SLA:** 2 hours

---

**Type 2: Budget Warning/Critical**

**Trigger:** Daily spend >$50 (warning) or >$80 (critical)

**Investigation:**
```sql
-- Check top cost contributors
SELECT
  work_order_id,
  model_used,
  SUM(cost) as total_cost,
  COUNT(*) as attempts
FROM outcome_vectors
WHERE created_at >= CURRENT_DATE
GROUP BY work_order_id, model_used
ORDER BY total_cost DESC
LIMIT 10;
```

**Resolution Options:**
1. **Pause non-critical work orders:** Temporarily stop low-priority tasks
2. **Force cheaper model:** Override to gpt-4o-mini for all requests
3. **Increase daily budget:** If justified (requires approval)
4. **Investigate cost anomaly:** Check for retry storms or infinite loops

**SLA:** 30 minutes (critical), 2 hours (warning)

---

**Type 3: Test Failures (Repeated)**

**Trigger:** Sentinel reports failures >3 cycles

**Investigation:**
```bash
# Check GitHub Actions logs
gh run list --workflow=ci.yml --limit 5

# Review test output
gh run view [run-id] --log
```

**Resolution Options:**
1. **Flaky test:** Mark as known flaky, adjust Sentinel thresholds
2. **Real failure:** Fix code (manual intervention or retry with context)
3. **Environment issue:** Check dependencies, API availability
4. **Contract violation:** Re-validate contracts, update integration points

**SLA:** 4 hours

---

**Type 4: Contract Violation**

**Trigger:** Breaking change detected by contract validator

**Investigation:**
```sql
-- Check contract details
SELECT * FROM contracts WHERE id = '[contract-id]';

-- Review validation errors
SELECT metadata->'contract_validation' as validation_errors
FROM outcome_vectors
WHERE work_order_id = '[work-order-id]';
```

**Resolution Options:**
1. **Revert changes:** Rollback work order, restore previous version
2. **Fix compatibility:** Update code to maintain backward compatibility
3. **Update contract:** If breaking change is intentional, version contract
4. **Coordinate with dependents:** Notify affected teams/services

**SLA:** 1 hour (high priority)

---

**Type 5: Aider Failure**

**Trigger:** Orchestrator unable to apply code changes

**Investigation:**
```bash
# Check Aider logs (if available)
# Look for file conflicts, permission errors, git issues

# Check Work Order metadata
SELECT metadata->'aider_output' as aider_logs
FROM work_orders
WHERE id = '[work-order-id]';
```

**Resolution Options:**
1. **Retry with clean state:** Reset repository, try again
2. **Manual application:** Apply code changes manually, skip Aider
3. **Fix file conflicts:** Resolve merge conflicts, retry
4. **Escalate to human:** Complex conflicts require manual resolution

**SLA:** 2 hours

---

### 3.2 Escalation Decision Framework

**When reviewing escalations:**

1. **Read full context:** Don't rely on summary alone
2. **Check AI confidence:** High confidence (>80%) = trust recommendation
3. **Review cost impact:** Factor in additional spend vs. abandoning work
4. **Consider timeline:** Is immediate fix needed or can it wait?
5. **Add notes:** Document your reasoning for future reference
6. **Execute decision:** Use one-click execution in Mission Control

**Escalation Log Template:**
```
Decision: [Selected option]
Reasoning: [Why this option was chosen]
Expected Outcome: [What should happen next]
Fallback Plan: [If this doesn't work, what's next?]
Follow-up: [Any monitoring or verification needed]
```

---

## 4. Troubleshooting Procedures

### 4.1 Slow API Response Times

**Symptoms:**
- Health Monitor shows P95 >500ms
- Users report slow dashboard loading
- Vercel logs show function timeouts

**Investigation:**
```sql
-- Check slow database queries (Supabase Dashboard → Logs → Slow Queries)
-- Look for queries >1000ms

-- Check indexes are being used
EXPLAIN ANALYZE SELECT * FROM work_orders WHERE status = 'pending';

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Resolution:**
```bash
# 1. Apply performance indexes (if not already applied)
# Run: scripts/create-performance-indexes.sql

# 2. Add caching for frequently-read data
# See: src/lib/cache.ts for implementation

# 3. Optimize queries (add WHERE clauses, use select specific columns)

# 4. Enable Supabase connection pooling
# Supabase Dashboard → Settings → Database → Connection Pooling → Transaction mode
```

---

### 4.2 Budget Tracking Incorrect

**Symptoms:**
- Budget usage doesn't match actual LLM costs
- Budget counter resets unexpectedly
- "Budget exceeded" errors when spend is low

**Investigation:**
```sql
-- Check cost_tracking table for anomalies
SELECT
  DATE(created_at) as date,
  service_name,
  SUM(cost) as daily_total,
  COUNT(*) as request_count
FROM cost_tracking
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at), service_name
ORDER BY date DESC, daily_total DESC;

-- Check for duplicate entries
SELECT cost, service_name, COUNT(*)
FROM cost_tracking
WHERE created_at >= CURRENT_DATE
GROUP BY cost, service_name
HAVING COUNT(*) > 10;
```

**Resolution:**
```sql
-- If duplicates found, clean up
DELETE FROM cost_tracking
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY cost, service_name, created_at ORDER BY id) as rn
    FROM cost_tracking
    WHERE created_at >= CURRENT_DATE
  ) t
  WHERE rn > 1
);

-- Verify budget calculation function is working
SELECT check_and_reserve_budget(1.0, 'test-service', '{"test": true}'::jsonb);
-- Expected: {canProceed: true, currentTotal: X, reservationId: Y}
```

---

### 4.3 Work Orders Stuck in "Pending"

**Symptoms:**
- Work Orders remain in "pending" status for >2 hours
- Orchestrator not polling
- No progress in logs

**Investigation:**
```sql
-- Check Orchestrator status
SELECT * FROM work_orders WHERE metadata->>'orchestrator_status' IS NOT NULL;

-- Check last polling time
SELECT MAX(updated_at) as last_poll
FROM work_orders
WHERE metadata->>'last_polled_at' IS NOT NULL;
```

**Resolution:**
```bash
# 1. Check if Orchestrator is running
curl https://your-app.vercel.app/api/orchestrator
# Expected: {"status": "running", "interval_ms": 10000}

# 2. Start Orchestrator if stopped
curl -X POST https://your-app.vercel.app/api/orchestrator \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "interval_ms": 10000}'

# 3. Check for errors in Vercel logs
# Vercel Dashboard → Deployments → View Function Logs
# Search for: "orchestrator" or "work-order-poller"

# 4. Manually trigger work order if urgent
# Mission Control → Work Orders → Select WO → "Execute Now" button
```

---

### 4.4 Escalations Not Appearing in Dashboard

**Symptoms:**
- Client Manager creates escalation but not visible in UI
- Escalations tab shows 0 but database has records

**Investigation:**
```sql
-- Check escalations table directly
SELECT id, work_order_id, trigger_type, status, created_at
FROM escalations
WHERE status = 'pending'
ORDER BY created_at DESC;

-- Check if API is returning data
-- Mission Control should query: /api/client-manager/escalations
```

**Resolution:**
```bash
# 1. Test API endpoint directly
curl https://your-app.vercel.app/api/escalations

# 2. Check browser console for errors
# Open Mission Control → F12 → Console tab

# 3. Verify Supabase RLS policies allow read access
# Supabase Dashboard → Authentication → Policies
# Ensure "escalations" table has SELECT policy for authenticated users

# 4. Clear cache and reload
# Mission Control → Hard refresh (Ctrl+Shift+R)
```

---

### 4.5 GitHub Webhook Not Triggering Sentinel

**Symptoms:**
- Pull requests created but Sentinel not receiving events
- GitHub webhook shows delivery failures

**Investigation:**
```bash
# Check GitHub webhook deliveries
# GitHub Repo → Settings → Webhooks → [Your webhook] → Recent Deliveries

# Look for:
# - 200 OK = success
# - 401 Unauthorized = wrong secret
# - 404 Not Found = wrong URL
# - 500 Server Error = application error
```

**Resolution:**
```bash
# 1. Verify webhook URL is correct
# Should be: https://your-app.vercel.app/api/sentinel

# 2. Verify webhook secret matches environment variable
# GitHub webhook secret = GITHUB_WEBHOOK_SECRET in Vercel

# 3. Test webhook manually
curl -X POST https://your-app.vercel.app/api/sentinel \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$(echo -n 'payload' | openssl sha256 -hmac 'your-secret')" \
  -d '{"action": "completed", "workflow_run": {"id": 12345}}'

# 4. Check Vercel logs for errors
# Search for: "sentinel" or "webhook"

# 5. Redeliver failed webhook from GitHub
# GitHub Repo → Settings → Webhooks → Recent Deliveries → Redeliver
```

---

## 5. Emergency Response Procedures

### 5.1 Emergency Kill Switch (Budget Overrun)

**Trigger:** Daily spend exceeds $100 (or configured emergency_kill threshold)

**Immediate Actions (5 minutes):**

```bash
# 1. Stop all LLM operations
UPDATE system_config SET value = '0' WHERE key = 'daily_budget_limit';

# 2. Pause Orchestrator
curl -X POST https://your-app.vercel.app/api/orchestrator \
  -H "Content-Type: application/json" \
  -d '{"action": "stop"}'

# 3. Mark all pending work orders as "paused"
UPDATE work_orders
SET status = 'paused',
    metadata = metadata || '{"emergency_pause": true, "paused_at": "' || NOW() || '"}'
WHERE status IN ('pending', 'approved');

# 4. Create escalation for human review
INSERT INTO escalations (work_order_id, trigger_type, context, status)
VALUES (NULL, 'budget_critical',
  '{"daily_total": ' || (SELECT SUM(cost) FROM cost_tracking WHERE created_at >= CURRENT_DATE) || ', "limit": 100}',
  'pending');
```

**Investigation (15 minutes):**
```sql
-- Identify cost spike cause
SELECT
  work_order_id,
  model_used,
  SUM(cost) as total_cost,
  COUNT(*) as attempts,
  MAX(created_at) as last_attempt
FROM outcome_vectors
WHERE created_at >= CURRENT_DATE
GROUP BY work_order_id, model_used
ORDER BY total_cost DESC;

-- Check for retry storms
SELECT
  work_order_id,
  COUNT(*) as retry_count,
  ARRAY_AGG(created_at ORDER BY created_at) as attempt_times
FROM outcome_vectors
WHERE created_at >= CURRENT_DATE
GROUP BY work_order_id
HAVING COUNT(*) > 10
ORDER BY retry_count DESC;
```

**Resolution:**
1. Fix root cause (infinite retry loop, expensive WO, etc.)
2. Increase budget if justified (requires management approval)
3. Reset daily budget limit to normal ($100)
4. Resume Orchestrator and unpause work orders
5. Document incident in escalations

---

### 5.2 Database Connection Loss

**Trigger:** Health Monitor shows "Database: disconnected"

**Immediate Actions (2 minutes):**

```bash
# 1. Check Supabase project status
# Dashboard: https://supabase.com/dashboard/project/[project-id]
# Look for: "Project status: Paused" or "Unhealthy"

# 2. Verify connection strings in Vercel
# Vercel → Settings → Environment Variables
# Check: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

# 3. Test connection manually
curl -X POST https://[project-id].supabase.co/rest/v1/rpc/ping \
  -H "apikey: [anon-key]" \
  -H "Content-Type: application/json"
```

**Resolution:**
- **If Supabase paused (Free tier):** Resume project in dashboard
- **If connection limit reached:** Enable connection pooling (Supabase → Settings → Database)
- **If API keys invalid:** Regenerate keys, update Vercel env vars, redeploy
- **If network issue:** Check Vercel region, Supabase region compatibility

**Estimated Downtime:** 5-15 minutes

---

### 5.3 Complete System Outage

**Trigger:** Application unreachable, all endpoints return 500 errors

**Immediate Actions (5 minutes):**

```bash
# 1. Check Vercel deployment status
# Vercel Dashboard → Deployments
# Look for: Failed builds, crashed functions

# 2. Check Vercel status page
# https://www.vercel-status.com/

# 3. Check recent changes
git log --oneline -5
# Identify: Last deployment before outage

# 4. Rollback to last known good deployment
vercel rollback [deployment-url]
# Or via Vercel Dashboard → Deployments → Promote to Production
```

**Communication:**
```
Subject: [INCIDENT] Moose Mission Control Outage

Status: Investigating / Identified / Monitoring / Resolved
Impact: All functionality unavailable
Started: [timestamp]
ETA: [estimated resolution time]

Updates:
- [timestamp] Outage detected, investigating
- [timestamp] Rollback initiated to deployment [id]
- [timestamp] Service restored, monitoring

Root Cause: [To be determined after resolution]
```

**Post-Incident:**
1. Document timeline in incident report
2. Identify root cause (code bug, config change, external service)
3. Implement preventive measures
4. Schedule postmortem meeting

---

### 5.4 Security Incident (Unauthorized Access)

**Trigger:** Suspicious activity detected (unusual API calls, unauthorized data access)

**Immediate Actions (10 minutes):**

```bash
# 1. Rotate all API keys
# - Anthropic API key
# - OpenAI API key
# - GitHub token
# - Supabase service role key

# 2. Revoke suspicious sessions
# Supabase Dashboard → Authentication → Users → Revoke session

# 3. Enable rate limiting (if not already)
# Verify: src/lib/rate-limiter.ts is active

# 4. Review access logs
# Supabase → Logs → API Logs
# Vercel → Deployments → Function Logs
# Filter by: IP address, unusual patterns

# 5. Reset webhook secrets
# GitHub → Repository Settings → Webhooks → Edit → Regenerate secret
# Update GITHUB_WEBHOOK_SECRET in Vercel
```

**Investigation:**
```sql
-- Check for unauthorized data access
SELECT * FROM auth.audit_log_entries
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Check for unusual cost patterns (potential API key theft)
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as request_count,
  SUM(cost) as total_cost
FROM cost_tracking
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY total_cost DESC;
```

**Escalation:**
- Notify security team
- Contact Anthropic/OpenAI support if API keys compromised
- File incident report with Supabase/Vercel if platform breach
- Consider temporary shutdown until secured

---

## 6. Routine Maintenance

### 6.1 Weekly Maintenance (30 minutes)

**Every Monday 9:00 AM:**

- [ ] Review last week's escalations (identify patterns)
- [ ] Check database growth (table sizes, index health)
- [ ] Verify backup success (Supabase dashboard)
- [ ] Export configuration backup: `npm run backup:config`
- [ ] Review cost trends (compare week-over-week)
- [ ] Update documentation (if procedures changed)

### 6.2 Monthly Maintenance (2 hours)

**First Monday of Each Month:**

- [ ] Review and update proposer configurations
- [ ] Analyze Manager routing decisions (accuracy, cost efficiency)
- [ ] Clean up old outcome_vectors (retain 90 days)
- [ ] Review security audit logs
- [ ] Test backup restoration procedure (staging environment)
- [ ] Update dependencies: `npm outdated`, `npm update`
- [ ] Review and adjust rate limits if needed
- [ ] Conduct mini-postmortem on incidents

```sql
-- Clean up old outcome_vectors (retention: 90 days)
DELETE FROM outcome_vectors
WHERE created_at < NOW() - INTERVAL '90 days';

-- Vacuum analyze to reclaim space
VACUUM ANALYZE outcome_vectors;
```

### 6.3 Quarterly Maintenance (1 day)

**Every 3 Months:**

- [ ] Full security audit (penetration testing, dependency scan)
- [ ] Performance review and optimization
- [ ] Disaster recovery drill (simulate outage, practice restoration)
- [ ] Review and update operational runbook
- [ ] Team training refresher (new features, procedures)
- [ ] Evaluate LLM model upgrades (new Claude/GPT versions)
- [ ] Review and optimize database schema

---

## 7. Contacts and Escalation Matrix

### 7.1 Internal Team

| Role | Name | Contact | Responsibility |
|------|------|---------|----------------|
| On-Call Engineer | [Name] | [Email/Phone] | First responder, 24/7 |
| Team Lead | [Name] | [Email/Phone] | Escalation decisions, budget approval |
| DevOps | [Name] | [Email/Phone] | Infrastructure, deployments |
| Security | [Name] | [Email/Phone] | Security incidents |

### 7.2 External Vendors

| Vendor | Support Channel | Use Case |
|--------|-----------------|----------|
| Vercel | support@vercel.com | Deployment issues, outages |
| Supabase | support@supabase.com | Database issues, backups |
| Anthropic | support@anthropic.com | API issues, billing |
| OpenAI | support@openai.com | API issues, billing |
| GitHub | support@github.com | Webhook issues, Actions |

### 7.3 Escalation Path

```
Level 1: On-Call Engineer (respond within 15 min)
   ↓ (if unresolved after 1 hour)
Level 2: Team Lead (respond within 30 min)
   ↓ (if critical incident)
Level 3: Engineering Manager (respond within 1 hour)
   ↓ (if major outage >4 hours)
Level 4: CTO (executive decision required)
```

---

## 8. Runbook Maintenance

**This runbook should be updated:**
- After any incident (document new procedures)
- Monthly during routine maintenance
- When new features are deployed
- When procedures change

**Last Updated:** 2025-10-03
**Next Review:** 2025-11-03
**Owner:** [Your Name/Team]

---

**Document Status:** Production Ready
