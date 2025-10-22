import { createSupabaseServiceClient } from '../src/lib/supabase'

async function approvePhase1WOs() {
  const supabase = createSupabaseServiceClient()
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'

  // Get first 5 pending work orders
  const { data: wos } = await supabase
    .from('work_orders')
    .select('id, title')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(5)

  console.log(`\n✅ Marking ${wos?.length || 0} work orders as auto_approved for Phase 1 and forcing GPT-4o-mini...\n`)

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
      console.log(`✅ Successfully marked ${wos.length} work orders as auto_approved and forced to GPT-4o-mini (${gptProposerId.substring(0, 8)}...)`)
      console.log('\nPhase 1 Work Orders:')
      wos.forEach((wo, i) => {
        console.log(`${i + 1}. ${wo.title}`)
      })
      console.log(`\n💰 These work orders will now use GPT-4o-mini for much lower cost testing`)
    }
  } else {
    console.log('No pending work orders found')
  }
}

approvePhase1WOs().catch(console.error)
