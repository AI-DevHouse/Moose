import { createSupabaseServiceClient } from '../src/lib/supabase'

const supabase = createSupabaseServiceClient()

async function checkProposerConfig() {
  console.log('📊 Checking proposer configuration...\n')

  const { data, error } = await supabase
    .from('proposer_configs')
    .select('id, name, model, provider, active, complexity_threshold')
    .order('name')

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log('Current proposer configurations:\n')
  data?.forEach((config, idx) => {
    console.log(`${idx + 1}. ${config.name}`)
    console.log(`   Model: ${config.model}`)
    console.log(`   Provider: ${config.provider}`)
    console.log(`   Active: ${config.active ? '✅ TRUE' : '❌ FALSE'}`)
    console.log(`   Complexity Threshold: ${config.complexity_threshold}`)
    console.log()
  })

  const activeProposers = data?.filter(p => p.active) || []
  console.log(`\n${'='.repeat(80)}`)
  console.log(`Active proposers: ${activeProposers.length}`)
  console.log(`   ${activeProposers.map(p => p.name).join(', ')}`)
}

checkProposerConfig().catch(console.error)
