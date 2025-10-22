/**
 * Manual test for extraction fix
 * Run with: tsx scripts/test-extraction-fix.ts
 */

import { extractFromMarkdownFence, validateExtraction, autoCleanExtraction } from '../src/lib/extraction-validator';

console.log('='.repeat(60));
console.log('EXTRACTION FIX VALIDATION TESTS');
console.log('='.repeat(60));

// Test 1: Extract from typescript fence
console.log('\n[Test 1] Extract from typescript fence');
const test1 = `\`\`\`typescript
export const foo = 'bar';
export function test() {
  return 42;
}
\`\`\``;

const result1 = extractFromMarkdownFence(test1);
console.log('Input length:', test1.length);
console.log('Output length:', result1.length);
console.log('Contains code fence?', result1.includes('```') ? '❌ FAIL' : '✅ PASS');
console.log('Contains export?', result1.includes('export') ? '✅ PASS' : '❌ FAIL');

// Test 2: Extract from JSON fence (the { issue)
console.log('\n[Test 2] Extract from JSON fence (invalid { first char)');
const test2 = `\`\`\`json
{
  "name": "test",
  "value": 123
}
\`\`\``;

const result2 = extractFromMarkdownFence(test2);
const validation2 = validateExtraction(result2);
console.log('Extracted:', result2.substring(0, 50) + '...');
console.log('Starts with {?', result2.trim()[0] === '{' ? 'YES' : 'NO');
console.log('Validation result:', validation2.valid ? '✅ PASS' : '❌ FAIL (expected - JSON not TypeScript)');
console.log('Contains fence?', result2.includes('```') ? '❌ FAIL' : '✅ PASS');

// Test 3: Extract with leading/trailing text (gpt-4o-mini pattern)
console.log('\n[Test 3] Extract with leading/trailing text (gpt-4o-mini pattern)');
const test3 = `Here's the corrected code:

\`\`\`typescript
export const fixed = true;
\`\`\`

This should work now!`;

const result3 = extractFromMarkdownFence(test3);
const validation3 = validateExtraction(result3);
console.log('Extracted:', result3);
console.log('Contains "Here\'s"?', result3.includes('Here') ? '❌ FAIL' : '✅ PASS');
console.log('Contains export?', result3.includes('export') ? '✅ PASS' : '❌ FAIL');
console.log('Validation:', validation3.valid ? '✅ PASS' : '❌ FAIL', validation3.severity);

// Test 4: Markdown heading artifact (# issue)
console.log('\n[Test 4] Markdown heading artifact (# issue)');
const test4 = `# TypeScript Code

export const code = true;`;

const result4 = autoCleanExtraction(test4);
const validation4 = validateExtraction(result4);
console.log('Original first char:', test4.trim()[0]);
console.log('Cleaned first char:', result4.trim()[0]);
console.log('Removed heading?', !result4.includes('# TypeScript') ? '✅ PASS' : '❌ FAIL');
console.log('Validation:', validation4.valid ? '✅ PASS' : '❌ FAIL', validation4.severity);

// Test 5: Export { } statement (should allow { now)
console.log('\n[Test 5] Export { } statement (should allow { now)');
const test5 = `export { foo, bar } from './module';`;
const validation5 = validateExtraction(test5);
console.log('Code:', test5);
console.log('First char:', test5.trim()[0]);
console.log('Validation:', validation5.valid ? '✅ PASS' : '❌ FAIL', validation5.severity);

// Test 6: Full workflow - gpt-4o-mini response with fence
console.log('\n[Test 6] Full workflow - gpt-4o-mini response with fence');
const test6 = `Here's the fix:

\`\`\`typescript
import React from 'react';

export function Component() {
  return <div>Hello</div>;
}
\`\`\``;

const cleaned6 = autoCleanExtraction(test6);
const validation6 = validateExtraction(cleaned6);
console.log('Cleaned length:', cleaned6.length);
console.log('Contains fence?', cleaned6.includes('```') ? '❌ FAIL' : '✅ PASS');
console.log('Contains import?', cleaned6.includes('import React') ? '✅ PASS' : '❌ FAIL');
console.log('Contains explanatory text?', cleaned6.toLowerCase().includes('here') ? '❌ FAIL' : '✅ PASS');
console.log('Validation:', validation6.valid ? '✅ PASS' : '❌ FAIL', validation6.severity);

console.log('\n' + '='.repeat(60));
console.log('TESTS COMPLETE');
console.log('='.repeat(60));
