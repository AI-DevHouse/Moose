import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

config({ path: resolve(__dirname, '../.env.local') })

async function deleteValidationTestWOs() {
  const supabase = createSupabaseServiceClient()

  console.log('🗑️  Deleting Validation Test Work Orders\n')
  console.log('='.repeat(80))

  // Target the specific 8 test WOs by their IDs (from identify-test-wos.ts output)
  const testWOIds = [
    '93ab742f',  // Add improved error handling to API endpoints
    '34879782',  // Update README with project architecture overview
    '8c2f3b23',  // Add input validation to environment variables
    '6b6d6b3d',  // Add TypeScript strict mode configuration
    '10bc85f6',  // Add code formatting with Prettier
    '4a2bb50b',  // Add npm scripts for common tasks
    '5fc7f9c9',  // Add CONTRIBUTING.md guide
    '8a565af3',  // Add .editorconfig for consistent formatting
  ]

  // Get these work orders
  const { data: wos, error } = await supabase
    .from('work_orders')
    .select('id, title, description')
    .in('id', testWOIds.map(shortId => {
      // Need to get full IDs - query by partial match
      return shortId
    }))

  // Alternative: Query by description pattern
  const { data: allWOs, error: queryError } = await supabase
    .from('work_orders')
    .select('id, title, description')

  if (queryError) {
    console.error('❌ Error:', queryError)
    return
  }

  // Filter for test WOs
  const testWOs = allWOs?.filter(wo => {
    const desc = wo.description || ''
    return (
      desc.includes('15-concurrent pool validation test') ||
      desc.includes('validation test #')
    )
  }) || []

  if (testWOs.length === 0) {
    console.log('⚠️  No validation test WOs found')
    return
  }

  console.log(`Found ${testWOs.length} validation test WOs:\n`)
  testWOs.forEach((wo, idx) => {
    console.log(`${idx + 1}. ${wo.id.substring(0, 8)}... - ${wo.title}`)
  })

  console.log(`\n🔄 Deleting...`)

  let deleted = 0
  for (const wo of testWOs) {
    const { error: deleteError } = await supabase
      .from('work_orders')
      .delete()
      .eq('id', wo.id)

    if (deleteError) {
      console.error(`  ❌ Failed to delete ${wo.id.substring(0, 8)}: ${deleteError.message}`)
    } else {
      deleted++
      console.log(`  ✅ Deleted ${wo.id.substring(0, 8)}... - ${wo.title}`)
    }
  }

  // Verify final count
  const { count, error: countError } = await supabase
    .from('work_orders')
    .select('id', { count: 'exact', head: true })

  console.log('\n' + '='.repeat(80))
  console.log(`\n✅ Deleted ${deleted} validation test work orders`)
  if (!countError) {
    console.log(`📊 Remaining WOs in database: ${count}`)
  }
}

deleteValidationTestWOs().catch(console.error)
