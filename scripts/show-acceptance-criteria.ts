import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

config({ path: resolve(__dirname, '../.env.local') })

async function showAcceptanceCriteria() {
  const supabase = createSupabaseServiceClient()

  console.log('📋 MLD Work Order Acceptance Criteria\n')
  console.log('='.repeat(100))

  // IDs of the matched WOs
  const woIds = [
    '3e1922cb-e548-40b3-a59c-1ddcdda85320', // Redux Middleware
    'fb95216c-5f7c-4541-a295-8ae6cdbe932d', // IPC Client
    '787c6dd1-e0c4-490a-95af-a851e07996b1', // Clipboard-WebView
    '8bfcedb8-0236-49f9-bd00-15e8fe6f7263', // ChatGPT Provider
    'a7bb6c49-822b-42bb-a958-03d80e074a5f', // Parser Recognition
    '24f96d7f-ea9a-479c-ab25-609ac1dc7d9c', // Termination Marker
    'a97e01e0-b661-4396-9aa8-7cfafadd6be0'  // Provider Panel
  ]

  for (const id of woIds) {
    const { data: wo, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.log(`❌ Error fetching ${id.substring(0, 8)}:`, error.message)
      continue
    }

    console.log('\n' + '='.repeat(100))
    console.log(`📦 ${wo.title}`)
    console.log(`ID: ${id.substring(0, 8)}...`)
    console.log('='.repeat(100))

    console.log(`\n📝 Description:`)
    console.log(wo.description || 'None')

    console.log(`\n✅ Acceptance Criteria:`)

    if (wo.acceptance_criteria) {
      if (Array.isArray(wo.acceptance_criteria)) {
        wo.acceptance_criteria.forEach((ac: any, index: number) => {
          const criterion = typeof ac === 'string' ? ac : (ac.description || ac.criterion || JSON.stringify(ac))
          console.log(`\n  AC-${String(index + 1).padStart(3, '0')}: ${criterion}`)
        })
      } else if (typeof wo.acceptance_criteria === 'string') {
        console.log(`  ${wo.acceptance_criteria}`)
      } else {
        console.log(`  ${JSON.stringify(wo.acceptance_criteria, null, 2)}`)
      }
    } else {
      console.log('  ⚠️  No acceptance criteria defined in database')
    }

    console.log(`\n📊 Metadata:`)
    console.log(`  Status: ${wo.status}`)
    console.log(`  Priority: ${wo.priority || 'N/A'}`)
    console.log(`  Complexity: ${wo.complexity_score || 'N/A'}/10`)
  }

  console.log('\n' + '='.repeat(100))
}

showAcceptanceCriteria().catch(console.error)
