import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

config({ path: resolve(__dirname, '../.env.local') })

async function identifyTestWOs() {
  const supabase = createSupabaseServiceClient()

  console.log('🔍 Identifying Test vs Real Work Orders\n')
  console.log('='.repeat(80))

  // Get all work orders
  const { data: wos, error } = await supabase
    .from('work_orders')
    .select('id, title, description, created_at, metadata')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  if (!wos || wos.length === 0) {
    console.log('⚠️  No work orders found')
    return
  }

  // Identify test WOs (contain test markers in description)
  const testWOs = wos.filter(wo => {
    const desc = wo.description || ''
    const title = wo.title || ''
    return (
      desc.includes('validation test') ||
      desc.includes('concurrent pool') ||
      desc.includes('This is a test') ||
      desc.includes('test WO') ||
      title.includes('[TEST]') ||
      title.includes('Test:')
    )
  })

  const realWOs = wos.filter(wo => !testWOs.find(t => t.id === wo.id))

  console.log(`\n📊 Summary:`)
  console.log(`   Total WOs: ${wos.length}`)
  console.log(`   Test WOs: ${testWOs.length}`)
  console.log(`   Real WOs: ${realWOs.length}`)

  if (testWOs.length > 0) {
    console.log(`\n❌ Test WOs to Remove:\n`)
    testWOs.forEach((wo, idx) => {
      console.log(`${idx + 1}. ${wo.id.substring(0, 8)}... - ${wo.title}`)
      const descPreview = wo.description?.substring(0, 100).replace(/\n/g, ' ')
      console.log(`   "${descPreview}..."`)
      console.log(`   Created: ${new Date(wo.created_at).toLocaleString()}`)
      console.log()
    })
  }

  if (realWOs.length > 0) {
    console.log(`\n✅ Real WOs to Keep (first 10):\n`)
    realWOs.slice(0, 10).forEach((wo, idx) => {
      console.log(`${idx + 1}. ${wo.id.substring(0, 8)}... - ${wo.title}`)
      const descPreview = wo.description?.substring(0, 100).replace(/\n/g, ' ')
      console.log(`   "${descPreview}..."`)
      console.log()
    })
    if (realWOs.length > 10) {
      console.log(`   ... and ${realWOs.length - 10} more real WOs`)
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log(`\n💡 To delete test WOs, run: scripts/delete-test-wos.ts`)
}

identifyTestWOs().catch(console.error)
