import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const bootstrapWOId = '14b6ea23-2554-42c2-ae5f-ca90084863ed';

  const featureWOs = [
    'ca89cf28', // Error Handling
    '0e11d4c2', // Electron Multi-Process
    'a2909860', // OpenAI API
    '4e4c7480', // Discussion View
    '036f0989', // React Application
  ];

  console.log('\n✅ Adding bootstrap dependency to feature WOs:\n');

  // Fetch all WOs
  const { data: allWOs, error: fetchError } = await supabase
    .from('work_orders')
    .select('id, title, metadata');

  if (fetchError || !allWOs) {
    console.error('Error fetching WOs:', fetchError);
    return;
  }

  for (const woIdShort of featureWOs) {
    const wo = allWOs.find(w => w.id.startsWith(woIdShort));
    if (!wo) {
      console.error(`❌ WO ${woIdShort} not found`);
      continue;
    }

    // Update metadata to include bootstrap dependency
    const currentMetadata = wo.metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      dependencies: [bootstrapWOId]
    };

    const { error: updateError } = await supabase
      .from('work_orders')
      .update({ metadata: updatedMetadata })
      .eq('id', wo.id);

    if (updateError) {
      console.error(`❌ Error updating ${woIdShort}:`, updateError.message);
    } else {
      console.log(`✅ ${woIdShort}... - ${wo.title}`);
      console.log(`   Added dependency: ${bootstrapWOId.substring(0, 8)}...`);
    }
  }

  console.log('\n🎯 DEPENDENCY CHAIN ESTABLISHED:');
  console.log('   1. Bootstrap WO (no dependencies) → executes immediately');
  console.log('   2. Bootstrap completes → status = "completed"');
  console.log('   3. Feature WOs (depend on bootstrap) → now executable');
  console.log('   4. Feature WOs execute → builds succeed (infrastructure ready)\n');
}

main();
