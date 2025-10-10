/**
 * Complete Setup - Part 2
 *
 * Completes setup after directory/repo already created
 * Just does: Create project in DB + Submit tech spec
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import * as fs from 'fs';

const CONFIG = {
  projectName: 'multi-llm-discussion-v1',
  localPath: 'C:\\dev\\multi-llm-discussion-v1',
  githubOrg: 'AI-DevHouse',
  githubRepo: 'multi-llm-discussion-v1',
  budget: 150,
  techSpecPath: 'C:\\dev\\specs\\Multi-LLM Discussion App_Technical Specification_ v2.2.txt'
};

async function main() {
  console.log('🚀 Completing Setup - Part 2');
  console.log('==========================================\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Moose Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey);

  // Step 1: Create project in database
  console.log('💾 Step 1: Creating project in Moose database...');

  const repoFullName = `${CONFIG.githubOrg}/${CONFIG.githubRepo}`;
  const projectData = {
    name: CONFIG.projectName,
    local_path: CONFIG.localPath,
    github_org: CONFIG.githubOrg,
    github_repo_name: CONFIG.githubRepo,
    github_repo_url: `https://github.com/${repoFullName}.git`,
    default_branch: 'main',
    status: 'active' as const,
    setup_notes: {
      created_by: 'complete-setup.ts',
      tech_spec_path: CONFIG.techSpecPath,
      budget_total: CONFIG.budget,
      test_iteration: 1,
      purpose: 'First real production test - Electron desktop app',
      setup_method: 'manual_completion_after_partial_failure'
    }
  };

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert(projectData)
    .select()
    .single();

  if (projectError || !project) {
    console.error('❌ Failed to create project:', projectError);
    process.exit(1);
  }

  console.log(`✅ Project created: ${project.id}`);
  console.log(`   Name: ${project.name}`);
  console.log(`   Path: ${project.local_path}\n`);

  // Step 2: Read tech spec
  console.log('📄 Step 2: Reading technical specification...');

  if (!fs.existsSync(CONFIG.techSpecPath)) {
    console.error(`❌ Tech spec not found: ${CONFIG.techSpecPath}`);
    process.exit(1);
  }

  const techSpecContent = fs.readFileSync(CONFIG.techSpecPath, 'utf8');
  console.log(`✅ Tech spec loaded: ${techSpecContent.length} characters\n`);

  // Step 3: Submit to Architect
  console.log('🏗️  Step 3: Submitting to Architect for decomposition...');
  console.log('   (This may take 30-60 seconds...)\n');

  // Wrap the raw spec in structured format
  // Architect will parse the detailed spec and extract what it needs
  const architectPayload = {
    project_id: project.id,
    feature_name: `Multi-LLM Discussion App - Electron Desktop Application`,
    objectives: [
      "Parse and analyze the complete technical specification document below",
      "Create appropriate work orders based on the architecture and components described",
      "Follow the implementation priorities and phases outlined in the spec"
    ],
    constraints: [
      "Budget limit: $150 total",
      "Follow the technology stack and architecture defined in the spec",
      "Use the detailed component specifications as guidance for work order creation"
    ],
    acceptance_criteria: [
      "All work orders align with the technical specification",
      "Implementation follows the phased approach in the spec",
      "Build succeeds with zero TypeScript errors"
    ],
    budget_estimate: CONFIG.budget,
    time_estimate: "As specified in technical document",
    // Include the full spec as additional context
    technical_specification_document: techSpecContent
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
      console.error('❌ Architect API failed:', response.status, errorText);
      process.exit(1);
    }

    const result = await response.json();

    console.log('✅ Architect decomposition complete!');
    console.log(`✅ Work orders created: ${result.work_orders?.length || 0}\n`);

    if (result.work_orders && result.work_orders.length > 0) {
      console.log('📋 Work Orders Created:');
      result.work_orders.forEach((wo: any, idx: number) => {
        console.log(`   ${idx + 1}. ${wo.title}`);
      });
      console.log('');
    }
  } catch (error) {
    console.error('❌ Failed to submit to Architect:', error);
    console.error('   Make sure Next.js dev server is running: npm run dev');
    process.exit(1);
  }

  // Final summary
  console.log('🎉 Setup Complete!');
  console.log('==========================================');
  console.log(`✅ Local directory: ${CONFIG.localPath}`);
  console.log(`✅ GitHub repo: https://github.com/${repoFullName}`);
  console.log(`✅ Project ID: ${project.id}`);
  console.log(`✅ Work orders: Ready for orchestrator`);
  console.log('');
  console.log('🚀 Next Step:');
  console.log('   Start the orchestrator daemon:');
  console.log('');
  console.log('   powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/orchestrator-daemon.ts');
  console.log('');
}

main().catch(console.error);
