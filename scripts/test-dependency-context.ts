// Test script to validate dependency context integration
// This simulates a proposer request and displays the generated prompt

import { enhancedProposerService } from '../src/lib/enhanced-proposer-service';

async function testDependencyContext() {
  console.log('🧪 Testing Dependency Context Integration\n');
  console.log('=' .repeat(80));

  try {
    // Create a test request for code generation
    const testRequest = {
      task_description: 'Create a simple TypeScript function that fetches data from Supabase',
      context: ['This is a test function to validate dependency awareness'],
      expected_output_type: 'code' as const,
      security_context: 'low' as const,
      priority: 'low' as const,
      metadata: {
        work_order_id: 'test-dependency-context'
      }
    };

    console.log('📝 Test Request:');
    console.log(JSON.stringify(testRequest, null, 2));
    console.log('\n' + '='.repeat(80));
    console.log('🔍 Generated Prompt (with dependency context):');
    console.log('='.repeat(80) + '\n');

    // Access the private method using type assertion
    // This is for testing purposes only
    const service = enhancedProposerService as any;
    const prompt = service.buildClaudePrompt(testRequest);

    console.log(prompt);
    console.log('\n' + '='.repeat(80));

    // Check if prompt includes dependency context
    const hasDependencies = prompt.includes('AVAILABLE DEPENDENCIES');
    const hasImportRules = prompt.includes('IMPORT RULES');
    const hasProjectModules = prompt.includes('PROJECT MODULES');

    console.log('\n✅ Validation Results:');
    console.log(`  - Includes AVAILABLE DEPENDENCIES: ${hasDependencies ? '✓' : '✗'}`);
    console.log(`  - Includes IMPORT RULES: ${hasImportRules ? '✓' : '✗'}`);
    console.log(`  - Includes PROJECT MODULES: ${hasProjectModules ? '✓' : '✗'}`);

    if (hasDependencies && hasImportRules && hasProjectModules) {
      console.log('\n🎉 Dependency context integration successful!\n');
      process.exit(0);
    } else {
      console.log('\n❌ Dependency context integration failed!\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

testDependencyContext();
