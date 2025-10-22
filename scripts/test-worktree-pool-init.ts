#!/usr/bin/env ts-node
/**
 * Test Worktree Pool Initialization
 *
 * Measures:
 * - Pool initialization time (target: <5 min)
 * - Disk usage (target: ≤2GB)
 * - Successful creation of all 15 worktrees
 */

import { WorktreePoolManager } from '../src/lib/orchestrator/worktree-pool';
import { projectService } from '../src/lib/project-service';
import { execSync } from 'child_process';
import * as fs from 'fs';

async function testPoolInitialization() {
  console.log('🧪 Worktree Pool Initialization Test');
  console.log('=====================================\n');

  const poolSize = parseInt(process.env.WORKTREE_POOL_SIZE || '15', 10);
  console.log(`Target pool size: ${poolSize} worktrees\n`);

  try {
    // Get target project
    const projects = await projectService.listProjects('active');
    const targetProject = projects.find(p => p.name === 'multi-llm-discussion-v1');

    if (!targetProject) {
      throw new Error('Target project "multi-llm-discussion-v1" not found');
    }

    console.log(`Project: ${targetProject.name}`);
    console.log(`Path: ${targetProject.local_path}\n`);

    // Measure disk usage before
    const diskUsageBefore = getDiskUsage(targetProject.local_path);
    console.log(`Disk usage (before): ${(diskUsageBefore / 1024 / 1024).toFixed(2)} MB\n`);

    // Initialize pool
    const worktreePool = WorktreePoolManager.getInstance();
    console.log('Starting pool initialization...\n');

    const startTime = Date.now();
    await worktreePool.initialize(targetProject, poolSize);
    const endTime = Date.now();

    const initTimeMs = endTime - startTime;
    const initTimeSec = (initTimeMs / 1000).toFixed(1);
    const initTimeMin = (initTimeMs / 60000).toFixed(2);

    console.log(`\n✅ Pool initialization complete!`);
    console.log(`\n📊 Metrics:`);
    console.log(`  - Initialization time: ${initTimeSec}s (${initTimeMin} min)`);
    console.log(`  - Target: <300s (5 min)`);
    console.log(`  - Status: ${initTimeMs < 300000 ? '✅ PASS' : '⚠️  OVER TARGET'}`);

    // Measure disk usage after
    const diskUsageAfter = getDiskUsage(targetProject.local_path);
    const diskUsageDelta = diskUsageAfter - diskUsageBefore;
    const diskUsageMB = (diskUsageDelta / 1024 / 1024).toFixed(2);
    const diskUsageGB = (diskUsageDelta / 1024 / 1024 / 1024).toFixed(3);

    console.log(`\n  - Disk usage (after): ${(diskUsageAfter / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  - Disk usage (delta): ${diskUsageMB} MB (${diskUsageGB} GB)`);
    console.log(`  - Target: ≤2 GB`);
    console.log(`  - Status: ${diskUsageDelta < 2 * 1024 * 1024 * 1024 ? '✅ PASS' : '⚠️  OVER TARGET'}`);

    // Check pool status
    const status = worktreePool.getStatus();
    console.log(`\n  - Total worktrees: ${status.total}`);
    console.log(`  - Available: ${status.available}`);
    console.log(`  - Leased: ${status.leased}`);
    console.log(`  - Status: ${status.total === poolSize ? '✅ PASS' : '❌ FAIL'}`);

    // Cleanup
    console.log('\n🧹 Cleaning up pool...');
    await worktreePool.cleanup();
    console.log('✅ Cleanup complete\n');

    // Summary
    console.log('=====================================');
    console.log('📋 Test Summary:');
    console.log(`  ✅ Pool initialized in ${initTimeSec}s (${initTimeMin} min)`);
    console.log(`  ✅ ${status.total}/${poolSize} worktrees created`);
    console.log(`  ${diskUsageDelta < 2 * 1024 * 1024 * 1024 ? '✅' : '⚠️'} Disk usage: ${diskUsageMB} MB (${diskUsageGB} GB)`);
    console.log('=====================================\n');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Get disk usage for a directory (in bytes)
 */
function getDiskUsage(dirPath: string): number {
  try {
    if (process.platform === 'win32') {
      // Windows: use dir /s command
      const output = execSync(`dir /s "${dirPath}" | findstr "bytes"`, { encoding: 'utf-8' });
      const match = output.match(/(\d+)\s+bytes/);
      return match ? parseInt(match[1], 10) : 0;
    } else {
      // Unix: use du command
      const output = execSync(`du -sb "${dirPath}"`, { encoding: 'utf-8' });
      const size = parseInt(output.split('\t')[0], 10);
      return size;
    }
  } catch (error) {
    console.warn('Warning: Could not measure disk usage:', error);
    return 0;
  }
}

// Run test
testPoolInitialization().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
