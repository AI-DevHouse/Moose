# Deployment Procedures

**Last Updated:** 2025-10-03
**Status:** Production Ready
**Priority:** 5.4 - Ops Documentation

---

## Overview

This document provides step-by-step deployment procedures for Moose Mission Control, covering:
1. Initial deployment setup
2. Environment configuration
3. Database migration
4. Production deployment
5. Verification and rollback

---

## Prerequisites

### Required Accounts & Access
- [ ] Vercel account (deployment platform)
- [ ] Supabase account (database)
- [ ] GitHub account (repository access)
- [ ] Anthropic API key (Claude Sonnet 4.5)
- [ ] OpenAI API key (GPT-4o-mini)

### Required Tools
```bash
# Node.js 18+ and npm
node --version  # Should be 18.x or higher
npm --version

# Vercel CLI
npm install -g vercel

# Supabase CLI (optional, for local testing)
npm install -g supabase

# GitHub CLI (for Orchestrator)
gh --version
```

---

## 1. Initial Setup

### 1.1 Fork/Clone Repository

```bash
# Clone repository
git clone https://github.com/AI-DevHouse/Moose.git
cd Moose

# Install dependencies
npm install

# Verify build
npm run build
```

### 1.2 Supabase Project Setup

**Create New Project:**
1. Go to: https://supabase.com/dashboard
2. Click "New Project"
3. Configure:
   - **Name:** moose-mission-control-prod
   - **Database Password:** Generate strong password (save to password manager)
   - **Region:** Choose closest to your users
   - **Pricing Plan:** Pro ($25/month recommended for PITR backups)

**Note Project Details:**
```bash
# Save these values (needed for .env.local)
Project URL: https://[project-id].supabase.co
Project ID: [project-id]
API Key (anon): [anon-key]
API Key (service_role): [service-role-key]
```

### 1.3 Database Schema Migration

**Run Migrations:**

```sql
-- 1. Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/[project-id]/sql)

-- Copy and execute each migration script in order:
-- See: scripts/migrations/ directory for all migration files

-- Essential tables:
CREATE TABLE system_config (...);
CREATE TABLE work_orders (...);
CREATE TABLE proposer_configs (...);
CREATE TABLE outcome_vectors (...);
CREATE TABLE escalations (...);
CREATE TABLE cost_tracking (...);
CREATE TABLE contracts (...);
CREATE TABLE decision_logs (...);
CREATE TABLE github_events (...);
CREATE TABLE pattern_confidence_scores (...);
CREATE TABLE playbook_memory (...);
CREATE TABLE escalation_scripts (...);
```

**Apply Budget Reservation Function:**
```bash
# In Supabase SQL Editor, run:
# scripts/create-budget-reservation-function.sql
```

**Apply Performance Indexes:**
```bash
# In Supabase SQL Editor, run:
# scripts/create-performance-indexes.sql
```

**Generate Types (for verification):**
```bash
npx supabase gen types typescript --project-id [your-project-id] > src/types/supabase.ts
```

### 1.4 Environment Configuration

**Create `.env.local`:**
```bash
# Copy template
cp .env.example .env.local

# Edit with production values
# DO NOT commit this file - it's in .gitignore
```

**Required Environment Variables:**
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]

# LLM API Keys
ANTHROPIC_API_KEY=sk-ant-[your-key]
OPENAI_API_KEY=sk-[your-key]

# GitHub Configuration (for Orchestrator)
GITHUB_TOKEN=ghp_[your-token]
GITHUB_WEBHOOK_SECRET=[generate-random-string]

# Aider Configuration (for Orchestrator)
AIDER_CLI_PATH=/usr/local/bin/aider  # or path to aider

# Application Configuration
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Generate Secure Secrets:**
```bash
# GitHub webhook secret (use strong random string)
openssl rand -hex 32

# Or use: https://www.random.org/strings/
```

---

## 2. Vercel Deployment

### 2.1 Connect Repository to Vercel

**Via Vercel Dashboard:**
1. Go to: https://vercel.com/dashboard
2. Click "Add New Project"
3. Import Git Repository: `AI-DevHouse/Moose`
4. Configure Project:
   - **Framework Preset:** Next.js
   - **Root Directory:** `./` (or specify if different)
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`

### 2.2 Configure Environment Variables

**In Vercel Project Settings → Environment Variables:**

Add all variables from `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` ⚠️ (mark as "Secret")
- `ANTHROPIC_API_KEY` ⚠️ (mark as "Secret")
- `OPENAI_API_KEY` ⚠️ (mark as "Secret")
- `GITHUB_TOKEN` ⚠️ (mark as "Secret")
- `GITHUB_WEBHOOK_SECRET` ⚠️ (mark as "Secret")
- `NODE_ENV` = `production`
- `NEXT_PUBLIC_APP_URL` = your Vercel deployment URL

**Environment Scopes:**
- ✅ Production
- ✅ Preview (optional, use test/staging Supabase project)
- ✅ Development (optional, use local .env.local)

### 2.3 Deploy

**Automatic Deployment (Recommended):**
```bash
# Push to main branch triggers automatic deployment
git push origin main

# Monitor deployment at: https://vercel.com/dashboard
```

**Manual Deployment (CLI):**
```bash
# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### 2.4 Verify Deployment

**Health Check:**
```bash
# Replace with your Vercel URL
curl https://your-app.vercel.app/api/admin/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-10-03T12:00:00Z",
  "checks": {
    "database": "connected",
    "stuckWorkOrders": 0,
    "openEscalations": 0,
    "budgetUsed": 0
  }
}
```

**Smoke Tests:**
```bash
# Test critical endpoints
curl https://your-app.vercel.app/api/proposers
curl https://your-app.vercel.app/api/budget-status

# Expected: 200 OK responses
```

---

## 3. Initial Configuration

### 3.1 Seed System Configuration

**Insert system_config:**
```sql
-- In Supabase SQL Editor
INSERT INTO system_config (key, value, description) VALUES
  ('daily_budget_limit', '100', 'Daily LLM spending limit in USD'),
  ('soft_cap', '20', 'Warning threshold in USD'),
  ('hard_cap', '50', 'Force cheapest model threshold in USD'),
  ('emergency_kill', '100', 'Stop all operations threshold in USD'),
  ('rate_limit_architect', '4', 'Requests per minute for Architect API'),
  ('rate_limit_proposer', '50', 'Requests per minute for Proposer API')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

### 3.2 Seed Proposer Configurations

**Insert proposer_configs:**
```sql
-- Claude Sonnet 4.5
INSERT INTO proposer_configs (name, model, provider, complexity_threshold, cost_profile, active) VALUES (
  'claude-sonnet-4-5',
  'claude-sonnet-4-5-20250929',
  'anthropic',
  1.0,
  '{"input_cost_per_token": 0.000003, "output_cost_per_token": 0.000015, "currency": "USD"}',
  true
);

-- GPT-4o-mini
INSERT INTO proposer_configs (name, model, provider, complexity_threshold, cost_profile, active) VALUES (
  'gpt-4o-mini',
  'gpt-4o-mini',
  'openai',
  0.3,
  '{"input_cost_per_token": 0.00000015, "output_cost_per_token": 0.0000006, "currency": "USD"}',
  true
);
```

### 3.3 Verify Configuration

```bash
# Test Architect endpoint
curl -X POST https://your-app.vercel.app/api/architect/decompose \
  -H "Content-Type: application/json" \
  -d '{
    "feature_name": "Test Feature",
    "objectives": ["Test objective"],
    "constraints": ["Test constraint"],
    "acceptance_criteria": ["Test criteria"]
  }'

# Expected: JSON response with work_orders array
```

---

## 4. GitHub Configuration (for Orchestrator)

### 4.1 Configure Repository Webhooks

**In GitHub Repository Settings:**
1. Go to: Settings → Webhooks → Add webhook
2. Configure:
   - **Payload URL:** `https://your-app.vercel.app/api/sentinel`
   - **Content type:** `application/json`
   - **Secret:** Use `GITHUB_WEBHOOK_SECRET` from env vars
   - **Events:** Select "Workflow runs" and "Pull requests"
   - **Active:** ✅

### 4.2 GitHub Actions Setup

**Verify Actions are enabled:**
1. Go to: Repository → Actions tab
2. Enable workflows if prompted
3. Verify `.github/workflows/` directory exists with CI workflows

### 4.3 Test Orchestrator Prerequisites

```bash
# SSH into Vercel deployment or test locally
# Verify Aider CLI is accessible
aider --version
# Expected: aider version 0.86.1 or higher

# Verify GitHub CLI authentication
gh auth status
# Expected: Logged in as [your-username]
```

---

## 5. Monitoring Setup

### 5.1 Enable Vercel Analytics

**In Vercel Project Settings:**
1. Navigate to: Analytics
2. Enable Web Analytics (free)
3. Enable Speed Insights (free)

### 5.2 Configure Supabase Monitoring

**Enable Database Monitoring:**
1. Supabase Dashboard → Settings → Database
2. Enable: Slow Query Logs (threshold: 1000ms)
3. Enable: Connection Pooling (mode: Transaction)

### 5.3 Application Health Monitoring

**Mission Control Dashboard:**
- Navigate to: `https://your-app.vercel.app`
- Login with Supabase credentials
- Go to "Health Monitor" tab
- Verify metrics display correctly

**Create Alert Webhooks (Optional):**
```sql
-- Create notification function for stuck work orders
-- See: docs/operational-runbook.md for alerting setup
```

---

## 6. Production Readiness Checklist

### Pre-Launch Verification

**Infrastructure:**
- [ ] Vercel deployment successful
- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] System config seeded
- [ ] Proposer configs seeded

**Security:**
- [ ] Rate limiting enabled
- [ ] Input sanitization active
- [ ] GitHub webhook secret configured
- [ ] API keys marked as "Secret" in Vercel
- [ ] Supabase RLS policies enabled

**Monitoring:**
- [ ] Health endpoint responding
- [ ] Vercel Analytics enabled
- [ ] Supabase slow query logs enabled
- [ ] Mission Control dashboard accessible

**Testing:**
- [ ] Smoke tests passing
- [ ] Architect API tested
- [ ] Proposer API tested
- [ ] Budget tracking working
- [ ] Escalation flow tested

**Documentation:**
- [ ] Team trained on Mission Control UI
- [ ] Escalation response procedures documented
- [ ] Backup procedures tested
- [ ] Rollback procedures documented

---

## 7. Rollback Procedures

### 7.1 Vercel Rollback (Application)

**Via Vercel Dashboard:**
1. Go to: Deployments tab
2. Find previous stable deployment
3. Click "..." menu → Promote to Production
4. Confirm promotion

**Via CLI:**
```bash
# List deployments
vercel ls

# Rollback to specific deployment
vercel rollback [deployment-url]
```

**Estimated Time:** 2-5 minutes

### 7.2 Database Rollback (Supabase)

**Point-in-Time Recovery (PITR):**
1. Supabase Dashboard → Settings → Database → Backups
2. Click "Restore from PITR"
3. Select timestamp (up to 7-30 days)
4. Confirm restoration
5. **WARNING:** This creates NEW database, update connection strings

**Estimated Time:** 10-30 minutes

**Manual Backup Restore:**
```bash
# If you have manual SQL backup
# 1. Download backup from docs/backups/ or Supabase dashboard
# 2. Create new Supabase project
# 3. Run backup SQL file in SQL Editor
# 4. Update environment variables in Vercel
# 5. Redeploy application
```

**Estimated Time:** 15-45 minutes

### 7.3 Configuration Rollback

**Using Backup Scripts:**
```bash
# Export current config (backup before change)
npm run backup:config

# Restore from backup
npm run restore:config --input backups/config-backup-2025-10-03.json

# Verify restoration
curl https://your-app.vercel.app/api/proposers
```

**Estimated Time:** 5 minutes

---

## 8. Post-Deployment Tasks

### 8.1 Enable Production Monitoring

**Daily Health Checks:**
```bash
# Create cron job to monitor health endpoint
# See: docs/operational-runbook.md for alerting setup
```

### 8.2 Schedule Backups

**Supabase:**
- Automatic daily backups enabled by default
- Verify PITR is active (Pro plan)

**Configuration Backups:**
```bash
# Weekly config export (add to cron)
0 2 * * 0 cd /path/to/moose && npm run backup:config
```

### 8.3 Team Onboarding

**Train Team Members:**
1. Mission Control UI navigation
2. Escalation response procedures
3. Monitoring dashboard interpretation
4. Emergency contact procedures

**Documentation:**
- Share: `docs/operational-runbook.md`
- Share: `docs/backup-procedures.md`
- Share: `docs/security-procedures.md`

---

## 9. Troubleshooting Common Deployment Issues

### Issue: Build Fails on Vercel

**Symptoms:**
```
Error: Module not found
Error: TypeScript compilation failed
```

**Solution:**
```bash
# 1. Verify build works locally
npm run build

# 2. Check Node.js version matches Vercel (18.x)
# In vercel.json:
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "framework": "nextjs",
  "installCommand": "npm install"
}

# 3. Clear Vercel cache and redeploy
# Vercel Dashboard → Deployments → Redeploy (clear cache)
```

### Issue: Database Connection Failed

**Symptoms:**
```
Error: Connection timeout
Error: Invalid API key
```

**Solution:**
```bash
# 1. Verify environment variables in Vercel
# Check: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

# 2. Test connection from Vercel logs
# Look for Supabase connection errors

# 3. Check Supabase project status
# Dashboard → Project status should be "Healthy"

# 4. Verify database is not paused (Free tier pauses after inactivity)
```

### Issue: API Keys Not Working

**Symptoms:**
```
Error: Invalid API key (Anthropic/OpenAI)
Error: 401 Unauthorized
```

**Solution:**
```bash
# 1. Verify keys are set in Vercel environment variables
# Check for extra spaces or newlines

# 2. Regenerate keys if needed
# Anthropic Console: https://console.anthropic.com/
# OpenAI Console: https://platform.openai.com/api-keys

# 3. Ensure keys are marked as "Secret" in Vercel
# 4. Redeploy after updating keys
```

### Issue: Rate Limiting Too Aggressive

**Symptoms:**
```
Error: 429 Too Many Requests
```

**Solution:**
```bash
# Adjust rate limits in system_config table
UPDATE system_config SET value = '10' WHERE key = 'rate_limit_architect';

# Or update in code: src/lib/rate-limiter.ts
# Redeploy after changes
```

---

## 10. Success Criteria

**Deployment is successful when:**
- ✅ Application accessible at production URL
- ✅ Health endpoint returns "healthy" status
- ✅ All smoke tests pass (200 OK responses)
- ✅ Database connection verified
- ✅ LLM API keys working (test Architect API)
- ✅ Monitoring dashboard displays metrics
- ✅ GitHub webhook configured (test with dummy PR)
- ✅ Team trained on escalation procedures
- ✅ Backup procedures tested
- ✅ Rollback tested (in staging environment)

---

## 11. Contact & Support

**Internal Escalation:**
- Primary: [Your Team Lead]
- Secondary: [DevOps/Platform Team]

**External Support:**
- Vercel Support: https://vercel.com/support
- Supabase Support: https://supabase.com/support
- GitHub Support: https://support.github.com/

**Emergency Procedures:**
See: `docs/operational-runbook.md` Section 4 - Emergency Response

---

**Document Status:** Production Ready
**Last Reviewed:** 2025-10-03
**Next Review:** 2025-11-03 (monthly)
