import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') })

async function approveWorktreeTestWOs() {
  const supabase = createSupabaseServiceClient()
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'

  // Get the 3 work orders with worktree_pool_test metadata
  const { data: wos, error: fetchError } = await supabase
    .from('work_orders')
    .select('id, title, status, metadata')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10)

  if (fetchError) {
    console.error('❌ Error fetching work orders:', fetchError)
    return
  }

  // Filter for worktree test WOs
  const testWOs = wos?.filter((wo: any) =>
    wo.metadata?.worktree_pool_test === true ||
    wo.metadata?.test_batch === 'worktree-validation-v90'
  ) || []

  console.log(`\n🔍 Found ${testWOs.length} worktree test work orders\n`)

  if (testWOs.length === 0) {
    console.log('No worktree test work orders found')
    return
  }

  // Update metadata to ensure auto_approved is set
  for (const wo of testWOs) {
    const metadata = wo.metadata || {}
    metadata.auto_approved = true

    const { error: updateError } = await supabase
      .from('work_orders')
      .update({ metadata })
      .eq('id', wo.id)

    if (updateError) {
      console.error(`❌ Error updating WO ${wo.id}:`, updateError)
    } else {
      console.log(`✅ Approved: ${wo.id.substring(0, 8)}... - ${wo.title}`)
    }
  }

  console.log(`\n✅ Successfully approved ${testWOs.length} worktree test work orders`)
  console.log('\nOrchestrator should pick these up on next poll cycle (10s)')
}

approveWorktreeTestWOs().catch(console.error)
