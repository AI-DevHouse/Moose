// Decompose spec with services, insert WOs, and approve bootstrap WO-0
import { createClient } from '@supabase/supabase-js';
import { batchedArchitectService } from '../src/lib/batched-architect-service';
import type { TechnicalSpec } from '../src/types/architect';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'; // multi-llm-discussion-v1

// Simple spec mentioning OpenAI
const testSpec: TechnicalSpec = {
  feature_name: 'Simple Chat Interface',
  objectives: [
    'Create a basic React chat UI',
    'Connect to OpenAI GPT-4o-mini API',
    'Display chat messages'
  ],
  constraints: [
    'Must use TypeScript',
    'Must use React',
    'Must handle API errors'
  ],
  acceptance_criteria: [
    'Chat interface renders',
    'OpenAI integration works',
    'Messages display correctly'
  ]
};

async function main() {
  console.log('🚀 Decompose + Approve Bootstrap WO\n');
  console.log('Project: multi-llm-discussion-v1\n');

  // Step 1: Decompose
  console.log('📝 Decomposing spec...');
  const decomposition = await batchedArchitectService.decompose(testSpec, {
    projectId,
    generateWireframes: false,
    generateContracts: false
  });

  console.log(`✅ Generated ${decomposition.work_orders.length} work orders\n`);

  // Check if bootstrap exists
  const hasBootstrap = decomposition.work_orders[0].title.toLowerCase().includes('bootstrap');
  if (!hasBootstrap) {
    console.log('❌ No bootstrap WO detected - unexpected!');
    process.exit(1);
  }

  console.log(`✅ Bootstrap WO detected: "${decomposition.work_orders[0].title}"\n`);

  // Step 2: Insert WOs into database
  console.log('💾 Saving work orders to database...');

  const workOrdersToInsert = decomposition.work_orders.map((wo: any) => ({
    title: wo.title,
    description: wo.description,
    risk_level: wo.risk_level || 'low',
    status: 'pending',
    proposer_id: 'a40c5caf-b0fb-4a8b-a544-ca82bb2ab939', // claude-sonnet-4-5
    estimated_cost: wo.estimated_cost || 0,
    pattern_confidence: wo.pattern_confidence || 0.5,
    acceptance_criteria: wo.acceptance_criteria || [],
    files_in_scope: wo.files_in_scope || [],
    context_budget_estimate: wo.context_budget_estimate || 2000,
    decomposition_doc: decomposition.decomposition_doc || null,
    project_id: projectId,
    metadata: {
      auto_approved: false // Will approve manually
    }
  }));

  const { data: savedWOs, error: insertError } = await supabase
    .from('work_orders')
    .insert(workOrdersToInsert)
    .select();

  if (insertError) {
    console.error('Failed to save work orders:', insertError);
    throw new Error(`Failed to save work orders: ${insertError.message}`);
  }

  console.log(`✅ Saved ${savedWOs.length} work orders\n`);

  // Step 3: Convert dependencies to UUIDs
  console.log('🔗 Converting dependencies to UUIDs...');
  const dependencyUpdates = [];

  for (let i = 0; i < decomposition.work_orders.length; i++) {
    const originalWO = decomposition.work_orders[i];
    const savedWO = savedWOs[i];

    const deps = originalWO.dependencies || [];
    if (deps.length > 0) {
      const dependencyUUIDs = deps.map((depIndex: string) => {
        const depIndexNum = parseInt(depIndex);
        if (isNaN(depIndexNum) || depIndexNum >= savedWOs.length) {
          return null;
        }
        return savedWOs[depIndexNum].id;
      }).filter((id: string | null): id is string => id !== null);

      if (dependencyUUIDs.length > 0) {
        dependencyUpdates.push({
          id: savedWO.id,
          metadata: {
            ...(savedWO.metadata || {}),
            dependencies: dependencyUUIDs
          }
        });
      }
    }
  }

  for (const update of dependencyUpdates) {
    await supabase
      .from('work_orders')
      .update({ metadata: update.metadata })
      .eq('id', update.id);
  }

  console.log(`✅ Updated ${dependencyUpdates.length} work orders with dependencies\n`);

  // Step 4: Approve ONLY bootstrap WO-0
  const bootstrapWO = savedWOs[0];
  console.log(`✅ Approving bootstrap WO-0: ${bootstrapWO.title}`);
  console.log(`   ID: ${bootstrapWO.id}\n`);

  const { error: approveError } = await supabase
    .from('work_orders')
    .update({
      status: 'approved',
      metadata: {
        ...(bootstrapWO.metadata || {}),
        auto_approved: false,
        approved_at: new Date().toISOString(),
        approved_by: 'test-script'
      }
    })
    .eq('id', bootstrapWO.id);

  if (approveError) {
    console.error('Failed to approve bootstrap WO:', approveError);
    throw new Error(`Failed to approve: ${approveError.message}`);
  }

  console.log('✅ Bootstrap WO-0 approved!\n');
  console.log('📋 Summary:');
  console.log(`   Total WOs created: ${savedWOs.length}`);
  console.log(`   Bootstrap WO ID: ${bootstrapWO.id}`);
  console.log(`   Feature WOs: ${savedWOs.length - 1} (pending)\n`);

  console.log('📄 Bootstrap WO Files:');
  bootstrapWO.files_in_scope.forEach((file: string) => console.log(`   - ${file}`));
  console.log('');

  console.log('🎯 Next: Start orchestrator daemon to execute bootstrap WO');
  console.log('   Command: npm run orchestrator:daemon\n');
}

main();
