#!/usr/bin/env tsx

/**
 * Approve A/B Test Work Orders
 *
 * Approves the same 3 work orders tested with gpt-4o-mini
 * for A/B comparison with Claude.
 */

import { createSupabaseServiceClient } from '../src/lib/supabase';

async function approveABTestWOs() {
  const supabase = createSupabaseServiceClient();

  // Titles from the v110 tests
  const titles = [
    'Build Clipboard-WebView Coordination Layer',  // High complexity (0.98) - PR #236: 44/100
    'Configure Redux Toolkit Store Foundation with TypeScript',  // Mid complexity (0.55) - PR #237: 58/100
    'Validation and Testing Suite'  // Low complexity (0.41) - PR #238: 78/100
  ];

  console.log('🔧 Approving A/B Test Work Orders for Claude Run\n');
  console.log('================================================================================');
  console.log('Work Orders to Approve:');
  console.log('  - Clipboard-WebView Coordination (High 0.98) - Baseline: 44/100');
  console.log('  - Redux Toolkit Store (Mid 0.55) - Baseline: 58/100');
  console.log('  - Validation Suite (Low 0.41) - Baseline: 78/100');
  console.log('================================================================================\n');

  try {
    // Fetch all work orders to find the matching ones
    const { data: allWOs, error: fetchError } = await supabase
      .from('work_orders')
      .select('id, title, description, complexity_score, status')
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;

    if (!allWOs || allWOs.length === 0) {
      console.log('❌ No work orders found');
      return;
    }

    // Find matching work orders by title
    const matchingWOs = allWOs.filter(wo =>
      titles.some(title => wo.title?.includes(title) || title.includes(wo.title || ''))
    );

    if (matchingWOs.length === 0) {
      console.log('❌ No matching work orders found');
      console.log('\nSearching for titles:');
      titles.forEach(t => console.log(`  - ${t}`));
      console.log('\nAvailable work orders (first 10):');
      allWOs.slice(0, 10).forEach(wo => {
        console.log(`  - ${wo.title} (${wo.complexity_score})`);
      });
      return;
    }

    console.log(`📊 Found ${matchingWOs.length} matching work orders\n`);

    // Display work order details
    for (const wo of matchingWOs) {
      console.log(`  WO-${wo.id.slice(0, 8)}`);
      console.log(`    Title: ${wo.title}`);
      console.log(`    Complexity: ${wo.complexity_score}`);
      console.log(`    Current Status: ${wo.status}`);
      console.log();
    }

    // Approve each work order
    console.log('🔄 Setting status to approved...\n');

    for (const wo of matchingWOs) {
      const { error: updateError } = await supabase
        .from('work_orders')
        .update({
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', wo.id);

      if (updateError) {
        console.error(`  ❌ Failed to approve WO-${wo.id.slice(0, 8)}:`, updateError.message);
      } else {
        console.log(`  ✅ Approved WO-${wo.id.slice(0, 8)} - ${wo.title}`);
      }
    }

    // Verify final status
    console.log('\n📊 Verifying final status...\n');

    const woIds = matchingWOs.map(wo => wo.id);
    const { data: verifyWOs, error: verifyError } = await supabase
      .from('work_orders')
      .select('id, title, status, complexity_score')
      .in('id', woIds);

    if (verifyError) throw verifyError;

    console.log('Final Work Order Status:');
    verifyWOs
      ?.sort((a, b) => (b.complexity_score || 0) - (a.complexity_score || 0))
      .forEach(wo => {
        const statusIcon = wo.status === 'approved' ? '✅' : '⚠️';
        const complexityLabel =
          (wo.complexity_score || 0) > 0.7 ? 'HIGH' :
          (wo.complexity_score || 0) > 0.5 ? 'MID' : 'LOW';
        console.log(`  ${statusIcon} WO-${wo.id.slice(0, 8)}: ${wo.status} (${complexityLabel} ${wo.complexity_score})`);
        console.log(`      ${wo.title}`);
      });

    const approvedCount = verifyWOs?.filter(wo => wo.status === 'approved').length || 0;

    console.log('\n================================================================================');
    console.log('✅ Approval Complete\n');
    console.log(`Approved: ${approvedCount}/${matchingWOs.length} work orders`);

    if (approvedCount < matchingWOs.length) {
      console.log('\n⚠️  WARNING: Not all work orders were approved');
      console.log('   Some work orders may not be processed');
    } else {
      console.log('\n✅ SUCCESS: All work orders approved and ready for orchestrator');
      console.log('\nNext steps:');
      console.log('  1. Start orchestrator: npm run orchestrator:daemon');
      console.log('  2. Monitor execution with: powershell.exe -File scripts/run-with-env.ps1 scripts/check-execution-results.ts');
      console.log('  3. Compare Claude results to gpt-4o-mini baseline in evidence/v111/');
    }
    console.log('================================================================================');

  } catch (error) {
    console.error('\n❌ Error approving work orders:', error);
    throw error;
  }
}

approveABTestWOs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
