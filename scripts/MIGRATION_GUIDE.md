# Database Migration Guide

**Purpose:** Add Architect columns to `work_orders` table and Orchestrator configuration for Phase 2.3/3.2 implementation.

---

## Prerequisites

- Access to Supabase Dashboard (https://supabase.com/dashboard/project/qclxdnbvoruvqnhsshjr)
- `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`

---

## Migration Process (3 Steps)

### Step 1: Check Current State (Dry Run)

```bash
npx tsx scripts/migrate-database.ts --dry-run
```

**Expected Output:**
```
⚠️  add_architect_columns: Needs migration
⚠️  add_orchestrator_config: Needs migration

📋 Summary: 2 migration(s) needed
```

If you see `✅ Already applied` for both, skip to Step 3 (Verify).

---

### Step 2: Run Manual SQL in Supabase

**Why manual?** Supabase client cannot execute DDL (`ALTER TABLE`) commands. Must use SQL Editor.

#### 2.1 Generate SQL

```bash
npx tsx scripts/migrate-database.ts --show-sql
```

This outputs the SQL you need to copy.

#### 2.2 Execute in Supabase

1. Open Supabase Dashboard: https://supabase.com/dashboard/project/qclxdnbvoruvqnhsshjr
2. Go to **SQL Editor** (left sidebar)
3. Click **New query**
4. Copy the SQL from Step 1 output
5. Click **Run** (or press F5)

**Expected SQL:**

```sql
-- Add Architect columns
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS acceptance_criteria jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS files_in_scope jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS context_budget_estimate integer DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS decomposition_doc text,
  ADD COLUMN IF NOT EXISTS architect_version text DEFAULT 'v1';

-- Verify columns added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'work_orders'
  AND column_name IN ('acceptance_criteria', 'files_in_scope', 'context_budget_estimate', 'decomposition_doc', 'architect_version')
ORDER BY column_name;

-- Add Orchestrator config
INSERT INTO system_config (config_key, config_type, config_value, description)
VALUES
  ('orchestrator_enabled', 'boolean', 'false'::jsonb, 'Enable/disable Orchestrator automatic polling'),
  ('orchestrator_polling_interval_ms', 'number', '10000'::jsonb, 'Polling interval in milliseconds'),
  ('orchestrator_max_concurrent', 'number', '3'::jsonb, 'Maximum concurrent Work Order executions'),
  ('orchestrator_aider_timeout_ms', 'number', '300000'::jsonb, 'Aider execution timeout (5 minutes)')
ON CONFLICT (config_key) DO UPDATE
  SET config_value = EXCLUDED.config_value,
      config_type = EXCLUDED.config_type,
      description = EXCLUDED.description,
      updated_at = NOW();

-- Verify config added
SELECT * FROM system_config WHERE config_key LIKE 'orchestrator_%';
```

#### 2.3 Verify SQL Execution

After running the SQL, you should see:
- **5 rows** returned from the column verification query
- **4 rows** returned from the config verification query

---

### Step 3: Post-Migration Automation

This handles system_config inserts and TypeScript type regeneration:

```bash
npx tsx scripts/post-migration.ts
```

**What it does:**
1. ✅ Verifies Architect columns exist
2. ✅ Adds/updates Orchestrator configuration in `system_config`
3. ✅ Regenerates TypeScript types (`src/types/supabase.ts`)

**Expected Output:**
```
✅ Architect columns verified successfully
✅ Orchestrator configuration added
✅ Types regenerated successfully

✨ Post-migration complete! Database is ready for Orchestrator.
```

---

## Verification Checklist

After migration, verify:

### ✅ Database Schema

```sql
-- Run in Supabase SQL Editor
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'work_orders'
  AND column_name IN ('acceptance_criteria', 'files_in_scope', 'context_budget_estimate', 'decomposition_doc', 'architect_version')
ORDER BY column_name;
```

**Expected:** 5 rows returned

### ✅ System Config

```sql
SELECT * FROM system_config WHERE config_key LIKE 'orchestrator_%';
```

**Expected:** 4 rows returned
- `orchestrator_enabled`
- `orchestrator_polling_interval_ms`
- `orchestrator_max_concurrent`
- `orchestrator_aider_timeout_ms`

### ✅ TypeScript Types

Check `src/types/supabase.ts` contains:

```typescript
work_orders: {
  Row: {
    // ... existing fields
    acceptance_criteria: Json | null
    files_in_scope: Json | null
    context_budget_estimate: number | null
    decomposition_doc: string | null
    architect_version: string | null
  }
}
```

### ✅ Code Compilation

```bash
npx tsc --noEmit
```

**Expected:** No new errors related to `work_orders` or `acceptance_criteria`

---

## Troubleshooting

### Problem: "Column already exists"

**Solution:** This is OK. The SQL uses `ADD COLUMN IF NOT EXISTS`, so it's safe to run multiple times.

### Problem: "Type generation failed"

**Solution:** Regenerate types manually:

```bash
# Option A: Using Supabase CLI
npx supabase gen types typescript --project-id qclxdnbvoruvqnhsshjr > src/types/supabase.ts

# Option B: Using Supabase Dashboard
# 1. Go to Settings → API
# 2. Scroll to "Generate Types"
# 3. Copy generated TypeScript
# 4. Paste into src/types/supabase.ts
```

### Problem: "Cannot connect to Supabase"

**Solution:** Verify environment variables:

```bash
# Check .env.local
cat .env.local | grep SUPABASE

# Should see:
# NEXT_PUBLIC_SUPABASE_URL=https://qclxdnbvoruvqnhsshjr.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Problem: Post-migration says "columns don't exist"

**Solution:** You skipped Step 2. Run the ALTER TABLE SQL in Supabase SQL Editor first.

---

## Rollback (if needed)

**WARNING:** This will delete Architect data from existing Work Orders.

```sql
-- Remove Architect columns
ALTER TABLE work_orders
  DROP COLUMN IF EXISTS acceptance_criteria,
  DROP COLUMN IF EXISTS files_in_scope,
  DROP COLUMN IF EXISTS context_budget_estimate,
  DROP COLUMN IF EXISTS decomposition_doc,
  DROP COLUMN IF EXISTS architect_version;

-- Remove Orchestrator config
DELETE FROM system_config WHERE config_key LIKE 'orchestrator_%';
```

Then regenerate types:

```bash
npx tsx scripts/post-migration.ts
```

---

## Next Steps

After successful migration:

1. ✅ Run integration tests: `.\phase1-2-integration-test.ps1`
2. ✅ Verify 18/18 tests passing
3. ✅ Proceed with Orchestrator implementation (Phase 2.3/3.2)

---

**Questions?** Check `docs/session-state.md` or `docs/architecture-decisions.md`
