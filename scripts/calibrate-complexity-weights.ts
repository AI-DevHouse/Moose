/**
 * Calibrate Complexity Weights Script
 *
 * Analyzes learning samples and adjusts complexity scoring weights
 * to improve routing accuracy.
 *
 * Usage:
 *   npx tsx scripts/calibrate-complexity-weights.ts [--min-samples 50] [--lookback-days 7] [--auto-apply]
 *
 * Schedule via cron:
 *   0 2 * * 0 cd /path/to/project && npx tsx scripts/calibrate-complexity-weights.ts --auto-apply
 */

import 'dotenv/config';
import { ComplexityWeightAdjuster } from '@/lib/learning/complexity-weight-adjuster';

interface CliOptions {
  minSamples: number;
  lookbackDays: number;
  autoApply: boolean;
  dryRun: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    minSamples: 50,
    lookbackDays: 7,
    autoApply: false,
    dryRun: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--min-samples':
        options.minSamples = parseInt(args[++i], 10);
        break;
      case '--lookback-days':
        options.lookbackDays = parseInt(args[++i], 10);
        break;
      case '--auto-apply':
        options.autoApply = true;
        break;
      case '--dry-run':
        options.dryRun = true;
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
Calibrate Complexity Weights

Analyzes learning samples and adjusts complexity scoring weights to improve
routing accuracy.

Usage:
  npx tsx scripts/calibrate-complexity-weights.ts [options]

Options:
  --min-samples <N>      Minimum samples required (default: 50)
  --lookback-days <N>    Days to look back (default: 7)
  --auto-apply           Automatically apply small adjustments (< 0.1 magnitude)
  --dry-run              Analyze and propose but don't apply
  --help                 Show this help message

Examples:
  # Analyze and propose adjustments
  npx tsx scripts/calibrate-complexity-weights.ts

  # Auto-apply small adjustments (for cron)
  npx tsx scripts/calibrate-complexity-weights.ts --auto-apply

  # Analyze last 14 days with 100 samples minimum
  npx tsx scripts/calibrate-complexity-weights.ts --min-samples 100 --lookback-days 14

Schedule via cron (every Sunday at 2 AM):
  0 2 * * 0 cd /path/to/project && npx tsx scripts/calibrate-complexity-weights.ts --auto-apply
  `);
}

async function calibrateWeights(options: CliOptions) {
  console.log('🔬 Analyzing complexity scoring performance...');
  console.log(`   Min samples: ${options.minSamples}`);
  console.log(`   Lookback days: ${options.lookbackDays}`);
  console.log(`   Auto-apply: ${options.autoApply ? 'Yes' : 'No'}`);
  console.log(`   Dry run: ${options.dryRun ? 'Yes' : 'No'}`);
  console.log('');

  const adjuster = new ComplexityWeightAdjuster();

  const proposal = await adjuster.analyzeAndPropose(
    options.minSamples,
    options.lookbackDays
  );

  if (!proposal) {
    console.log('✅ No adjustments needed');
    console.log('   Either routing accuracy is already good (≥85%)');
    console.log('   or not enough samples collected yet');
    return;
  }

  console.log('\n📊 Proposed Weight Adjustments:');
  console.log('');
  console.log('Old weights:');
  Object.entries(proposal.old_weights).forEach(([key, value]) => {
    console.log(`   ${key.padEnd(25)}: ${value.toFixed(3)}`);
  });
  console.log('');
  console.log('New weights:');
  Object.entries(proposal.new_weights).forEach(([key, value]) => {
    const oldValue = proposal.old_weights[key as keyof typeof proposal.old_weights];
    const change = value - oldValue;
    const changeStr = change >= 0 ? `+${change.toFixed(3)}` : change.toFixed(3);
    console.log(`   ${key.padEnd(25)}: ${value.toFixed(3)} (${changeStr})`);
  });
  console.log('');
  console.log(`Magnitude: ${proposal.adjustment_magnitude.toFixed(3)}`);
  console.log('');
  console.log('Rationale:');
  console.log(`   ${proposal.rationale}`);
  console.log('');
  console.log('Expected improvement:');
  console.log(`   ${proposal.expected_improvement}`);
  console.log('');

  if (options.dryRun) {
    console.log('🔍 Dry run mode - not applying adjustments');
    return;
  }

  // Auto-apply if adjustment is small (< 0.1 magnitude)
  if (options.autoApply && proposal.adjustment_magnitude < 0.1) {
    console.log('✅ Auto-applying (small adjustment)');
    await adjuster.applyAdjustments(proposal);
    console.log('');
    console.log('⚠️  NOTE: Restart the application to use new weights');
    console.log('   Or wait for next orchestrator execution (weights loaded dynamically)');
  } else if (proposal.adjustment_magnitude >= 0.1) {
    console.log('⚠️  Large adjustment detected (magnitude ≥ 0.1)');
    console.log('   Review carefully before applying');
    console.log('');
    console.log('To apply manually:');
    console.log('   1. Review the proposal above');
    console.log('   2. Run: npx tsx scripts/apply-weight-adjustment.ts --approve');
    console.log('   3. Or use the admin API: POST /api/admin/apply-weight-adjustment');
  } else {
    console.log('ℹ️  To apply these adjustments:');
    console.log('   Run again with --auto-apply flag');
    console.log('   Or use the admin API: POST /api/admin/apply-weight-adjustment');
  }
}

async function main() {
  const options = parseArgs();

  try {
    await calibrateWeights(options);
    process.exit(0);
  } catch (error) {
    console.error('❌ Calibration failed:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

main();
