// Check orchestrator state and WO readiness

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkState() {
  console.log('\n📊 ORCHESTRATOR STATE CHECK\n');
  console.log('═'.repeat(80));

  // Check approved WOs
  const { data: approvedWOs } = await supabase
    .from('work_orders')
    .select('id, title, status, metadata')
    .eq('status', 'approved')
    .order('created_at', { ascending: true });

  console.log(`\n✅ APPROVED WOs: ${approvedWOs?.length || 0}\n`);

  if (approvedWOs && approvedWOs.length > 0) {
    approvedWOs.forEach(wo => {
      const deps = wo.metadata?.dependencies || [];
      console.log(`  • WO-${wo.id.substring(0, 8)}: ${wo.title}`);
      console.log(`    Dependencies: ${deps.length === 0 ? 'None (can execute immediately)' : deps.map((d: string) => d.substring(0, 8)).join(', ')}`);
    });
  }

  // Check completed WOs
  const { data: completedWOs } = await supabase
    .from('work_orders')
    .select('id, title, status')
    .in('status', ['completed', 'merged']);

  console.log(`\n✅ COMPLETED WOs: ${completedWOs?.length || 0}\n`);

  if (completedWOs && completedWOs.length > 0) {
    completedWOs.forEach(wo => {
      console.log(`  • WO-${wo.id.substring(0, 8)}: ${wo.title} [${wo.status}]`);
    });
  }

  // Check in_progress WOs
  const { data: inProgressWOs } = await supabase
    .from('work_orders')
    .select('id, title, status, github_pr_url')
    .eq('status', 'in_progress');

  console.log(`\n🔄 IN PROGRESS WOs: ${inProgressWOs?.length || 0}\n`);

  if (inProgressWOs && inProgressWOs.length > 0) {
    inProgressWOs.forEach(wo => {
      console.log(`  • WO-${wo.id.substring(0, 8)}: ${wo.title}`);
      if (wo.github_pr_url) {
        console.log(`    PR: ${wo.github_pr_url}`);
      }
    });
  }

  console.log('\n' + '═'.repeat(80));

  // Determine what should execute next
  console.log('\n🎯 NEXT EXECUTABLE WO:');

  const completedIds = new Set((completedWOs || []).map(wo => wo.id));

  const executable = (approvedWOs || []).filter(wo => {
    const deps = wo.metadata?.dependencies || [];
    if (deps.length === 0) return true;
    return deps.every((depId: string) => completedIds.has(depId));
  });

  if (executable.length === 0) {
    console.log('  ❌ No WOs ready to execute');
    console.log('     (All approved WOs are blocked by dependencies)');
  } else {
    console.log(`  ✅ ${executable.length} WO(s) ready to execute:\n`);
    executable.forEach(wo => {
      console.log(`     • WO-${wo.id.substring(0, 8)}: ${wo.title}`);
    });
  }

  console.log('');
}

checkState().catch(console.error);
