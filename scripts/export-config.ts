/**
 * Export Configuration Backup Script
 *
 * Exports critical system configuration to JSON for backup/restore
 *
 * Usage:
 *   npx tsx scripts/export-config.ts
 *   npx tsx scripts/export-config.ts --output backups/custom-name.json
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

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

async function exportConfig(): Promise<ConfigBackup> {
  console.log('🔄 Exporting configuration...\n');

  // 1. Export system_config
  console.log('📋 Exporting system_config...');
  const { data: systemConfig, error: systemError } = await supabase
    .from('system_config')
    .select('*')
    .order('created_at', { ascending: true });

  if (systemError) {
    throw new Error(`Failed to export system_config: ${systemError.message}`);
  }
  console.log(`✅ Exported ${systemConfig?.length || 0} system_config records`);

  // 2. Export proposer_configs
  console.log('📋 Exporting proposer_configs...');
  const { data: proposerConfigs, error: proposerError } = await supabase
    .from('proposer_configs')
    .select('*')
    .order('created_at', { ascending: true });

  if (proposerError) {
    throw new Error(`Failed to export proposer_configs: ${proposerError.message}`);
  }
  console.log(`✅ Exported ${proposerConfigs?.length || 0} proposer_configs records`);

  // 3. Export contracts
  console.log('📋 Exporting contracts...');
  const { data: contracts, error: contractsError } = await supabase
    .from('contracts')
    .select('*')
    .order('created_at', { ascending: true });

  if (contractsError) {
    throw new Error(`Failed to export contracts: ${contractsError.message}`);
  }
  console.log(`✅ Exported ${contracts?.length || 0} contracts records`);

  // Build backup object
  const backup: ConfigBackup = {
    timestamp: new Date().toISOString(),
    version: 'v41', // Update this when schema changes
    supabase_project: 'qclxdnbvoruvqnhsshjr',
    system_config: systemConfig || [],
    proposer_configs: proposerConfigs || [],
    contracts: contracts || [],
    metadata: {
      exported_by: 'export-config.ts',
      table_counts: {
        system_config: systemConfig?.length || 0,
        proposer_configs: proposerConfigs?.length || 0,
        contracts: contracts?.length || 0,
      },
    },
  };

  return backup;
}

async function main() {
  try {
    // Parse command-line arguments
    const args = process.argv.slice(2);
    const outputFlagIndex = args.indexOf('--output');
    const customOutput = outputFlagIndex >= 0 ? args[outputFlagIndex + 1] : null;

    // Export configuration
    const backup = await exportConfig();

    // Prepare output path
    const backupsDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
      console.log(`\n📁 Created backups directory: ${backupsDir}`);
    }

    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const defaultFilename = `config-backup-${timestamp}.json`;
    const outputPath = customOutput
      ? path.join(process.cwd(), customOutput)
      : path.join(backupsDir, defaultFilename);

    // Write backup file
    fs.writeFileSync(outputPath, JSON.stringify(backup, null, 2), 'utf-8');

    console.log('\n✅ Configuration backup complete!');
    console.log(`📦 Output: ${outputPath}`);
    console.log(`📊 Total records: ${backup.metadata.table_counts.system_config + backup.metadata.table_counts.proposer_configs + backup.metadata.table_counts.contracts}`);
    console.log(`⏰ Timestamp: ${backup.timestamp}`);

    // Show file size
    const stats = fs.statSync(outputPath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    console.log(`💾 File size: ${fileSizeKB} KB`);

    console.log('\n📝 To restore this backup:');
    console.log(`   npx tsx scripts/restore-config.ts --input ${path.relative(process.cwd(), outputPath)}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Export failed:', error);
    if (error instanceof Error) {
      console.error('Details:', error.message);
    }
    process.exit(1);
  }
}

main();
