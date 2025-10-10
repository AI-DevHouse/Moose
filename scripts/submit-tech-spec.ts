/**
 * Submit Tech Spec Only
 *
 * Submits tech spec to Architect for an existing project
 */

import * as fs from 'fs';

const CONFIG = {
  projectId: 'f73e8c9f-1d78-4251-8fb6-a070fd857951',  // From previous run
  budget: 150,
  techSpecPath: 'C:\\dev\\specs\\Multi-LLM Discussion App_Technical Specification_ v2.2.txt'
};

async function main() {
  console.log('🏗️  Submitting Tech Spec to Architect');
  console.log('==========================================\n');

  // Read tech spec
  console.log('📄 Reading technical specification...');

  if (!fs.existsSync(CONFIG.techSpecPath)) {
    console.error(`❌ Tech spec not found: ${CONFIG.techSpecPath}`);
    process.exit(1);
  }

  const techSpecContent = fs.readFileSync(CONFIG.techSpecPath, 'utf8');
  console.log(`✅ Loaded: ${techSpecContent.length} characters\n`);

  // Submit to Architect
  console.log('🏗️  Submitting to Architect...');
  console.log('   (Spec preprocessor will handle the large document...)\n');
  console.log('   This may take 2-5 minutes to parse sections and decompose...\n');

  // Pass raw technical spec content directly
  // Architect API will detect it's >10K chars and use spec preprocessor automatically
  const architectPayload = {
    project_id: CONFIG.projectId,
    spec: techSpecContent  // Raw document - preprocessor will parse and decompose
  };

  try {
    const response = await fetch('http://localhost:3000/api/architect/decompose', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(architectPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Architect API failed:', response.status);
      console.error(errorText);
      process.exit(1);
    }

    const result = await response.json();

    console.log('✅ Architect decomposition complete!');
    console.log(`✅ Work orders created: ${result.work_orders_created || 0}\n`);

    if (result.work_orders && result.work_orders.length > 0) {
      console.log('📋 Work Orders Created:');
      result.work_orders.forEach((wo: any, idx: number) => {
        console.log(`   ${idx + 1}. ${wo.title}`);
      });
      console.log('');
    }

    console.log('🎉 Ready for Orchestrator!');
    console.log('==========================================');
    console.log(`Project ID: ${CONFIG.projectId}`);
    console.log(`Work Orders: ${result.work_orders_created || 0}`);
    console.log(`Total Estimated Cost: $${result.total_estimated_cost || 0}`);
    console.log('');
    console.log('🚀 Next: Start orchestrator daemon');
    console.log('   powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/orchestrator-daemon.ts');

  } catch (error) {
    console.error('❌ Failed to submit to Architect:', error);
    console.error('   Make sure Next.js dev server is running: npm run dev');
    process.exit(1);
  }
}

main().catch(console.error);
