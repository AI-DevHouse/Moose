// Analyze WO dependency graph for cycles and critical path

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface WorkOrder {
  id: string;
  title: string;
  status: string;
  metadata: any;
  created_at: string;
  project_id?: string;
}

// Fetch all WOs for the project
async function fetchWorkOrders(projectNameOrIds?: string): Promise<WorkOrder[]> {
  const { data, error } = await supabase
    .from('work_orders')
    .select('id, title, status, metadata, created_at, project_id')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch work orders: ${error.message}`);
  }

  if (!projectNameOrIds) {
    // Return all WOs if no filter provided
    return data || [];
  }

  // Check if it's a comma-separated list of WO IDs
  if (projectNameOrIds.includes(',')) {
    const woIds = projectNameOrIds.split(',').map(id => id.trim());
    return (data || []).filter(wo =>
      woIds.some(id => wo.id.startsWith(id))
    );
  }

  // Otherwise filter by project_id containing the project name
  return (data || []).filter(wo =>
    wo.project_id && wo.project_id.includes(projectNameOrIds)
  );
}

// Extract dependencies from metadata
function getDependencies(wo: WorkOrder): string[] {
  const metadata = wo.metadata || {};
  const deps = metadata.dependencies || metadata.dependency_ids || metadata.depends_on || [];
  return Array.isArray(deps) ? deps : [];
}

// Detect circular dependencies using DFS
function detectCircularDependencies(workOrders: WorkOrder[]): {
  hasCircles: boolean;
  cycles: string[][];
} {
  const woMap = new Map<string, WorkOrder>();
  workOrders.forEach(wo => woMap.set(wo.id, wo));

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];
  const currentPath: string[] = [];

  function dfs(woId: string): boolean {
    if (recursionStack.has(woId)) {
      // Found a cycle - extract it from currentPath
      const cycleStart = currentPath.indexOf(woId);
      const cycle = currentPath.slice(cycleStart).concat(woId);
      cycles.push(cycle);
      return true;
    }

    if (visited.has(woId)) {
      return false; // Already explored this path
    }

    visited.add(woId);
    recursionStack.add(woId);
    currentPath.push(woId);

    const wo = woMap.get(woId);
    if (wo) {
      const deps = getDependencies(wo);
      for (const depId of deps) {
        if (woMap.has(depId)) {
          dfs(depId);
        }
      }
    }

    currentPath.pop();
    recursionStack.delete(woId);
    return false;
  }

  // Check all WOs for cycles
  for (const wo of workOrders) {
    if (!visited.has(wo.id)) {
      dfs(wo.id);
    }
  }

  return {
    hasCircles: cycles.length > 0,
    cycles
  };
}

// Calculate critical path (longest dependency chain)
function calculateCriticalPath(workOrders: WorkOrder[]): {
  depth: number;
  paths: string[][];
  rootNodes: string[];
  leafNodes: string[];
} {
  const woMap = new Map<string, WorkOrder>();
  workOrders.forEach(wo => woMap.set(wo.id, wo));

  // Find root nodes (no dependencies)
  const rootNodes = workOrders
    .filter(wo => getDependencies(wo).length === 0)
    .map(wo => wo.id);

  // Find leaf nodes (no dependents)
  const allDependencies = new Set<string>();
  workOrders.forEach(wo => {
    getDependencies(wo).forEach(dep => allDependencies.add(dep));
  });
  const leafNodes = workOrders
    .filter(wo => !allDependencies.has(wo.id))
    .map(wo => wo.id);

  // Calculate depth for each node using DFS
  const depthCache = new Map<string, number>();
  const pathCache = new Map<string, string[][]>();

  function getDepth(woId: string): number {
    if (depthCache.has(woId)) {
      return depthCache.get(woId)!;
    }

    const wo = woMap.get(woId);
    if (!wo) {
      return 0;
    }

    const deps = getDependencies(wo);
    if (deps.length === 0) {
      depthCache.set(woId, 0);
      pathCache.set(woId, [[woId]]);
      return 0;
    }

    let maxDepth = 0;
    let longestPaths: string[][] = [];

    for (const depId of deps) {
      const depDepth = getDepth(depId);
      if (depDepth + 1 > maxDepth) {
        maxDepth = depDepth + 1;
        longestPaths = (pathCache.get(depId) || []).map(path => [...path, woId]);
      } else if (depDepth + 1 === maxDepth) {
        longestPaths.push(...(pathCache.get(depId) || []).map(path => [...path, woId]));
      }
    }

    depthCache.set(woId, maxDepth);
    pathCache.set(woId, longestPaths);
    return maxDepth;
  }

  // Calculate depths for all nodes
  workOrders.forEach(wo => getDepth(wo.id));

  // Find maximum depth
  const maxDepth = Math.max(...Array.from(depthCache.values()));

  // Find all paths with maximum depth
  const criticalPaths: string[][] = [];
  for (const [woId, depth] of depthCache.entries()) {
    if (depth === maxDepth) {
      criticalPaths.push(...(pathCache.get(woId) || []));
    }
  }

  return {
    depth: maxDepth + 1, // +1 because depth is 0-indexed
    paths: criticalPaths,
    rootNodes,
    leafNodes
  };
}

// Analyze parallelism opportunities
function analyzeParallelism(workOrders: WorkOrder[]): {
  levels: Map<number, string[]>;
  maxParallelism: number;
} {
  const woMap = new Map<string, WorkOrder>();
  workOrders.forEach(wo => woMap.set(wo.id, wo));

  const levelMap = new Map<string, number>();

  function getLevel(woId: string): number {
    if (levelMap.has(woId)) {
      return levelMap.get(woId)!;
    }

    const wo = woMap.get(woId);
    if (!wo) {
      return 0;
    }

    const deps = getDependencies(wo);
    if (deps.length === 0) {
      levelMap.set(woId, 0);
      return 0;
    }

    const maxDepLevel = Math.max(...deps.map(depId => getLevel(depId)));
    const level = maxDepLevel + 1;
    levelMap.set(woId, level);
    return level;
  }

  // Calculate levels for all WOs
  workOrders.forEach(wo => getLevel(wo.id));

  // Group by level
  const levels = new Map<number, string[]>();
  for (const [woId, level] of levelMap.entries()) {
    if (!levels.has(level)) {
      levels.set(level, []);
    }
    levels.get(level)!.push(woId);
  }

  const maxParallelism = Math.max(...Array.from(levels.values()).map(wos => wos.length));

  return { levels, maxParallelism };
}

// Format WO for display
function formatWO(woId: string, woMap: Map<string, WorkOrder>): string {
  const wo = woMap.get(woId);
  if (!wo) return woId.substring(0, 8);
  return `WO-${woId.substring(0, 8)} (${wo.title})`;
}

// Main analysis
async function analyzeProject(projectName?: string) {
  console.log(`\n📊 Analyzing dependency graph${projectName ? ' for: ' + projectName : ''}\n`);

  const workOrders = await fetchWorkOrders(projectName);
  console.log(`Found ${workOrders.length} work orders\n`);

  if (workOrders.length === 0) {
    console.log('No work orders found.');
    return;
  }

  const woMap = new Map<string, WorkOrder>();
  workOrders.forEach(wo => woMap.set(wo.id, wo));

  // 1. Check for circular dependencies
  console.log('═══════════════════════════════════════════════════════════');
  console.log('1. CIRCULAR DEPENDENCY CHECK');
  console.log('═══════════════════════════════════════════════════════════\n');

  const circularCheck = detectCircularDependencies(workOrders);
  if (circularCheck.hasCircles) {
    console.log('❌ CIRCULAR DEPENDENCIES DETECTED!\n');
    circularCheck.cycles.forEach((cycle, i) => {
      console.log(`Cycle ${i + 1}:`);
      cycle.forEach(woId => console.log(`  → ${formatWO(woId, woMap)}`));
      console.log('');
    });
  } else {
    console.log('✅ No circular dependencies detected\n');
  }

  // 2. Critical path analysis
  console.log('═══════════════════════════════════════════════════════════');
  console.log('2. CRITICAL PATH ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════\n');

  const criticalPath = calculateCriticalPath(workOrders);
  console.log(`Longest dependency chain: ${criticalPath.depth} levels\n`);

  console.log(`Root nodes (no dependencies): ${criticalPath.rootNodes.length}`);
  criticalPath.rootNodes.forEach(woId => {
    console.log(`  • ${formatWO(woId, woMap)}`);
  });
  console.log('');

  console.log(`Leaf nodes (no dependents): ${criticalPath.leafNodes.length}`);
  criticalPath.leafNodes.forEach(woId => {
    console.log(`  • ${formatWO(woId, woMap)}`);
  });
  console.log('');

  if (criticalPath.paths.length > 0) {
    console.log(`Critical paths (${criticalPath.paths.length} found):`);
    criticalPath.paths.slice(0, 5).forEach((path, i) => {
      console.log(`\nPath ${i + 1}:`);
      path.forEach((woId, j) => {
        console.log(`  ${j + 1}. ${formatWO(woId, woMap)}`);
      });
    });
    if (criticalPath.paths.length > 5) {
      console.log(`\n... and ${criticalPath.paths.length - 5} more paths`);
    }
  }
  console.log('');

  // 3. Parallelism analysis
  console.log('═══════════════════════════════════════════════════════════');
  console.log('3. PARALLELISM OPPORTUNITIES');
  console.log('═══════════════════════════════════════════════════════════\n');

  const parallelism = analyzeParallelism(workOrders);
  console.log(`Maximum parallelism: ${parallelism.maxParallelism} WOs can execute concurrently\n`);

  console.log('Execution levels (WOs that can run in parallel):\n');
  const sortedLevels = Array.from(parallelism.levels.keys()).sort((a, b) => a - b);

  sortedLevels.forEach(level => {
    const wos = parallelism.levels.get(level)!;
    console.log(`Level ${level} (${wos.length} WOs):`);
    wos.forEach(woId => {
      const wo = woMap.get(woId)!;
      const deps = getDependencies(wo);
      const status = wo.status;
      console.log(`  • ${formatWO(woId, woMap)} [${status}]`);
      if (deps.length > 0) {
        console.log(`    Dependencies: ${deps.map(d => formatWO(d, woMap)).join(', ')}`);
      }
    });
    console.log('');
  });

  // 4. Summary statistics
  console.log('═══════════════════════════════════════════════════════════');
  console.log('4. SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  const totalWOs = workOrders.length;
  const wosWithDeps = workOrders.filter(wo => getDependencies(wo).length > 0).length;
  const wosWithoutDeps = totalWOs - wosWithDeps;
  const avgDepsPerWO = workOrders.reduce((sum, wo) => sum + getDependencies(wo).length, 0) / totalWOs;

  console.log(`Total work orders: ${totalWOs}`);
  console.log(`WOs with dependencies: ${wosWithDeps}`);
  console.log(`WOs without dependencies: ${wosWithoutDeps}`);
  console.log(`Average dependencies per WO: ${avgDepsPerWO.toFixed(2)}`);
  console.log(`Circular dependencies: ${circularCheck.hasCircles ? '❌ YES' : '✅ NO'}`);
  console.log(`Critical path length: ${criticalPath.depth} levels`);
  console.log(`Max concurrent execution: ${parallelism.maxParallelism} WOs`);
  console.log('');

  // Status breakdown
  const statusCounts = new Map<string, number>();
  workOrders.forEach(wo => {
    const status = wo.status || 'unknown';
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  });

  console.log('Status breakdown:');
  for (const [status, count] of statusCounts.entries()) {
    console.log(`  ${status}: ${count}`);
  }
  console.log('');
}

// Run analysis
const projectName = process.argv[2]; // Can be project name, WO IDs (comma-sep), or empty for all
analyzeProject(projectName).catch(console.error);
