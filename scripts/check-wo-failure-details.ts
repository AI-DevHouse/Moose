import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

config({ path: resolve(__dirname, '../.env.local') })

async function checkFailures() {
  const supabase = createSupabaseServiceClient()

  console.log('🔍 Checking failure details for extraction test WOs...\n')

  const { data: wos, error } = await supabase
    .from('work_orders')
    .select('id, title, status, metadata, created_at, updated_at')
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

  for (const wo of wos) {
    const metadata = wo.metadata || {}
    console.log('='.repeat(80))
    console.log(`WO: ${wo.title}`)
    console.log(`ID: ${wo.id}`)
    console.log(`Status: ${wo.status}`)
    console.log(`Created: ${new Date(wo.created_at).toLocaleString()}`)
    console.log(`Updated: ${new Date(wo.updated_at).toLocaleString()}`)

    if (metadata.execution_logs) {
      console.log('\nExecution Logs:')
      console.log(JSON.stringify(metadata.execution_logs, null, 2))
    }

    if (metadata.error_message) {
      console.log('\nError Message:')
      console.log(metadata.error_message)
    }

    if (metadata.failure_reason) {
      console.log('\nFailure Reason:')
      console.log(metadata.failure_reason)
    }

    console.log()
  }
}

checkFailures().catch(console.error)
