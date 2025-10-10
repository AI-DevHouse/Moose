import { createSupabaseServiceClient } from '../src/lib/supabase'

async function checkStatus() {
  const supabase = createSupabaseServiceClient()
  const woId = process.argv[2] || '8b279351-ad84-44ee-b4ec-8c7b10edc976'

  const { data, error } = await supabase
    .from('work_orders')
    .select('id, title, status, risk_level')
    .eq('id', woId)
    .single()

  if (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }

  console.log('📋 Work Order Status:')
  console.log(JSON.stringify(data, null, 2))
}

checkStatus().catch(console.error)
