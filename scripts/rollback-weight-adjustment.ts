/**
 * Rollback Weight Adjustment Script
 *
 * Rolls back a complexity weight adjustment to the previous version.
 *
 * Usage:
 *   npx tsx scripts/rollback-weight-adjustment.ts [--history-id <UUID>] [--latest]
 */

import 'dotenv/config';
import { ComplexityWeightAdjuster } from '@/lib/learning/complexity-weight-adjuster';
import { createClient } from '@supabase/supabase-js';

interface CliOptions {
  historyId?: string;
  latest: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    latest: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--history-id':
        options.historyId = args[++i];
        break;
      case '--latest':
        options.latest = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
      default:
        console.error(`Unknown option: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Rollback Weight Adjustment

Rolls back a complexity weight adjustment to the previous version.

Usage:
  npx tsx scripts/rollback-weight-adjustment.ts [options]

Options:
  --history-id <UUID>    ID of the adjustment to rollback
  --latest               Rollback the most recent adjustment
  --help                 Show this help message

Examples:
  # Rollback the latest adjustment
  npx tsx scripts/rollback-weight-adjustment.ts --latest

  # Rollback a specific adjustment
  npx tsx scripts/rollback-weight-adjustment.ts --history-id abc-123-def

  # List recent adjustments first
  npx tsx scripts/list-weight-history.ts
  `);
}

async function getLatestAdjustmentId(): Promise<string | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('complexity_weight_history')
    .select('id, applied_at, adjustment_reason')
    .order('applied_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  console.log('Latest adjustment:');
  console.log(`   ID: ${data.id}`);
  console.log(`   Applied at: ${data.applied_at}`);
  console.log(`   Reason: ${data.adjustment_reason}`);
  console.log('');

  return data.id;
}

async function rollbackAdjustment(options: CliOptions) {
  let historyId = options.historyId;

  if (options.latest && !historyId) {
    console.log('🔍 Finding latest adjustment...');
    historyId = await getLatestAdjustmentId();
    if (!historyId) {
      console.error('❌ No adjustments found to rollback');
      process.exit(1);
    }
  }

  if (!historyId) {
    console.error('❌ Must specify either --history-id or --latest');
    printHelp();
    process.exit(1);
  }

  console.log(`🔄 Rolling back adjustment ${historyId}...`);
  console.log('');

  const adjuster = new ComplexityWeightAdjuster();
  await adjuster.rollbackWeightAdjustment(historyId);

  console.log('');
  console.log('✅ Rollback complete');
  console.log('   Weights have been restored to previous version');
  console.log('');
  console.log('⚠️  NOTE: Restart the application to use restored weights');
  console.log('   Or wait for next orchestrator execution (weights loaded dynamically)');
}

async function main() {
  const options = parseArgs();

  try {
    await rollbackAdjustment(options);
    process.exit(0);
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

main();
