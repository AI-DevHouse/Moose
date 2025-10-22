import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

config({ path: resolve(__dirname, '../.env.local') })

async function migrateToStatusStateMachine() {
  const supabase = createSupabaseServiceClient()

  console.log('🔄 Migrating WOs to clean status state machine (Option A)...\n')

  // Find all pending WOs with auto_approved=true in metadata
  const { data: pendingWithMetadata, error: fetchError } = await supabase
    .from('work_orders')
    .select('id, title, status, metadata')
    .eq('status', 'pending')

  if (fetchError) {
    console.error('❌ Error fetching WOs:', fetchError.message)
    return
  }

  const toMigrate = pendingWithMetadata?.filter((wo: any) =>
    wo.metadata?.auto_approved === true ||
    wo.metadata?.approved_by_director === true ||
    wo.metadata?.director_approved === true
  ) || []

  console.log(`Found ${toMigrate.length} WOs with approval in metadata\n`)

  if (toMigrate.length === 0) {
    console.log('✅ No WOs to migrate')
    return
  }

  // Update each one to status='approved'
  for (const wo of toMigrate) {
    const { error } = await supabase
      .from('work_orders')
      .update({ status: 'approved' })
      .eq('id', wo.id)

    if (error) {
      console.error(`❌ Failed to update ${wo.id.substring(0, 8)}:`, error.message)
    } else {
      console.log(`✅ ${wo.id.substring(0, 8)}... - ${wo.title}`)
    }
  }

  console.log(`\n✅ Migration complete! ${toMigrate.length} WOs now have status='approved'`)
  console.log('   Orchestrator will pick these up automatically.')
}

migrateToStatusStateMachine().catch(console.error)
