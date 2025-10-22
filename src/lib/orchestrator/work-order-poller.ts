// Work Order Poller - Queries Supabase for pending approved Work Orders

import { createSupabaseServiceClient } from '@/lib/supabase';
import type { WorkOrder } from './types';
import {
  getExecutableWorkOrders,
  getCompletedWorkOrderIds,
  visualizeDependencies
} from './dependency-resolver';

/**
 * Polls the work_orders table for approved Work Orders ready for execution
 *
 * NEW Clean State Machine:
 * - Query: status = 'approved' (simple!)
 * - Dependency resolution: Only return WOs where all dependencies are completed
 * - Order by created_at ASC (FIFO for WOs with no dependencies)
 * - Limit 10 per poll
 *
 * State flow: pending → approved → in_progress → completed/failed/needs_review
 *
 * @returns Array of approved Work Orders ready for execution (dependencies satisfied)
 */
export async function pollPendingWorkOrders(): Promise<WorkOrder[]> {
  const supabase = createSupabaseServiceClient();

  try {
    // Simple query: just get approved WOs
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: true })
      .limit(50); // Increased limit to handle dependency chains

    if (error) {
      console.error('[WorkOrderPoller] Query error:', error);
      throw new Error(`Failed to poll work orders: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    const approvedWorkOrders = data as WorkOrder[];

    console.log(`[WorkOrderPoller] Found ${approvedWorkOrders.length} approved Work Orders`);

    // Apply dependency resolution
    const completedIds = await getCompletedWorkOrderIds(supabase);
    const executableWorkOrders = getExecutableWorkOrders(
      approvedWorkOrders as WorkOrder[],
      completedIds
    );

    // Log dependency visualization if any WOs have dependencies
    if (approvedWorkOrders.length > executableWorkOrders.length) {
      console.log('[WorkOrderPoller] Dependency Resolution:');
      console.log(visualizeDependencies(approvedWorkOrders as WorkOrder[]));
      console.log(`[WorkOrderPoller] ${executableWorkOrders.length}/${approvedWorkOrders.length} WOs ready (dependencies satisfied)`);
    }

    // Return top 10 executable work orders
    return executableWorkOrders.slice(0, 10);
  } catch (error) {
    console.error('[WorkOrderPoller] Unexpected error:', error);
    throw error;
  }
}

/**
 * Get a single Work Order by ID
 *
 * @param workOrderId - Work Order ID
 * @returns Work Order or null if not found
 */
export async function getWorkOrder(workOrderId: string): Promise<WorkOrder | null> {
  const supabase = createSupabaseServiceClient();

  try {
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('id', workOrderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw new Error(`Failed to get work order: ${error.message}`);
    }

    return data as WorkOrder;
  } catch (error) {
    console.error('[WorkOrderPoller] Error getting work order:', error);
    throw error;
  }
}
