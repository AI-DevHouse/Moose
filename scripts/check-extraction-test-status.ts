import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

config({ path: resolve(__dirname, '../.env.local') })

async function checkStatus() {
  const supabase = createSupabaseServiceClient()

  console.log('🔍 Checking extraction test WO status...\n')

  const { data: wos, error } = await supabase
    .from('work_orders')
    .select('id, title, status, metadata')
    .eq('metadata->>test_batch', 'extraction-validation-v1')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  if (!wos || wos.length === 0) {
    console.log('❌ No extraction test WOs found')
    return
  }

  console.log(`Found ${wos.length} extraction test WOs:\n`)

  for (const wo of wos) {
    const metadata = wo.metadata || {}
    console.log(`${wo.id.substring(0, 8)}... - ${wo.title}`)
    console.log(`  Status: ${wo.status}`)
    console.log(`  auto_approved: ${metadata.auto_approved || 'false'}`)
    console.log()
  }
}

checkStatus().catch(console.error)
