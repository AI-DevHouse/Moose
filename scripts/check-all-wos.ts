import { createSupabaseServiceClient } from '../src/lib/supabase'

async function checkAllWOs() {
  const supabase = createSupabaseServiceClient()
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'

  const { data, error } = await supabase
    .from('work_orders')
    .select('title, status, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }

  console.log(`\n📊 Total Work Orders: ${data?.length || 0}\n`)

  if (data && data.length > 0) {
    console.log('All Work Orders:\n')
    data.forEach((wo, idx) => {
      const time = new Date(wo.created_at).toLocaleTimeString()
      console.log(`${idx + 1}. [${time}] ${wo.title}`)
    })
  }
}

checkAllWOs().catch(console.error)
