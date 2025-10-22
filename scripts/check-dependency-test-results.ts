// Check results of dependency fix test work orders

import { createSupabaseServiceClient } from '../src/lib/supabase';

const supabase = createSupabaseServiceClient();

async function checkTestResults() {
  console.log('📊 Checking Dependency Fix Test Results\n');
  console.log('='.repeat(80));

  // Fetch all test WOs
  const { data: testWOs, error } = await supabase
    .from('work_orders')
    .select('id, title, status, metadata')
    .contains('tags', ['test-dependency-fix'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch test work orders:', error);
    process.exit(1);
  }

  if (!testWOs || testWOs.length === 0) {
    console.log('⚠️  No test work orders found');
    console.log('   Run: npx tsx --env-file=.env.local scripts/test-dependency-fix-wos.ts');
    process.exit(0);
  }

  console.log(`\n📝 Found ${testWOs.length} test work orders\n`);

  let completed = 0;
  let failed = 0;
  let ts2307Errors = 0;
  let otherErrors = 0;
  let pending = 0;
  let executing = 0;

  for (const wo of testWOs) {
    const shortId = wo.id.substring(0, 8);
    let statusIcon = '⏳';
    let statusText = wo.status;
    let errorInfo = '';

    if (wo.status === 'completed') {
      completed++;
      statusIcon = '✅';
    } else if (wo.status === 'failed') {
      failed++;
      statusIcon = '❌';

      // Check if it's a TS2307 error
      const metadata = wo.metadata as any;
      const errorMsg = metadata?.error_message || metadata?.failure_details || '';

      if (errorMsg.includes('TS2307') || errorMsg.includes('Cannot find module')) {
        ts2307Errors++;
        errorInfo = ' (TS2307 - module not found)';
      } else {
        otherErrors++;
        errorInfo = ` (${errorMsg.substring(0, 50)}...)`;
      }
    } else if (wo.status === 'executing') {
      executing++;
      statusIcon = '⚙️';
    } else {
      pending++;
    }

    console.log(`${statusIcon} WO #${shortId}: ${wo.title}`);
    console.log(`   Status: ${statusText}${errorInfo}\n`);
  }

  console.log('='.repeat(80));
  console.log('\n📈 Summary Statistics:\n');
  console.log(`   Total Test WOs:     ${testWOs.length}`);
  console.log(`   ✅ Completed:        ${completed} (${Math.round(completed/testWOs.length*100)}%)`);
  console.log(`   ❌ Failed:           ${failed} (${Math.round(failed/testWOs.length*100)}%)`);
  console.log(`   ⚙️  Executing:        ${executing}`);
  console.log(`   ⏳ Pending:          ${pending}`);

  if (failed > 0) {
    console.log(`\n   🔍 Failure Breakdown:`);
    console.log(`      - TS2307 errors:  ${ts2307Errors} (${Math.round(ts2307Errors/failed*100)}% of failures)`);
    console.log(`      - Other errors:   ${otherErrors} (${Math.round(otherErrors/failed*100)}% of failures)`);
  }

  console.log('\n='.repeat(80));

  // Calculate improvement vs v99
  const ts2307Rate = failed > 0 ? (ts2307Errors / failed * 100) : 0;
  const v99Rate = 100; // v99 had 100% TS2307 errors

  if (completed + failed > 0) {
    console.log('\n🎯 Comparison to v99:\n');
    console.log(`   v99 TS2307 rate:    ${v99Rate}% (5/5 WOs)`);
    console.log(`   Current TS2307 rate: ${Math.round(ts2307Rate)}% (${ts2307Errors}/${failed} failures)`);

    if (ts2307Rate < 30) {
      console.log(`\n   ✅ SUCCESS! TS2307 rate reduced by ${Math.round(v99Rate - ts2307Rate)}pp`);
      console.log(`   🎉 Dependency context fix is working!\n`);
    } else if (ts2307Rate < v99Rate) {
      console.log(`\n   ⚠️  PARTIAL SUCCESS: TS2307 rate improved but still high`);
      console.log(`   🔧 Additional fixes may be needed\n`);
    } else {
      console.log(`\n   ❌ No improvement detected`);
      console.log(`   🔧 Dependency context may not be working as expected\n`);
    }
  } else {
    console.log('\n⏳ Tests still running. Check back later.\n');
  }
}

checkTestResults().catch(console.error);
