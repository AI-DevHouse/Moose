// scripts/post-migration.ts
// Run AFTER manually executing ALTER TABLE in Supabase SQL Editor
// Handles: system_config inserts + type regeneration

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifyColumns() {
  console.log('\n🔍 Verifying work_orders columns...\n');

  // Try to query a work order with new columns
  const { data, error } = await supabase
    .from('work_orders')
    .select('id, acceptance_criteria, files_in_scope, context_budget_estimate, architect_version')
    .limit(1);

  if (error) {
    console.error('❌ Column verification failed:', error.message);
    console.log('\n⚠️  The Architect columns have not been added yet.');
    console.log('   Please run the ALTER TABLE SQL in Supabase SQL Editor first.\n');
    return false;
  }

  console.log('✅ Architect columns verified successfully\n');
  return true;
}

async function addOrchestratorConfig() {
  console.log('📝 Adding Orchestrator configuration to system_config...\n');

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
      console.error(`❌ Failed to add ${config.config_key}:`, error.message);
      return false;
    }
    console.log(`   ✅ ${config.config_key}`);
  }

  console.log('\n✅ Orchestrator configuration added\n');
  return true;
}

async function regenerateTypes() {
  console.log('🔧 Regenerating Supabase TypeScript types...\n');

  const projectId = SUPABASE_URL!.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

  if (!projectId) {
    console.error('❌ Could not extract project ID from SUPABASE_URL');
    return false;
  }

  try {
    // Check if supabase CLI is installed
    try {
      execSync('npx supabase --version', { stdio: 'pipe' });
    } catch {
      console.log('   📦 Installing Supabase CLI...');
      execSync('npm install --save-dev supabase', { stdio: 'inherit' });
    }

    console.log(`   🔄 Generating types for project: ${projectId}\n`);

    const command = `npx supabase gen types typescript --project-id ${projectId} --schema public > src/types/supabase.ts`;

    execSync(command, {
      stdio: 'inherit',
      env: {
        ...process.env,
        SUPABASE_ACCESS_TOKEN: SUPABASE_SERVICE_KEY // May need actual access token
      }
    });

    console.log('\n✅ Types regenerated successfully\n');
    return true;
  } catch (error) {
    console.error('❌ Type generation failed:', error instanceof Error ? error.message : 'Unknown error');
    console.log('\n⚠️  You may need to regenerate types manually:');
    console.log(`   npx supabase gen types typescript --project-id ${projectId} > src/types/supabase.ts\n`);
    return false;
  }
}

async function main() {
  console.log('\n🚀 Post-Migration Automation');
  console.log('================================\n');

  // Step 1: Verify columns exist
  const columnsExist = await verifyColumns();

  if (!columnsExist) {
    console.log('❌ Migration incomplete. Please run the ALTER TABLE SQL first.\n');
    console.log('   Run: npx tsx scripts/migrate-database.ts --show-sql\n');
    process.exit(1);
  }

  // Step 2: Add Orchestrator config
  const configAdded = await addOrchestratorConfig();

  if (!configAdded) {
    console.log('❌ Failed to add Orchestrator configuration\n');
    process.exit(1);
  }

  // Step 3: Regenerate types
  const typesRegenerated = await regenerateTypes();

  // Final summary
  console.log('================================');
  console.log('📊 Post-Migration Summary\n');
  console.log(`${columnsExist ? '✅' : '❌'} Architect columns verified`);
  console.log(`${configAdded ? '✅' : '❌'} Orchestrator config added`);
  console.log(`${typesRegenerated ? '✅' : '⚠️ '} TypeScript types ${typesRegenerated ? 'regenerated' : 'needs manual regeneration'}`);
  console.log('');

  if (columnsExist && configAdded) {
    console.log('✨ Post-migration complete! Database is ready for Orchestrator.\n');
  } else {
    console.log('❌ Post-migration incomplete. Check errors above.\n');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n💥 Post-migration failed:', error);
  process.exit(1);
});
