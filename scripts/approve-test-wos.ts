/**
 * Approve 2-3 Work Orders for Testing Phase 1 & 2 Fixes
 */

import { createSupabaseServiceClient } from '../src/lib/supabase'

async function approveTestWOs() {
  const supabase = createSupabaseServiceClient()
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'

  // Get next 2-3 pending work orders (different from previous test)
  const { data: wos } = await supabase
    .from('work_orders')
    .select('id, title')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .range(5, 7) // Skip first 5 (already tested), get next 3
    .limit(3)

  console.log(`\n✅ Marking ${wos?.length || 0} work orders for Phase 1 & 2 fix testing...\n`)

  if (wos && wos.length > 0) {
    // Get GPT-4o-mini proposer ID
    const { data: gptProposer } = await supabase
      .from('proposer_configs')
      .select('id')
      .eq('name', 'gpt-4o-mini')
      .single()

    const gptProposerId = gptProposer?.id || 'b50d6dbf-c1fc-4b9c-b655-db93cc3bc940'

    // Update metadata to set auto_approved: true AND force GPT-4o-mini proposer
    const updates = wos.map(async (wo) => {
      const metadata = (wo as any).metadata || {};
      metadata.auto_approved = true;

      return supabase
        .from('work_orders')
        .update({
          metadata,
          proposer_id: gptProposerId
        })
        .eq('id', wo.id);
    });

    const results = await Promise.all(updates);
    const errors = results.filter(r => r.error);

    const error = errors.length > 0 ? errors[0].error : null

    if (error) {
      console.error('❌ Error:', error)
    } else {
      console.log(`✅ Successfully marked ${wos.length} work orders for testing`)
      console.log('\nTest Work Orders:')
      wos.forEach((wo, i) => {
        console.log(`${i + 1}. ${wo.id.substring(0, 8)}... - ${wo.title}`)
      })
      console.log(`\n💰 Using GPT-4o-mini for cost-effective testing`)
      console.log(`\n🔍 Testing fixes:`)
      console.log(`   1. work_order_id tracking`)
      console.log(`   2. sanitizer telemetry logging`)
    }
  } else {
    console.log('No pending work orders found')
  }
}

approveTestWOs().catch(console.error)
