import { createSupabaseServiceClient } from '../src/lib/supabase'

const supabase = createSupabaseServiceClient()

async function setGpt4oMiniActive() {
  console.log('🔄 Configuring proposers for test: enabling gpt-4o-mini, disabling Claude 4.5...\n')

  // Disable Claude 4.5
  const { error: claudeError } = await supabase
    .from('proposer_configs')
    .update({ active: false })
    .eq('name', 'claude-sonnet-4-5')

  if (claudeError) {
    console.error('❌ Error disabling Claude 4.5:', claudeError)
    return
  }

  console.log('✅ Disabled claude-sonnet-4-5')

  // Enable gpt-4o-mini
  const { error: gptError } = await supabase
    .from('proposer_configs')
    .update({ active: true })
    .eq('name', 'gpt-4o-mini')

  if (gptError) {
    console.error('❌ Error enabling gpt-4o-mini:', gptError)
    return
  }

  console.log('✅ Enabled gpt-4o-mini')

  // Verify configuration
  const { data, error } = await supabase
    .from('proposer_configs')
    .select('name, active')
    .order('name')

  if (!error) {
    console.log('\n📊 Current configuration:')
    data?.forEach(p => {
      console.log(`   ${p.name}: ${p.active ? '✅ TRUE' : '❌ FALSE'}`)
    })
  }

  console.log('\n✅ Proposer configuration updated successfully')
}

setGpt4oMiniActive().catch(console.error)
