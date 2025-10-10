/**
 * Setup Real Project - Multi-LLM Discussion v1
 *
 * Creates everything needed for a fresh project:
 * 1. Local directory
 * 2. Git repository
 * 3. GitHub repository
 * 4. Project in Moose Supabase
 * 5. Submits technical spec to Architect
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const CONFIG = {
  projectName: 'multi-llm-discussion-v1',
  localPath: 'C:\\dev\\multi-llm-discussion-v1',
  githubOrg: 'AI-DevHouse',
  githubRepo: 'multi-llm-discussion-v1',
  budget: 150,

  // New Supabase project for the app (not Moose's operational Supabase)
  appSupabase: {
    url: 'https://czwzmvrsfcuexudqiscr.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6d3ptdnJzZmN1ZXh1ZHFpc2NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMTk2MDUsImV4cCI6MjA3NTU5NTYwNX0.dkxn7tMsztyL7IPLLSj7o8xQ_5mo4FdSeoc7UPjI8Ek',
    serviceKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6d3ptdnJzZmN1ZXh1ZHFpc2NyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDAxOTYwNSwiZXhwIjoyMDc1NTk1NjA1fQ.tZ950QRS7yHF8NZEMdHLCpsSd2b3aPvwsc-D6p0GGDU'
  }
};

// Technical Specification
const TECH_SPEC = {
  feature_name: "Multi-LLM Discussion System",
  objectives: [
    "Enable multiple LLMs to participate in collaborative discussions",
    "Support Claude Sonnet, GPT-4, and other models",
    "Provide web interface for viewing discussions in real-time",
    "Store discussion history in Supabase database",
    "Allow users to create discussion topics",
    "Route messages to appropriate LLMs based on context",
    "Display AI responses with model attribution",
    "Support threaded conversations",
    "Enable users to vote on AI responses",
    "Provide analytics on model performance"
  ],
  constraints: [
    "Must use Next.js 14 with App Router",
    "Must use TypeScript with strict mode",
    "Must use Supabase for database and real-time subscriptions",
    "Must use Tailwind CSS for styling",
    "Budget limit: $150 total",
    "Should follow modern React patterns (Server Components where appropriate)",
    "Must implement proper error handling and loading states",
    "Must be responsive (mobile + desktop)",
    "Code must pass TypeScript compilation with zero errors",
    "Must implement proper authentication (optional - can be basic)",
    `Use this Supabase project: ${CONFIG.appSupabase.url}`,
    `Include these environment variables in .env.local:`,
    `NEXT_PUBLIC_SUPABASE_URL=${CONFIG.appSupabase.url}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${CONFIG.appSupabase.anonKey}`,
    `SUPABASE_SERVICE_ROLE_KEY=${CONFIG.appSupabase.serviceKey}`,
    "Must include Anthropic and OpenAI API integrations"
  ],
  acceptance_criteria: [
    "Users can create a new discussion topic with a title and initial prompt",
    "System routes prompts to multiple LLMs (Claude + GPT-4)",
    "Multiple LLMs can respond to the same prompt",
    "Discussion history is persisted in Supabase",
    "Web UI displays discussions in real-time using Supabase subscriptions",
    "Users can view past discussions",
    "API endpoints exist for creating/reading discussions and messages",
    "TypeScript types defined for all data structures",
    "Build succeeds with zero TypeScript errors",
    "Basic error handling implemented (try/catch, error boundaries)",
    "Loading states shown during API calls",
    "Responsive design works on mobile and desktop",
    "Model attribution shown for each AI response",
    "Users can start new discussion threads",
    "Database schema includes tables: discussions, messages, models",
    "README.md with setup instructions exists"
  ],
  budget_estimate: 150,
  time_estimate: "3-4 hours",
  complexity: "medium-high"
};

async function main() {
  console.log('🚀 Multi-LLM Discussion v1 - Setup Script');
  console.log('==========================================\n');

  // Connect to Moose's operational Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Moose Supabase credentials in .env.local');
    console.error('   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
    process.exit(1);
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey);

  // Step 1: Create local directory
  console.log('📁 Step 1: Creating local directory...');
  if (fs.existsSync(CONFIG.localPath)) {
    console.error(`❌ Directory already exists: ${CONFIG.localPath}`);
    console.error('   Please delete it first or choose a different path.');
    process.exit(1);
  }

  fs.mkdirSync(CONFIG.localPath, { recursive: true });
  console.log(`✅ Created: ${CONFIG.localPath}\n`);

  // Step 2: Initialize git
  console.log('🔧 Step 2: Initializing git repository...');
  try {
    execSync('git init', {
      cwd: CONFIG.localPath,
      stdio: 'inherit',
      shell: true,
      windowsHide: true
    });
    execSync('git checkout -b main', {
      cwd: CONFIG.localPath,
      stdio: 'inherit',
      shell: true,
      windowsHide: true
    });

    // Create .gitignore
    const gitignore = `node_modules/
.next/
.env
.env.local
.env*.local
dist/
build/
*.log
.DS_Store
.vercel
`;
    fs.writeFileSync(path.join(CONFIG.localPath, '.gitignore'), gitignore);

    console.log('✅ Git initialized on main branch\n');
  } catch (error) {
    console.error('❌ Git initialization failed:', error);
    process.exit(1);
  }

  // Step 3: Create GitHub repository
  console.log('🐙 Step 3: Creating GitHub repository...');
  const repoFullName = `${CONFIG.githubOrg}/${CONFIG.githubRepo}`;

  try {
    // Check if repo already exists
    try {
      execSync(`gh repo view ${repoFullName}`, {
        stdio: 'pipe',
        shell: true,
        windowsHide: true
      });
      console.error(`❌ GitHub repository already exists: ${repoFullName}`);
      console.error('   Please delete it first or choose a different name.');
      process.exit(1);
    } catch {
      // Repo doesn't exist, good to proceed
    }

    // Create the repo
    execSync(`gh repo create ${repoFullName} --private --clone=false`, {
      stdio: 'inherit',
      shell: true,
      windowsHide: true
    });

    const repoUrl = `https://github.com/${repoFullName}.git`;

    // Add remote
    execSync(`git remote add origin ${repoUrl}`, {
      cwd: CONFIG.localPath,
      stdio: 'inherit',
      shell: true,
      windowsHide: true
    });

    console.log(`✅ GitHub repo created: https://github.com/${repoFullName}`);
    console.log(`✅ Remote added: ${repoUrl}\n`);
  } catch (error) {
    console.error('❌ GitHub repository creation failed:', error);
    console.error('   Make sure gh CLI is authenticated: gh auth status');
    process.exit(1);
  }

  // Step 4: Create project in Moose Supabase
  console.log('💾 Step 4: Creating project in Moose database...');

  const projectData = {
    name: CONFIG.projectName,
    local_path: CONFIG.localPath,
    github_org: CONFIG.githubOrg,
    github_repo_name: CONFIG.githubRepo,
    github_repo_url: `https://github.com/${repoFullName}.git`,
    default_branch: 'main',
    status: 'active' as const,
    setup_notes: {
      created_by: 'setup-real-project.ts',
      tech_spec_path: CONFIG.techSpecPath,
      budget_total: CONFIG.budget,
      test_iteration: 1,
      purpose: 'First real production test - Electron desktop app'
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

  console.log(`✅ Project created in database: ${project.id}`);
  console.log(`   Name: ${project.name}`);
  console.log(`   Path: ${project.local_path}\n`);

  // Step 5: Read technical specification from file
  console.log('📄 Step 5: Reading technical specification...');

  if (!fs.existsSync(CONFIG.techSpecPath)) {
    console.error(`❌ Tech spec not found: ${CONFIG.techSpecPath}`);
    process.exit(1);
  }

  const techSpecContent = fs.readFileSync(CONFIG.techSpecPath, 'utf8');
  console.log(`✅ Tech spec loaded: ${techSpecContent.length} characters\n`);

  // Step 6: Submit technical spec to Architect
  console.log('🏗️  Step 6: Submitting technical spec to Architect...');
  console.log('   (Architect will analyze and decompose into work orders)');

  const architectPayload = {
    project_id: project.id,
    technical_spec: techSpecContent  // Pass raw content - let Architect parse it
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

    console.log('✅ Technical spec submitted to Architect');
    console.log(`✅ Work orders created: ${result.work_orders?.length || 0}\n`);

    if (result.work_orders && result.work_orders.length > 0) {
      console.log('📋 Work Orders:');
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
  console.log(`✅ Budget: $${CONFIG.budget}`);
  console.log(`✅ Work orders: Ready for orchestrator`);
  console.log('');
  console.log('🚀 Next Step:');
  console.log('   Start the orchestrator daemon:');
  console.log('');
  console.log('   powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/orchestrator-daemon.ts');
  console.log('');
}

main().catch(console.error);
