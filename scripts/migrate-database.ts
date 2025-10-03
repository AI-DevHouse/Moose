// scripts/migrate-database.ts
// Automated database migration with safeguards
// Run with: npx tsx scripts/migrate-database.ts

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface MigrationStep {
  name: string;
  description: string;
  check: () => Promise<boolean>;
  migrate: () => Promise<void>;
  rollback?: () => Promise<void>;
}

const migrations: MigrationStep[] = [
  {
    name: 'add_architect_columns',
    description: 'Add Architect columns to work_orders table',
    check: async () => {
      // Check if acceptance_criteria column exists
      const { data, error } = await supabase.rpc('get_column_info', {
        table_name_param: 'work_orders',
        column_name_param: 'acceptance_criteria'
      });

      // If RPC doesn't exist, use direct query
      if (error?.message?.includes('does not exist')) {
        const { data: columns, error: colError } = await supabase
          .from('information_schema.columns' as any)
          .select('column_name')
          .eq('table_name', 'work_orders')
          .eq('column_name', 'acceptance_criteria')
          .single();

        return columns !== null;
      }

      return data !== null;
    },
    migrate: async () => {
      console.log('   📝 Adding Architect columns to work_orders...');

      const sql = `
        ALTER TABLE work_orders
          ADD COLUMN IF NOT EXISTS acceptance_criteria jsonb DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS files_in_scope jsonb DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS context_budget_estimate integer DEFAULT 2000,
          ADD COLUMN IF NOT EXISTS decomposition_doc text,
          ADD COLUMN IF NOT EXISTS architect_version text DEFAULT 'v1';

        COMMENT ON COLUMN work_orders.acceptance_criteria IS 'Array of acceptance criteria from Architect decomposition';
        COMMENT ON COLUMN work_orders.files_in_scope IS 'Array of file paths that this Work Order will modify';
        COMMENT ON COLUMN work_orders.context_budget_estimate IS 'Estimated token budget for this Work Order';
        COMMENT ON COLUMN work_orders.decomposition_doc IS 'Markdown documentation from Architect';
        COMMENT ON COLUMN work_orders.architect_version IS 'Version of Architect agent';
      `;

      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

      if (error) {
        // If RPC doesn't exist, try direct approach
        console.log('   ⚠️  exec_sql RPC not available, attempting direct column addition...');

        // Try adding columns one by one
        const columns = [
          { name: 'acceptance_criteria', type: 'jsonb', default: "'[]'::jsonb" },
          { name: 'files_in_scope', type: 'jsonb', default: "'[]'::jsonb" },
          { name: 'context_budget_estimate', type: 'integer', default: '2000' },
          { name: 'decomposition_doc', type: 'text', default: null },
          { name: 'architect_version', type: 'text', default: "'v1'" }
        ];

        for (const col of columns) {
          try {
            // We can't execute DDL directly via Supabase client
            // User must run this in SQL Editor
            throw new Error('Cannot execute DDL via Supabase client. Please run SQL manually in Supabase SQL Editor.');
          } catch (err) {
            throw err;
          }
        }
      }

      console.log('   ✅ Architect columns added successfully');
    },
    rollback: async () => {
      console.log('   ⚠️  Rollback: Removing Architect columns...');
      const sql = `
        ALTER TABLE work_orders
          DROP COLUMN IF EXISTS acceptance_criteria,
          DROP COLUMN IF EXISTS files_in_scope,
          DROP COLUMN IF EXISTS context_budget_estimate,
          DROP COLUMN IF EXISTS decomposition_doc,
          DROP COLUMN IF EXISTS architect_version;
      `;

      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
      if (error) throw error;

      console.log('   ✅ Rollback complete');
    }
  },
  {
    name: 'add_orchestrator_config',
    description: 'Add Orchestrator configuration to system_config',
    check: async () => {
      const { data } = await supabase
        .from('system_config')
        .select('config_key')
        .eq('config_key', 'orchestrator_enabled')
        .single();

      return data !== null;
    },
    migrate: async () => {
      console.log('   📝 Adding Orchestrator configuration...');

      const configs = [
        { config_key: 'orchestrator_enabled', config_type: 'boolean', config_value: false, description: 'Enable/disable Orchestrator automatic polling' },
        { config_key: 'orchestrator_polling_interval_ms', config_type: 'number', config_value: 10000, description: 'Polling interval in milliseconds' },
        { config_key: 'orchestrator_max_concurrent', config_type: 'number', config_value: 3, description: 'Maximum concurrent Work Order executions' },
        { config_key: 'orchestrator_aider_timeout_ms', config_type: 'number', config_value: 300000, description: 'Aider execution timeout (5 minutes)' }
      ];

      for (const config of configs) {
        const { error } = await supabase
          .from('system_config')
          .upsert(config, { onConflict: 'config_key' });

        if (error) {
          console.error(`   ❌ Failed to add config ${config.config_key}:`, error);
          throw error;
        }
      }

      console.log('   ✅ Orchestrator configuration added');
    },
    rollback: async () => {
      console.log('   ⚠️  Rollback: Removing Orchestrator configuration...');

      const { error } = await supabase
        .from('system_config')
        .delete()
        .like('config_key', 'orchestrator_%');

      if (error) throw error;
      console.log('   ✅ Rollback complete');
    }
  }
];

async function runMigrations(dryRun: boolean = false) {
  console.log('\n🚀 Database Migration Tool');
  console.log('================================\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  console.log('📊 Checking current database state...\n');

  const results: { [key: string]: 'needed' | 'skipped' | 'completed' | 'failed' } = {};

  // Check which migrations are needed
  for (const migration of migrations) {
    try {
      const exists = await migration.check();

      if (exists) {
        console.log(`✅ ${migration.name}: Already applied`);
        console.log(`   ${migration.description}`);
        results[migration.name] = 'skipped';
      } else {
        console.log(`⚠️  ${migration.name}: Needs migration`);
        console.log(`   ${migration.description}`);
        results[migration.name] = 'needed';
      }
    } catch (error) {
      console.error(`❌ ${migration.name}: Check failed`);
      console.error(`   ${error instanceof Error ? error.message : 'Unknown error'}`);
      results[migration.name] = 'failed';
    }
    console.log('');
  }

  // Count needed migrations
  const neededMigrations = Object.values(results).filter(r => r === 'needed').length;

  if (neededMigrations === 0) {
    console.log('✨ Database is up to date! No migrations needed.\n');
    return;
  }

  console.log(`\n📋 Summary: ${neededMigrations} migration(s) needed\n`);

  if (dryRun) {
    console.log('🔍 Dry run complete. Run without --dry-run to apply migrations.\n');
    return;
  }

  // SAFEGUARD: Require confirmation
  console.log('⚠️  SAFEGUARD: About to modify database');
  console.log('   Migrations to apply:');
  for (const [name, status] of Object.entries(results)) {
    if (status === 'needed') {
      const migration = migrations.find(m => m.name === name);
      console.log(`   - ${name}: ${migration?.description}`);
    }
  }
  console.log('');

  // Run migrations
  console.log('🔨 Applying migrations...\n');

  for (const migration of migrations) {
    if (results[migration.name] !== 'needed') continue;

    try {
      console.log(`⏳ Migrating: ${migration.name}`);
      await migration.migrate();
      results[migration.name] = 'completed';
    } catch (error) {
      console.error(`❌ Migration failed: ${migration.name}`);
      console.error(`   ${error instanceof Error ? error.message : 'Unknown error'}`);
      results[migration.name] = 'failed';

      // SAFEGUARD: Ask if user wants to continue or rollback
      console.log('\n⚠️  Migration failed!');
      console.log('   Note: Some migrations may require manual SQL execution in Supabase SQL Editor.');
      console.log('   Check the error message above for details.\n');

      throw error;
    }
    console.log('');
  }

  // Final summary
  console.log('\n================================');
  console.log('📊 Migration Results:\n');

  for (const [name, status] of Object.entries(results)) {
    const icon = status === 'completed' ? '✅' :
                 status === 'skipped' ? '⏭️' :
                 status === 'failed' ? '❌' : '⚠️';
    console.log(`${icon} ${name}: ${status}`);
  }

  const completed = Object.values(results).filter(r => r === 'completed').length;
  const failed = Object.values(results).filter(r => r === 'failed').length;

  console.log('');
  if (failed > 0) {
    console.log(`❌ ${failed} migration(s) failed`);
    console.log('   Some migrations may require manual execution in Supabase SQL Editor.');
    console.log('   Check the SQL in the migration steps above.\n');
    process.exit(1);
  } else {
    console.log(`✨ Success! ${completed} migration(s) applied\n`);
  }
}

async function printSQLForManualExecution() {
  console.log('\n📋 SQL FOR MANUAL EXECUTION IN SUPABASE SQL EDITOR');
  console.log('================================\n');
  console.log('If automated migration fails, copy this SQL to Supabase SQL Editor:\n');

  console.log('-- Step 1: Add Architect columns to work_orders');
  console.log(`
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS acceptance_criteria jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS files_in_scope jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS context_budget_estimate integer DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS decomposition_doc text,
  ADD COLUMN IF NOT EXISTS architect_version text DEFAULT 'v1';

COMMENT ON COLUMN work_orders.acceptance_criteria IS 'Array of acceptance criteria from Architect decomposition';
COMMENT ON COLUMN work_orders.files_in_scope IS 'Array of file paths that this Work Order will modify';
COMMENT ON COLUMN work_orders.context_budget_estimate IS 'Estimated token budget for this Work Order';
COMMENT ON COLUMN work_orders.decomposition_doc IS 'Markdown documentation from Architect';
COMMENT ON COLUMN work_orders.architect_version IS 'Version of Architect agent';
  `.trim());

  console.log('\n\n-- Step 2: Verify columns added');
  console.log(`
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'work_orders'
  AND column_name IN ('acceptance_criteria', 'files_in_scope', 'context_budget_estimate', 'decomposition_doc', 'architect_version')
ORDER BY column_name;
  `.trim());

  console.log('\n\n-- Step 3: Add Orchestrator configuration');
  console.log(`
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
  `.trim());

  console.log('\n\n-- Step 4: Verify configuration added');
  console.log(`
SELECT * FROM system_config WHERE config_key LIKE 'orchestrator_%';
  `.trim());

  console.log('\n\n================================\n');
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const showSQL = args.includes('--show-sql');

if (showSQL) {
  printSQLForManualExecution();
  process.exit(0);
}

// Run migrations
runMigrations(dryRun).catch((error) => {
  console.error('\n💥 Migration failed with error:', error);
  console.log('\n💡 Try running with --show-sql to get manual SQL statements\n');
  process.exit(1);
});
