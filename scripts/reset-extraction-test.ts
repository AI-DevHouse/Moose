import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

config({ path: resolve(__dirname, '../.env.local') })

async function resetTest() {
  const supabase = createSupabaseServiceClient()

  console.log('🔄 Resetting extraction test...\n')

  // Delete test WOs
  const { data: wos, error: fetchError } = await supabase
    .from('work_orders')
    .select('id, title')
    .eq('metadata->>test_batch', 'extraction-validation-v1')

  if (fetchError) {
    console.error('❌ Error fetching WOs:', fetchError)
    return
  }

  if (!wos || wos.length === 0) {
    console.log('✅ No test WOs to delete')
    return
  }

  console.log(`Found ${wos.length} test WOs to delete:\n`)

  for (const wo of wos) {
    const { error: deleteError } = await supabase
      .from('work_orders')
      .delete()
      .eq('id', wo.id)

    if (deleteError) {
      console.error(`❌ Error deleting ${wo.id}:`, deleteError)
      continue
    }

    console.log(`✅ Deleted: ${wo.id.substring(0, 8)}... - ${wo.title}`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('✅ Extraction test reset complete')
  console.log('='.repeat(80))
}

resetTest().catch(console.error)
