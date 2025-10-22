import { createSupabaseServiceClient } from '../src/lib/supabase';

async function switchToGPTProposer() {
  const supabase = createSupabaseServiceClient();

  console.log('\n🔄 Switching to GPT-4o-mini for Phase 1 testing...\n');

  // Enable GPT-4o-mini
  const { data: gptData, error: gptError } = await supabase
    .from('proposer_configs')
    .update({ active: true })
    .eq('name', 'gpt-4o-mini')
    .select();

  if (gptError) {
    console.error('❌ Error enabling GPT-4o-mini:', gptError);
    return;
  }

  console.log('✅ Enabled GPT-4o-mini proposer');
  console.log(`  Name: ${gptData?.[0]?.name}`);
  console.log(`  Model: ${gptData?.[0]?.model}`);
  console.log(`  Active: ${gptData?.[0]?.active}`);

  // Disable Claude Sonnet 4.5
  const { data: claudeData, error: claudeError } = await supabase
    .from('proposer_configs')
    .update({ active: false })
    .eq('name', 'claude-sonnet-4-5')
    .select();

  if (claudeError) {
    console.error('❌ Error disabling Claude:', claudeError);
    return;
  }

  console.log('\n✅ Disabled Claude Sonnet 4.5 proposer');
  console.log(`  Name: ${claudeData?.[0]?.name}`);
  console.log(`  Model: ${claudeData?.[0]?.model}`);
  console.log(`  Active: ${claudeData?.[0]?.active}`);

  console.log('\n💰 All work orders will now route to GPT-4o-mini for lower cost testing');
}

switchToGPTProposer().catch(console.error);
