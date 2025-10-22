/**
 * Manual test script for acceptance validation with fixed target project infrastructure
 */

import { validateWorkOrderAcceptance } from '../src/lib/acceptance-validator'

async function testAcceptanceValidation() {
  console.log('🧪 Testing Acceptance Validation on WO c87e4ee8')
  console.log('   Target Project: C:/dev/multi-llm-discussion-v1')
  console.log('   Fixed infrastructure: package.json, tsconfig.json, jest, eslint\n')

  const workOrderId = 'c87e4ee8-be2d-43d9-bbe0-7f22869bdc6c'
  const prUrl = 'manual-test'
  const projectPath = 'C:/dev/multi-llm-discussion-v1'

  try {
    const result = await validateWorkOrderAcceptance(workOrderId, prUrl, projectPath)

    console.log('\n' + '='.repeat(80))
    console.log('📊 VALIDATION RESULT')
    console.log('='.repeat(80))
    console.log(JSON.stringify(result, null, 2))
    console.log('='.repeat(80))

    // Compare to v85 baseline:
    console.log('\n📈 COMPARISON TO v85 BASELINE:')
    console.log('   v85 (NO package.json):')
    console.log('   - Acceptance Score: 4.5/10')
    console.log('   - Build Success: 0/10 ❌')
    console.log('   - Test Coverage: 0/10 ❌')
    console.log('   - Completeness: 2/10 ⚠️\n')
    console.log('   v86 (WITH package.json):')
    console.log(`   - Acceptance Score: ${result.acceptance_score.toFixed(1)}/10`)
    console.log(`   - Build Success: ${result.dimension_scores.build_success}/10 ${result.build_passed ? '✅' : '❌'}`)
    console.log(`   - Test Coverage: ${result.dimension_scores.test_coverage}/10 ${result.test_coverage_percent > 0 ? '✅' : '⚠️'}`)
    console.log(`   - Completeness: ${result.dimension_scores.completeness}/10`)

    console.log('\n✅ Test complete!')
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

testAcceptanceValidation()
