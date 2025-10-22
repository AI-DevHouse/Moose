// Test bootstrap WO injection with external service requirements
import { architectService } from '../src/lib/architect-service';
import type { TechnicalSpec } from '../src/types/architect';

const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'; // multi-llm-discussion-v1

// Spec that mentions external services (OpenAI, Supabase)
const testSpec: TechnicalSpec = {
  feature_name: 'AI-Powered Chat Interface with Database Storage',
  objectives: [
    'Create a React chat interface that uses OpenAI GPT-4o-mini for responses',
    'Store conversation history in Supabase database',
    'Use Redux for state management',
    'Implement real-time updates using Supabase subscriptions'
  ],
  constraints: [
    'Must use TypeScript',
    'Must handle OpenAI API errors gracefully',
    'Must authenticate users with Supabase Auth',
    'Must follow React best practices'
  ],
  acceptance_criteria: [
    'Chat interface renders and sends messages to OpenAI',
    'Conversations persist in Supabase database',
    'User authentication works via Supabase Auth',
    'Redux manages chat state correctly',
    'Real-time updates work for multi-user conversations'
  ]
};

async function main() {
  console.log('🧪 Testing Bootstrap + Requirement Analyzer Integration\n');
  console.log('Project: multi-llm-discussion-v1');
  console.log('Expected Services: OpenAI GPT-4o-mini, Supabase\n');
  console.log('---\n');

  try {
    console.log('📝 Decomposing spec with service requirements...\n');

    const decomposition = await architectService.decomposeSpec(testSpec, {
      projectId,
      generateWireframes: false,
      generateContracts: false
    });

    console.log('\n✅ Decomposition complete!\n');
    console.log('=== RESULTS ===\n');
    console.log(`Total work orders: ${decomposition.work_orders.length}`);

    // Check bootstrap WO
    const firstWO = decomposition.work_orders[0];
    const isBootstrap = firstWO.title.toLowerCase().includes('bootstrap') ||
                        firstWO.title.toLowerCase().includes('infrastructure');

    if (isBootstrap) {
      console.log('\n✅ BOOTSTRAP WO DETECTED!');
      console.log(`   Title: ${firstWO.title}`);
      console.log(`   Files: ${firstWO.files_in_scope.join(', ')}`);
      console.log(`   Dependencies: [${firstWO.dependencies.join(', ')}]\n`);

      // Check for service requirements in description
      const hasOpenAI = firstWO.description.toLowerCase().includes('openai');
      const hasSupabase = firstWO.description.toLowerCase().includes('supabase');
      const hasEnvSection = firstWO.description.includes('Environment Variables');

      console.log('🔍 Service Integration Check:');
      console.log(`   Contains .env.example section: ${hasEnvSection ? '✅' : '❌'}`);
      console.log(`   Mentions OpenAI: ${hasOpenAI ? '✅' : '❌'}`);
      console.log(`   Mentions Supabase: ${hasSupabase ? '✅' : '❌'}\n`);

      // Show environment variables section
      const envSectionStart = firstWO.description.indexOf('## Environment Variables');
      if (envSectionStart !== -1) {
        const envSectionEnd = firstWO.description.indexOf('##', envSectionStart + 5);
        const envSection = envSectionEnd !== -1
          ? firstWO.description.substring(envSectionStart, envSectionEnd)
          : firstWO.description.substring(envSectionStart);

        console.log('📄 Environment Variables Section:');
        console.log('---');
        console.log(envSection);
        console.log('---\n');
      }

      // Check acceptance criteria
      const envCriteria = firstWO.acceptance_criteria.filter(c =>
        c.toLowerCase().includes('env') || c.toLowerCase().includes('service')
      );

      if (envCriteria.length > 0) {
        console.log('✅ Service-Related Acceptance Criteria:');
        envCriteria.forEach(c => console.log(`   - ${c}`));
        console.log('');
      }

    } else {
      console.log('❌ BOOTSTRAP WO NOT FOUND');
      console.log(`   First WO: ${firstWO.title}\n`);
    }

    console.log('\n=== DECOMPOSITION DOC HEADER ===\n');
    console.log(decomposition.decomposition_doc.substring(0, 600) + '...\n');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
