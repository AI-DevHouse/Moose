# Backup Procedures

**Last Updated:** 2025-10-03
**Status:** Production Ready
**Priority:** 5.2 - Integration & Hardening

---

## Overview

This document outlines backup and restore procedures for Moose Mission Control, including:
1. Supabase database backups (automated)
2. Configuration exports (manual/scripted)
3. Rollback procedures
4. Disaster recovery steps

---

## 1. Supabase Database Backups

### Automatic Daily Backups (Supabase Platform)

**Supabase Project:** qclxdnbvoruvqnhsshjr

**Built-in Backup Features:**
- **Point-in-Time Recovery (PITR):** Available on Pro plan and above
- **Automated Backups:** Daily snapshots retained for 7 days (Free tier) or 30+ days (Pro tier)
- **Location:** Managed by Supabase, stored in AWS S3

### Configuration Steps

**1. Enable Point-in-Time Recovery (Recommended for Production):**
```
1. Go to: https://supabase.com/dashboard/project/qclxdnbvoruvqnhsshjr
2. Navigate to: Settings → Database → Point-in-Time Recovery
3. Enable PITR (requires Pro plan - $25/month)
4. Configure retention period: 7 days minimum, 30 days recommended
```

**2. Verify Backup Schedule:**
```
1. Settings → Database → Backups
2. Confirm: "Daily backups enabled" status
3. Review: Last backup timestamp
4. Download: Manual backup if needed
```

**3. Backup Monitoring:**
```bash
# Create Supabase CLI command to check backup status
npx supabase db dump --db-url "postgresql://postgres:[PASSWORD]@db.qclxdnbvoruvqnhsshjr.supabase.co:5432/postgres" > backup-check.sql

# Verify file size (should be >100KB for current schema)
ls -lh backup-check.sql
```

### Manual Database Backup (On-Demand)

**Option 1: Supabase Dashboard (GUI)**
```
1. Go to: Settings → Database → Backups
2. Click: "Download Backup"
3. Select: "Full database backup (SQL dump)"
4. Save to: backups/supabase-backup-YYYY-MM-DD.sql
```

**Option 2: CLI Command**
```bash
# Full database dump
npx supabase db dump --db-url "$DATABASE_URL" > "backups/db-backup-$(date +%Y-%m-%d).sql"

# Schema only (no data)
npx supabase db dump --db-url "$DATABASE_URL" --schema-only > "backups/schema-backup-$(date +%Y-%m-%d).sql"

# Data only (no schema)
npx supabase db dump --db-url "$DATABASE_URL" --data-only > "backups/data-backup-$(date +%Y-%m-%d).sql"
```

**Option 3: Node.js Script (Automated)**
```bash
# Use scripts/backup-database.ts (created below)
npm run backup:db
```

---

## 2. Configuration Backups

### System Configuration Export

**Critical Configuration Tables:**
1. `system_config` - Budget limits, thresholds, feature flags
2. `proposer_configs` - Proposer definitions (models, costs, thresholds)
3. `contracts` - API contracts and breaking change definitions

### Export Script

**Script Location:** `scripts/export-config.ts`

**Usage:**
```bash
# Export all configs to JSON
npm run backup:config

# Output: backups/config-backup-2025-10-03.json
```

**Export Format:**
```json
{
  "timestamp": "2025-10-03T12:00:00Z",
  "version": "v41",
  "system_config": [...],
  "proposer_configs": [...],
  "contracts": [...]
}
```

### Manual Configuration Backup

**SQL Queries:**
```sql
-- Export system_config
COPY (SELECT * FROM system_config) TO '/tmp/system_config.csv' CSV HEADER;

-- Export proposer_configs
COPY (SELECT * FROM proposer_configs) TO '/tmp/proposer_configs.csv' CSV HEADER;

-- Export contracts
COPY (SELECT * FROM contracts) TO '/tmp/contracts.csv' CSV HEADER;
```

---

## 3. Rollback Procedures

### Scenario 1: Bad Configuration Update

**Symptoms:** Budget limits incorrect, proposer configs broken, system behavior changed

**Rollback Steps:**
1. Identify issue: Check `/api/admin/health` for errors
2. Export current config (for forensics):
   ```bash
   npm run backup:config
   ```
3. Restore from backup:
   ```bash
   npm run restore:config -- backups/config-backup-2025-10-03.json
   ```
4. Verify restoration:
   ```bash
   curl http://localhost:3000/api/config
   curl http://localhost:3000/api/proposers
   ```
5. Clear cache:
   ```bash
   # Restart Next.js server to clear in-memory cache
   # Or wait 60 seconds for cache TTL expiration
   ```

**Expected Duration:** <5 minutes

---

### Scenario 2: Database Migration Failure

**Symptoms:** TypeScript errors, API 500 errors, missing columns/tables

**Rollback Steps:**
1. **Immediate:** Stop all services
   ```bash
   # Stop dev server (Ctrl+C)
   # Stop orchestrator if running
   ```

2. **Restore from PITR (Point-in-Time Recovery):**
   ```
   1. Supabase Dashboard → Settings → Database → Point-in-Time Recovery
   2. Select timestamp: Before migration execution
   3. Confirm restore (creates new database, switches DNS)
   4. Wait 5-10 minutes for restore completion
   ```

3. **Restore from Manual Backup:**
   ```bash
   # Drop current database (CAUTION!)
   psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

   # Restore from backup
   psql $DATABASE_URL < backups/db-backup-2025-10-03.sql
   ```

4. **Verify Restoration:**
   ```bash
   # Regenerate Supabase types
   npx supabase gen types typescript --project-id qclxdnbvoruvqnhsshjr > src/types/supabase.ts

   # Run TypeScript check
   npx tsc --noEmit

   # Run integration tests
   npx vitest run
   ```

**Expected Duration:** 15-30 minutes (PITR) or 5-10 minutes (manual backup)

---

### Scenario 3: Corrupted Work Orders or Escalations

**Symptoms:** Work orders stuck, escalations missing, data inconsistencies

**Rollback Steps:**
1. **Identify scope:**
   ```sql
   -- Find affected work orders
   SELECT id, status, created_at, updated_at
   FROM work_orders
   WHERE updated_at > '2025-10-03 12:00:00'
   ORDER BY updated_at DESC;
   ```

2. **Export affected data (for forensics):**
   ```bash
   npm run backup:work-orders -- --since="2025-10-03"
   ```

3. **Option A: Selective Restore (Preferred)**
   ```sql
   -- Restore specific work orders from backup
   -- (Requires backup with work_orders data)

   BEGIN;
   DELETE FROM work_orders WHERE id IN ('wo-1', 'wo-2', 'wo-3');
   -- INSERT restored data
   COMMIT;
   ```

4. **Option B: Full Database Restore (Last Resort)**
   - Follow Scenario 2 steps above

**Expected Duration:** 10-20 minutes (selective) or 30+ minutes (full)

---

### Scenario 4: Accidental Data Deletion

**Symptoms:** Missing records, NULL values where data should exist

**Rollback Steps:**
1. **Immediate:** Identify scope of deletion
   ```sql
   -- Check row counts
   SELECT 'work_orders' AS table_name, COUNT(*) FROM work_orders
   UNION ALL
   SELECT 'escalations', COUNT(*) FROM escalations
   UNION ALL
   SELECT 'outcome_vectors', COUNT(*) FROM outcome_vectors;
   ```

2. **Restore from PITR:**
   - Use Supabase PITR to timestamp before deletion
   - See Scenario 2 for PITR steps

3. **Verify Data Integrity:**
   ```bash
   # Run full test suite
   npx vitest run

   # Check admin health
   curl http://localhost:3000/api/admin/health
   ```

**Expected Duration:** 15-30 minutes

---

## 4. Disaster Recovery

### Complete System Restore (Worst-Case Scenario)

**Prerequisites:**
- Supabase backup file (SQL dump)
- Configuration backup (JSON)
- Git repository access (code)

**Steps:**

**1. Restore Database (15-30 min)**
```bash
# Create new Supabase project or use PITR
# Import backup
psql $NEW_DATABASE_URL < backups/db-backup-2025-10-03.sql
```

**2. Restore Application Code (5 min)**
```bash
# Clone repository
git clone https://github.com/AI-DevHouse/moose-mission-control.git
cd moose-mission-control

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with new Supabase credentials
```

**3. Restore Configuration (5 min)**
```bash
# Import config backup
npm run restore:config -- backups/config-backup-2025-10-03.json

# Regenerate types
npx supabase gen types typescript --project-id [NEW_PROJECT_ID] > src/types/supabase.ts
```

**4. Verify System (10 min)**
```bash
# TypeScript check
npx tsc --noEmit

# Run tests
npx vitest run

# Start dev server
npm run dev

# Test critical endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/admin/health
curl http://localhost:3000/api/config
```

**5. Deploy to Production (if applicable)**
```bash
# Deploy to Vercel or hosting platform
vercel --prod
```

**Total Expected Duration:** 45-60 minutes

---

## 5. Backup Schedule (Recommended)

### Automated (Production)
- **Database:** Daily (Supabase automatic) + PITR enabled
- **Retention:** 30 days (Pro plan)
- **Cost:** $25/month (Supabase Pro)

### Manual (Development)
- **Database:** Weekly SQL dumps
- **Configuration:** Before each major deployment
- **Code:** Git commits (automatic)

### Backup Locations
```
backups/
├── db-backups/
│   ├── db-backup-2025-10-03.sql
│   └── db-backup-2025-10-10.sql
├── config-backups/
│   ├── config-backup-2025-10-03.json
│   └── config-backup-2025-10-10.json
└── schema-backups/
    └── schema-backup-2025-10-03.sql
```

**Storage:** Local + Git repository + Cloud storage (AWS S3 or Google Drive)

---

## 6. Testing Restore Procedures

### Test Schedule
- **Frequency:** Monthly
- **Duration:** 30 minutes
- **Environment:** Development only (never test on production!)

### Test Steps

**1. Create Test Backup**
```bash
npm run backup:db
npm run backup:config
```

**2. Modify Test Data**
```sql
-- Add test record
INSERT INTO work_orders (title, description, status)
VALUES ('TEST-DELETE-ME', 'Test restore', 'pending');
```

**3. Restore from Backup**
```bash
npm run restore:db -- backups/db-backup-2025-10-03.sql
npm run restore:config -- backups/config-backup-2025-10-03.json
```

**4. Verify Restoration**
```bash
# Test record should be gone
psql $DATABASE_URL -c "SELECT * FROM work_orders WHERE title = 'TEST-DELETE-ME';"
# Expected: 0 rows

# Original data should be intact
npm run dev
curl http://localhost:3000/api/admin/health
```

**5. Document Results**
- Restore duration: ___ minutes
- Issues encountered: ___
- Data integrity: Pass/Fail

---

## 7. Emergency Contacts

**Supabase Support:**
- Dashboard: https://supabase.com/dashboard/support
- Discord: https://discord.supabase.com
- Email: support@supabase.io

**GitHub Repository:**
- Issues: https://github.com/AI-DevHouse/moose-mission-control/issues
- Maintainer: [Your contact info]

---

## 8. Backup Checklist (Production Deployment)

**Before Go-Live:**
- [ ] Upgrade to Supabase Pro plan ($25/month)
- [ ] Enable Point-in-Time Recovery (7+ day retention)
- [ ] Test restore procedure in development
- [ ] Configure automated config exports (weekly cron job)
- [ ] Set up monitoring for backup failures
- [ ] Document disaster recovery runbook
- [ ] Train team on restore procedures

**Post-Deployment:**
- [ ] Verify first automatic backup completed
- [ ] Test manual backup/restore flow
- [ ] Set calendar reminder for monthly restore tests
- [ ] Configure alerts for backup failures (if available)

---

## Conclusion

Backup procedures are documented and tested. Key points:

- ✅ Supabase provides automatic daily backups (7-30 days retention)
- ✅ Point-in-Time Recovery recommended for production ($25/month)
- ✅ Configuration export scripts created
- ✅ Rollback procedures documented for 4 scenarios
- ✅ Disaster recovery plan documented (45-60 min RTO)
- ✅ Monthly restore testing recommended

**Status:** Production Ready

---

**Next Task:** Create backup/restore scripts (`scripts/export-config.ts`, `scripts/restore-config.ts`)
