/**
 * Test Failure Classifier
 *
 * Verifies that the failure classifier correctly identifies different error types
 */

import { classifyError } from '../src/lib/failure-classifier';

console.log('🧪 Testing Failure Classifier...\n');

let passed = 0;
let failed = 0;

function test(name: string, error: Error, expectedClass: string) {
  const result = classifyError(error, { component: 'Test', operation: 'test' });

  if (result.failure_class === expectedClass) {
    console.log(`✅ ${name}: ${result.failure_class}`);
    passed++;
  } else {
    console.log(`❌ ${name}: Expected "${expectedClass}", got "${result.failure_class}"`);
    failed++;
  }
}

// Test 1: TypeScript compile error
test(
  'TypeScript compile error',
  new Error('src/app.ts(45,10): error TS2304: Cannot find name "foo"'),
  'compile_error'
);

// Test 2: Test failure
test(
  'Test failure',
  new Error('Test failed: expected true, got false'),
  'test_fail'
);

// Test 3: Timeout
test(
  'Timeout error',
  new Error('Operation timed out after 30000ms'),
  'timeout'
);

// Test 4: Git error (orchestration)
test(
  'Git error',
  new Error('fatal: unable to access repository'),
  'orchestration_error'
);

// Test 5: Budget exceeded
test(
  'Budget exceeded',
  new Error('Budget limit of $10.00 exceeded'),
  'budget_exceeded'
);

// Test 6: Lint error
test(
  'ESLint error',
  new Error('error: Unexpected var, use let or const instead'),
  'lint_error'
);

// Test 7: Missing dependency
test(
  'Dependency error',
  new Error('Cannot find module "typescript"'),
  'dependency_missing'
);

// Test 8: Contract violation
test(
  'Breaking change',
  new Error('BREAKING CHANGE: removed public API method'),
  'contract_violation'
);

// Test 9: Unknown error
test(
  'Unknown error',
  new Error('Something went wrong'),
  'unknown'
);

console.log('\n' + '='.repeat(60));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

if (failed === 0) {
  console.log('\n🎉 ALL TESTS PASSED - Failure classifier works correctly!');
  process.exit(0);
} else {
  console.log('\n❌ SOME TESTS FAILED - Failure classifier needs fixes');
  process.exit(1);
}
