#!/usr/bin/env tsx

/**
 * Force Claude Proposer - Disable gpt-4o-mini, Enable Claude
 *
 * Updates proposer_configs table to force all work orders to use Claude
 * by disabling gpt-4o-mini and ensuring Claude is active.
 */

import { createSupabaseServiceClient } from '../src/lib/supabase';

async function forceClaudeProposer() {
  const supabase = createSupabaseServiceClient();

  console.log('🔧 Forcing Claude as the only active proposer...\n');

  try {
    // Step 1: Get current proposer states
    console.log('📊 Step 1: Checking current proposer states\n');
    const { data: proposers, error: fetchError } = await supabase
      .from('proposer_configs')
      .select('id, name, model, provider, active')
      .order('name');

    if (fetchError) throw fetchError;

    if (!proposers || proposers.length === 0) {
      console.log('❌ No proposers found in database');
      return;
    }

    console.log('Current proposers:');
    proposers.forEach(p => {
      console.log(`  - ${p.name} (${p.model}): ${p.active ? '✅ ACTIVE' : '❌ INACTIVE'}`);
    });
    console.log();

    // Step 2: Disable gpt-4o-mini
    console.log('📊 Step 2: Disabling gpt-4o-mini\n');
    const gptProposers = proposers.filter(p =>
      p.model?.includes('gpt') || p.name?.toLowerCase().includes('gpt')
    );

    if (gptProposers.length === 0) {
      console.log('⚠️  No GPT proposers found');
    } else {
      for (const gpt of gptProposers) {
        const { error: updateError } = await supabase
          .from('proposer_configs')
          .update({ active: false })
          .eq('id', gpt.id);

        if (updateError) {
          console.error(`❌ Failed to disable ${gpt.name}:`, updateError.message);
        } else {
          console.log(`  ✅ Disabled ${gpt.name} (${gpt.model})`);
        }
      }
    }
    console.log();

    // Step 3: Enable Claude proposers
    console.log('📊 Step 3: Enabling Claude proposers\n');
    const claudeProposers = proposers.filter(p =>
      p.model?.includes('claude') || p.name?.toLowerCase().includes('claude')
    );

    if (claudeProposers.length === 0) {
      console.log('❌ No Claude proposers found - CRITICAL ERROR');
      console.log('   You need to have at least one Claude proposer configured');
      return;
    }

    for (const claude of claudeProposers) {
      const { error: updateError } = await supabase
        .from('proposer_configs')
        .update({ active: true })
        .eq('id', claude.id);

      if (updateError) {
        console.error(`❌ Failed to enable ${claude.name}:`, updateError.message);
      } else {
        console.log(`  ✅ Enabled ${claude.name} (${claude.model})`);
      }
    }
    console.log();

    // Step 4: Verify final state
    console.log('📊 Step 4: Verifying final proposer states\n');
    const { data: finalProposers, error: verifyError } = await supabase
      .from('proposer_configs')
      .select('id, name, model, provider, active')
      .order('name');

    if (verifyError) throw verifyError;

    console.log('Final proposer states:');
    finalProposers?.forEach(p => {
      console.log(`  - ${p.name} (${p.model}): ${p.active ? '✅ ACTIVE' : '❌ INACTIVE'}`);
    });
    console.log();

    const activeProposers = finalProposers?.filter(p => p.active) || [];
    const activeGPT = activeProposers.filter(p =>
      p.model?.includes('gpt') || p.name?.toLowerCase().includes('gpt')
    );
    const activeClaude = activeProposers.filter(p =>
      p.model?.includes('claude') || p.name?.toLowerCase().includes('claude')
    );

    console.log('================================================================================');
    console.log('✅ Configuration Complete\n');
    console.log(`Active Claude proposers: ${activeClaude.length}`);
    console.log(`Active GPT proposers: ${activeGPT.length}`);

    if (activeGPT.length > 0) {
      console.log('\n⚠️  WARNING: GPT proposers are still active!');
      console.log('   This may interfere with Claude-only testing');
    } else if (activeClaude.length === 0) {
      console.log('\n❌ ERROR: No active Claude proposers!');
      console.log('   Work orders will fail to route');
    } else {
      console.log('\n✅ SUCCESS: Only Claude proposers are active');
      console.log('   All work orders will be routed to Claude');
    }
    console.log('================================================================================');

  } catch (error) {
    console.error('\n❌ Error forcing Claude proposer:', error);
    throw error;
  }
}

forceClaudeProposer()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
