/**
 * Restore Configuration Script
 *
 * Restores system configuration from JSON backup
 *
 * Usage:
 *   npx tsx scripts/restore-config.ts --input backups/config-backup-2025-10-03.json
 *   npx tsx scripts/restore-config.ts --input backups/config-backup-2025-10-03.json --force
 *
 * Flags:
 *   --input <path>   Path to backup JSON file (required)
 *   --force          Skip confirmation prompt
 *   --dry-run        Show what would be restored without making changes
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role (admin access)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface ConfigBackup {
  timestamp: string;
  version: string;
  supabase_project: string;
  system_config: any[];
  proposer_configs: any[];
  contracts: any[];
  metadata: {
    exported_by: string;
    table_counts: {
      system_config: number;
      proposer_configs: number;
      contracts: number;
    };
  };
}

async function confirmRestore(backup: ConfigBackup, isDryRun: boolean): Promise<boolean> {
  console.log('\n⚠️  RESTORE CONFIGURATION');
  console.log('━'.repeat(50));
  console.log(`Backup timestamp: ${backup.timestamp}`);
  console.log(`Backup version:   ${backup.version}`);
  console.log(`Supabase project: ${backup.supabase_project}`);
  console.log('\nRecords to restore:');
  console.log(`  - system_config:    ${backup.metadata.table_counts.system_config}`);
  console.log(`  - proposer_configs: ${backup.metadata.table_counts.proposer_configs}`);
  console.log(`  - contracts:        ${backup.metadata.table_counts.contracts}`);
  console.log('━'.repeat(50));

  if (isDryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
    return true;
  }

  console.log('\n⚠️  WARNING: This will DELETE current configuration and replace with backup!');
  console.log('Current data will be lost. Make sure you have a recent backup.');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('\nType "RESTORE" to confirm: ', (answer) => {
      rl.close();
      resolve(answer.trim() === 'RESTORE');
    });
  });
}

async function restoreTable(
  tableName: string,
  records: any[],
  isDryRun: boolean
): Promise<void> {
  console.log(`\n🔄 Restoring ${tableName}...`);

  if (isDryRun) {
    console.log(`   [DRY RUN] Would restore ${records.length} records to ${tableName}`);
    if (records.length > 0) {
      console.log(`   [DRY RUN] Sample record keys: ${Object.keys(records[0]).join(', ')}`);
    }
    return;
  }

  // 1. Delete existing records
  console.log(`   🗑️  Deleting existing ${tableName} records...`);
  const { error: deleteError } = await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (deleteError) {
    throw new Error(`Failed to delete ${tableName}: ${deleteError.message}`);
  }

  if (records.length === 0) {
    console.log(`   ✅ No records to restore for ${tableName}`);
    return;
  }

  // 2. Insert backup records
  console.log(`   ⬆️  Inserting ${records.length} records...`);
  const { error: insertError } = await supabase.from(tableName).insert(records);

  if (insertError) {
    throw new Error(`Failed to insert ${tableName}: ${insertError.message}`);
  }

  console.log(`   ✅ Restored ${records.length} records to ${tableName}`);
}

async function restoreConfig(backup: ConfigBackup, isDryRun: boolean): Promise<void> {
  console.log('\n🚀 Starting restore process...\n');

  // Restore in order: system_config, proposer_configs, contracts
  await restoreTable('system_config', backup.system_config, isDryRun);
  await restoreTable('proposer_configs', backup.proposer_configs, isDryRun);
  await restoreTable('contracts', backup.contracts, isDryRun);

  if (!isDryRun) {
    console.log('\n✅ Configuration restore complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart Next.js server (clear cache)');
    console.log('   2. Verify config: curl http://localhost:3000/api/config');
    console.log('   3. Verify proposers: curl http://localhost:3000/api/proposers');
    console.log('   4. Run tests: npx vitest run');
  } else {
    console.log('\n✅ Dry run complete - no changes made');
  }
}

async function main() {
  try {
    // Parse command-line arguments
    const args = process.argv.slice(2);
    const inputFlagIndex = args.indexOf('--input');
    const forceFlag = args.includes('--force');
    const dryRunFlag = args.includes('--dry-run');

    if (inputFlagIndex < 0 || !args[inputFlagIndex + 1]) {
      console.error('❌ Missing required --input flag');
      console.error('\nUsage:');
      console.error('  npx tsx scripts/restore-config.ts --input backups/config-backup-2025-10-03.json');
      console.error('  npx tsx scripts/restore-config.ts --input backups/config-backup-2025-10-03.json --force');
      console.error('  npx tsx scripts/restore-config.ts --input backups/config-backup-2025-10-03.json --dry-run');
      process.exit(1);
    }

    const inputPath = path.join(process.cwd(), args[inputFlagIndex + 1]);

    // Check if backup file exists
    if (!fs.existsSync(inputPath)) {
      console.error(`❌ Backup file not found: ${inputPath}`);
      process.exit(1);
    }

    // Load backup file
    console.log(`📦 Loading backup: ${path.relative(process.cwd(), inputPath)}`);
    const backupContent = fs.readFileSync(inputPath, 'utf-8');
    const backup: ConfigBackup = JSON.parse(backupContent);

    // Validate backup structure
    if (!backup.timestamp || !backup.version || !backup.metadata) {
      console.error('❌ Invalid backup file format');
      process.exit(1);
    }

    console.log(`✅ Backup loaded successfully`);

    // Confirm restore (unless --force flag)
    if (!forceFlag) {
      const confirmed = await confirmRestore(backup, dryRunFlag);
      if (!confirmed) {
        console.log('\n❌ Restore cancelled by user');
        process.exit(0);
      }
    } else {
      console.log('\n⚠️  --force flag detected, skipping confirmation');
    }

    // Restore configuration
    await restoreConfig(backup, dryRunFlag);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Restore failed:', error);
    if (error instanceof Error) {
      console.error('Details:', error.message);
    }
    process.exit(1);
  }
}

main();
