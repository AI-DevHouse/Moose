/**
 * List Weight History Script
 *
 * Lists the history of complexity weight adjustments.
 *
 * Usage:
 *   npx tsx scripts/list-weight-history.ts [--limit 10]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

interface CliOptions {
  limit: number;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    limit: 10
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--limit':
        options.limit = parseInt(args[++i], 10);
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
List Weight History

Lists the history of complexity weight adjustments.

Usage:
  npx tsx scripts/list-weight-history.ts [options]

Options:
  --limit <N>    Number of records to show (default: 10)
  --help         Show this help message

Examples:
  # Show last 10 adjustments
  npx tsx scripts/list-weight-history.ts

  # Show last 20 adjustments
  npx tsx scripts/list-weight-history.ts --limit 20
  `);
}

async function listWeightHistory(options: CliOptions) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log(`📊 Complexity Weight Adjustment History (last ${options.limit})\n`);

  const { data, error } = await supabase
    .from('complexity_weight_history')
    .select('*')
    .order('applied_at', { ascending: false })
    .limit(options.limit);

  if (error) {
    console.error('❌ Failed to fetch history:', error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('No weight adjustments found');
    return;
  }

  data.forEach((record, index) => {
    console.log(`${'='.repeat(80)}`);
    console.log(`Adjustment #${index + 1}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`ID:              ${record.id}`);
    console.log(`Applied at:      ${new Date(record.applied_at).toLocaleString()}`);
    console.log(`Reason:          ${record.adjustment_reason}`);
    console.log(`Triggered by:    ${record.triggered_by || 'N/A'}`);
    console.log(`Approved by:     ${record.approved_by || 'N/A'}`);
    console.log('');

    if (record.weights) {
      console.log('Weights:');
      Object.entries(record.weights).forEach(([key, value]) => {
        console.log(`   ${key.padEnd(25)}: ${(value as number).toFixed(3)}`);
      });
      console.log('');
    }

    if (record.expected_improvement) {
      console.log(`Expected:        ${record.expected_improvement}`);
    }

    if (record.actual_improvement !== null && record.actual_improvement !== undefined) {
      console.log(`Actual:          ${(record.actual_improvement * 100).toFixed(1)}% improvement`);
    }

    if (record.performance_before) {
      console.log('');
      console.log('Performance Before:');
      const perf = record.performance_before as any;
      if (perf.routing_accuracy !== undefined) {
        console.log(`   Routing accuracy:  ${(perf.routing_accuracy * 100).toFixed(1)}%`);
      }
      if (perf.avg_cost !== undefined) {
        console.log(`   Avg cost:          $${perf.avg_cost.toFixed(4)}`);
      }
      if (perf.success_rate !== undefined) {
        console.log(`   Success rate:      ${(perf.success_rate * 100).toFixed(1)}%`);
      }
      if (perf.sample_count !== undefined) {
        console.log(`   Sample count:      ${perf.sample_count}`);
      }
    }

    if (record.performance_after) {
      console.log('');
      console.log('Performance After:');
      const perf = record.performance_after as any;
      if (perf.routing_accuracy !== undefined) {
        console.log(`   Routing accuracy:  ${(perf.routing_accuracy * 100).toFixed(1)}%`);
      }
      if (perf.avg_cost !== undefined) {
        console.log(`   Avg cost:          $${perf.avg_cost.toFixed(4)}`);
      }
      if (perf.success_rate !== undefined) {
        console.log(`   Success rate:      ${(perf.success_rate * 100).toFixed(1)}%`);
      }
      if (perf.sample_count !== undefined) {
        console.log(`   Sample count:      ${perf.sample_count}`);
      }
    }

    console.log('');
  });

  console.log(`${'='.repeat(80)}`);
  console.log(`Total adjustments: ${data.length}`);
  console.log('');
  console.log('To rollback an adjustment:');
  console.log('  npx tsx scripts/rollback-weight-adjustment.ts --history-id <ID>');
}

async function main() {
  const options = parseArgs();

  try {
    await listWeightHistory(options);
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to list history:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

main();
