// Dependency Resolver - Topological sort for Work Order execution sequencing

import type { WorkOrder } from './types';

/**
 * Resolves work order dependencies and returns execution order
 *
 * Uses topological sort (Kahn's algorithm) to determine safe execution order:
 * - Work orders with no dependencies execute first
 * - Work orders only execute after all dependencies complete
 * - Detects circular dependencies
 *
 * Dependencies are stored in work_orders.metadata.dependencies as array of WO IDs
 * Example: {"dependencies": ["wo-id-1", "wo-id-2"]}
 *
 * @param workOrders - Array of pending work orders
 * @param completedWorkOrderIds - Set of already completed WO IDs
 * @returns Array of work orders that can execute now (all dependencies met)
 */
export function getExecutableWorkOrders(
  workOrders: WorkOrder[],
  completedWorkOrderIds: Set<string>
): WorkOrder[] {
  // Extract dependencies from metadata
  const workOrdersWithDeps = workOrders.map(wo => ({
    workOrder: wo,
    dependencies: extractDependencies(wo)
  }));

  // Filter to only work orders where ALL dependencies are completed
  const executable = workOrdersWithDeps.filter(({ dependencies }) => {
    if (dependencies.length === 0) {
      // No dependencies = can execute immediately
      return true;
    }

    // Check if ALL dependencies are completed
    return dependencies.every(depId => completedWorkOrderIds.has(depId));
  });

  return executable.map(({ workOrder }) => workOrder);
}

/**
 * Extract dependencies from work order metadata
 *
 * Supports multiple formats:
 * - metadata.dependencies: ["wo-id-1", "wo-id-2"] (preferred)
 * - metadata.dependency_ids: ["wo-id-1"] (legacy)
 * - metadata.depends_on: ["wo-id-1"] (alternative)
 *
 * @param workOrder - Work order to extract dependencies from
 * @returns Array of dependency work order IDs (empty if no dependencies)
 */
function extractDependencies(workOrder: WorkOrder): string[] {
  const metadata = workOrder.metadata || {};

  // Try different metadata field names
  const deps = metadata.dependencies ||
               metadata.dependency_ids ||
               metadata.depends_on ||
               [];

  // Ensure it's an array of strings
  if (!Array.isArray(deps)) {
    console.warn(`[DependencyResolver] Invalid dependencies format for WO ${workOrder.id}:`, deps);
    return [];
  }

  return deps.filter((dep: any) => typeof dep === 'string');
}

/**
 * Get all completed work order IDs from database
 *
 * Queries work_orders table for status = 'completed' or 'approved' (if skipped)
 *
 * @param supabase - Supabase client
 * @returns Set of completed work order IDs
 */
export async function getCompletedWorkOrderIds(supabase: any): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('work_orders')
      .select('id')
      .in('status', ['completed', 'merged']); // 'merged' = PR merged successfully

    if (error) {
      console.error('[DependencyResolver] Error fetching completed work orders:', error);
      throw new Error(`Failed to fetch completed work orders: ${error.message}`);
    }

    const ids = (data || []).map((wo: { id: string }) => wo.id);
    return new Set(ids);
  } catch (error) {
    console.error('[DependencyResolver] Unexpected error:', error);
    throw error;
  }
}

/**
 * Validate work order dependencies (detect cycles, missing dependencies)
 *
 * Used by Architect API to validate decomposition before storing
 *
 * @param workOrders - Array of work orders from Architect
 * @returns Validation result with errors
 */
export function validateDependencies(workOrders: Array<{
  id?: string;
  title: string;
  dependencies: string[];
}>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Build ID to index map
  const idMap = new Map<string, number>();
  workOrders.forEach((wo, index) => {
    if (wo.id) {
      idMap.set(wo.id, index);
    }
  });

  // Check for circular dependencies using DFS
  const visited = new Set<number>();
  const recursionStack = new Set<number>();

  function hasCycle(index: number): boolean {
    if (recursionStack.has(index)) {
      return true; // Cycle detected
    }
    if (visited.has(index)) {
      return false; // Already checked this path
    }

    visited.add(index);
    recursionStack.add(index);

    const wo = workOrders[index];
    for (const depId of wo.dependencies || []) {
      const depIndex = idMap.get(depId);
      if (depIndex === undefined) {
        // Dependency references unknown work order
        errors.push(`Work order "${wo.title}" depends on unknown WO ID: ${depId}`);
        continue;
      }

      if (hasCycle(depIndex)) {
        errors.push(`Circular dependency detected involving: ${wo.title}`);
        recursionStack.delete(index);
        return true;
      }
    }

    recursionStack.delete(index);
    return false;
  }

  // Check all work orders for cycles
  for (let i = 0; i < workOrders.length; i++) {
    if (!visited.has(i)) {
      hasCycle(i);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get dependency visualization (for debugging/logging)
 *
 * Returns a string showing dependency graph:
 * WO-0: No dependencies
 * WO-1: Depends on WO-0
 * WO-2: Depends on WO-0, WO-1
 *
 * @param workOrders - Array of work orders
 * @returns Multi-line string visualization
 */
export function visualizeDependencies(workOrders: WorkOrder[]): string {
  const lines = workOrders.map(wo => {
    const deps = extractDependencies(wo);
    if (deps.length === 0) {
      return `${wo.id} (${wo.title}): No dependencies`;
    }
    return `${wo.id} (${wo.title}): Depends on [${deps.join(', ')}]`;
  });

  return lines.join('\n');
}
