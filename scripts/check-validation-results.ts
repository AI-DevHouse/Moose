import { createSupabaseServiceClient } from '../src/lib/supabase.js';

async function checkValidationResults() {
  const woIds = [
    '8a565af3-9f0f-4712-a26d-5808b9bbb123',
    '5fc7f9c9-629c-440b-8a36-adfe62f5cbb6',
    '4a2bb50b-b013-4112-a0f5-373e38b558e3'
  ];

  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
  .from('work_orders')
  .select('*')
  .in('id', woIds)
  .order('title');

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

console.log('📊 Extraction Fix Validation Results\n');
console.log('=' .repeat(80));

data?.forEach((wo: any) => {
  console.log(`\n${wo.title}`);
  console.log(`ID: ${wo.id.substring(0, 8)}...`);
  console.log(`Status: ${wo.status}`);
  console.log(`Proposer: ${wo.proposer_id || 'N/A'}`);
  console.log(`PR: ${wo.pr_url || 'N/A'}`);
  console.log(`\nAcceptance Scores:`);
  console.log(`  Total: ${wo.acceptance_score || 'N/A'}/10`);
  console.log(`  Architecture: ${wo.acceptance_architecture || 'N/A'}/10`);
  console.log(`  Readability: ${wo.acceptance_readability || 'N/A'}/10`);
  console.log(`  Completeness: ${wo.acceptance_completeness || 'N/A'}/10`);
  console.log(`  Test Coverage: ${wo.acceptance_test_coverage || 'N/A'}/10`);
  console.log(`  Build Success: ${wo.acceptance_build_success || 'N/A'}/10`);

  if (wo.execution_result) {
    const result = typeof wo.execution_result === 'string'
      ? JSON.parse(wo.execution_result)
      : wo.execution_result;

    console.log(`\nExecution Details:`);
    console.log(`  Duration: ${result.duration_ms ? (result.duration_ms / 1000).toFixed(1) : 'N/A'}s`);
    console.log(`  TS Errors: ${result.ts_errors?.length || 0}`);
    if (result.validation_errors?.length) {
      console.log(`  ⚠️  Validation Errors: ${result.validation_errors.length}`);
      result.validation_errors.forEach((err: any) => {
        console.log(`     - ${err.message || err}`);
      });
    }
  }
  console.log('-'.repeat(80));
});

console.log(`\n✅ Summary:`);
console.log(`Total WOs: ${data?.length || 0}`);
const avgScore = data?.reduce((sum: number, wo: any) => sum + (wo.acceptance_score || 0), 0) / (data?.length || 1);
console.log(`Average Acceptance Score: ${avgScore.toFixed(1)}/10`);
const totalErrors = data?.reduce((sum: number, wo: any) => {
  const result = wo.execution_result ? (typeof wo.execution_result === 'string' ? JSON.parse(wo.execution_result) : wo.execution_result) : {};
  return sum + (result.ts_errors?.length || 0);
}, 0);
console.log(`Total TS Errors: ${totalErrors}`);
console.log(`\n🎯 Extraction Fix Validation: ${totalErrors === 0 ? '✅ PASS (0 validation errors)' : '⚠️  NEEDS REVIEW'}`);
}

checkValidationResults();
