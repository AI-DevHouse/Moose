// Monitor bootstrap WO-0 execution
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const bootstrapWOId = '14b6ea23-2554-42c2-ae5f-ca90084863ed';

async function main() {
  console.log('👀 Monitoring Bootstrap WO-0 Execution\n');
  console.log(`WO ID: ${bootstrapWOId}\n`);

  const { data: wo, error } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', bootstrapWOId)
    .single();

  if (error || !wo) {
    console.error('Failed to fetch WO:', error);
    process.exit(1);
  }

  console.log('📊 Current Status:');
  console.log(`   Title: ${wo.title}`);
  console.log(`   Status: ${wo.status}`);
  console.log(`   Files in scope: ${wo.files_in_scope.join(', ')}\n`);

  if (wo.metadata) {
    console.log('📝 Metadata:');
    if (wo.metadata.pr_number) {
      console.log(`   PR: #${wo.metadata.pr_number}`);
    }
    if (wo.metadata.pr_url) {
      console.log(`   PR URL: ${wo.metadata.pr_url}`);
    }
    if (wo.metadata.branch_name) {
      console.log(`   Branch: ${wo.metadata.branch_name}`);
    }
    if (wo.metadata.github_checks_status) {
      console.log(`   GitHub Checks: ${wo.metadata.github_checks_status}`);
    }
    console.log('');
  }

  // Check if PR exists
  if (wo.metadata?.pr_number) {
    console.log(`\n🔍 To view PR: gh pr view ${wo.metadata.pr_number} --repo AI-DevHouse/multi-llm-discussion-v1`);
    console.log(`🔍 To view diff: gh pr diff ${wo.metadata.pr_number} --repo AI-DevHouse/multi-llm-discussion-v1\n`);
  }

  if (wo.status === 'completed') {
    console.log('✅ Bootstrap WO completed! Checking multi-llm repo for created files...\n');
  } else if (wo.status === 'failed') {
    console.log('❌ Bootstrap WO failed. Check logs for details.\n');
  } else {
    console.log(`⏳ Bootstrap WO still ${wo.status}. Check orchestrator daemon output.\n`);
  }
}

main();
