// scripts/find-test-decomposition-candidate.ts
// Finds suitable project with 10-20 WOs for single-batch complexity test
// Per Implementation Plan V113 Task 2

import { config } from 'dotenv';
import { resolve } from 'path';
import { createSupabaseServiceClient } from '../src/lib/supabase';
import { writeFile } from 'fs/promises';

config({ path: resolve(__dirname, '../.env.local') });

const supabase = createSupabaseServiceClient();

interface ProjectCandidate {
  project_id: string;
  project_name: string;
  wo_count: number;
  pending_count: number;
  sample_wos: Array<{
    id: string;
    title: string;
    files_count: number;
    criteria_count: number;
    risk_level: string;
    status: string;
  }>;
}

async function main() {
  console.log('🔍 Finding test decomposition candidates...\n');

  // Query all projects with their WO counts
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, name');

  if (projectsError) {
    console.error('❌ Failed to query projects:', projectsError.message);
    process.exit(1);
  }

  console.log(`Found ${projects?.length || 0} projects, analyzing WO counts...\n`);

  const candidates: ProjectCandidate[] = [];

  for (const project of projects || []) {
    // Count WOs for this project
    const { data: wos, error: wosError } = await supabase
      .from('work_orders')
      .select('id, title, files_in_scope, acceptance_criteria, risk_level, status')
      .eq('project_id', project.id);

    if (wosError || !wos) continue;

    const woCount = wos.length;
    const pendingCount = wos.filter(w => w.status === 'pending').length;

    // Filter: 10-20 total WOs, at least 5 pending
    if (woCount >= 10 && woCount <= 20 && pendingCount >= 5) {
      const sampleWos = wos.slice(0, 10).map(wo => ({
        id: wo.id,
        title: wo.title,
        files_count: Array.isArray(wo.files_in_scope) ? wo.files_in_scope.length : 0,
        criteria_count: Array.isArray(wo.acceptance_criteria) ? wo.acceptance_criteria.length : 0,
        risk_level: wo.risk_level,
        status: wo.status
      }));

      candidates.push({
        project_id: project.id,
        project_name: project.name,
        wo_count: woCount,
        pending_count: pendingCount,
        sample_wos: sampleWos
      });
    }
  }

  if (candidates.length === 0) {
    console.log('❌ No suitable projects found with 10-20 WOs');
    console.log('   Relaxing criteria to find any projects with pending WOs...\n');

    // Fallback: find projects with at least 5 WOs
    for (const project of projects || []) {
      const { data: wos, error: wosError } = await supabase
        .from('work_orders')
        .select('id, title, files_in_scope, acceptance_criteria, risk_level, status')
        .eq('project_id', project.id);

      if (wosError || !wos) continue;

      const woCount = wos.length;
      const pendingCount = wos.filter(w => w.status === 'pending').length;

      if (woCount >= 5 && pendingCount >= 5) {
        const sampleWos = wos.slice(0, 10).map(wo => ({
          id: wo.id,
          title: wo.title,
          files_count: Array.isArray(wo.files_in_scope) ? wo.files_in_scope.length : 0,
          criteria_count: Array.isArray(wo.acceptance_criteria) ? wo.acceptance_criteria.length : 0,
          risk_level: wo.risk_level,
          status: wo.status
        }));

        candidates.push({
          project_id: project.id,
          project_name: project.name,
          wo_count: woCount,
          pending_count: pendingCount,
          sample_wos: sampleWos
        });
      }
    }
  }

  // Sort by closest to ideal count (15 WOs)
  candidates.sort((a, b) => {
    const aDiff = Math.abs(a.wo_count - 15);
    const bDiff = Math.abs(b.wo_count - 15);
    return aDiff - bDiff;
  });

  console.log(`Found ${candidates.length} candidate project(s):\n`);

  for (const candidate of candidates.slice(0, 5)) {
    console.log('─'.repeat(60));
    console.log(`Project: ${candidate.project_name}`);
    console.log(`Project ID: ${candidate.project_id}`);
    console.log(`Total WOs: ${candidate.wo_count}`);
    console.log(`Pending WOs: ${candidate.pending_count}`);

    console.log(`\nSample WOs (first 5):`);
    for (const wo of candidate.sample_wos.slice(0, 5)) {
      console.log(`  - ${wo.title.substring(0, 50)}...`);
      console.log(`    Files: ${wo.files_count}, Criteria: ${wo.criteria_count}, Risk: ${wo.risk_level}, Status: ${wo.status}`);
    }
    console.log('');
  }

  if (candidates.length > 0) {
    const selected = candidates[0];

    console.log('='.repeat(60));
    console.log(`✅ Selected project: ${selected.project_name}`);
    console.log(`   Project ID: ${selected.project_id}`);
    console.log(`   Total WOs: ${selected.wo_count}`);
    console.log(`   Pending WOs: ${selected.pending_count}`);

    // Save results
    const evidenceDir = resolve(__dirname, '../docs/session_updates/evidence/v113');
    const outputPath = resolve(evidenceDir, 'test-batch-selection.json');

    try {
      await writeFile(
        outputPath,
        JSON.stringify({
          selected_project: selected,
          all_candidates: candidates,
          selection_criteria: {
            ideal_wo_count: '10-20',
            minimum_pending: 5,
            selected_reason: 'Closest to ideal count of 15 WOs'
          },
          timestamp: new Date().toISOString()
        }, null, 2)
      );

      console.log(`\n📁 Results saved to: ${outputPath}`);
    } catch (error: any) {
      console.warn(`⚠️  Could not save results: ${error.message}`);
      console.log('   (Evidence directory may not exist yet)');
    }
  } else {
    console.log('❌ No suitable projects found');
    process.exit(1);
  }
}

main().catch(console.error);
