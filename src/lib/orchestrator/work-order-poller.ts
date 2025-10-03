// Work Order Poller - Queries Supabase for pending approved Work Orders

import { createSupabaseServiceClient } from '@/lib/supabase';
import type { WorkOrder } from './types';

/**
 * Polls the work_orders table for pending Work Orders that have been approved by Director
 *
 * Query criteria:
 * - status = 'pending'
 * - metadata->>'approved_by_director' = 'true' (or auto_approved = true in metadata)
 * - Order by created_at ASC (FIFO)
 * - Limit 10 per poll
 *
 * @returns Array of pending Work Orders ready for execution
 */
export async function pollPendingWorkOrders(): Promise<WorkOrder[]> {
  const supabase = createSupabaseServiceClient();

  try {
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) {
      console.error('[WorkOrderPoller] Query error:', error);
      throw new Error(`Failed to poll work orders: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Filter for approved Work Orders
    // Check metadata for auto_approved=true (from Director)
    const approvedWorkOrders = data.filter((wo: any) => {
      const metadata = wo.metadata || {};
      return metadata.auto_approved === true ||
             metadata.approved_by_director === true ||
             metadata.director_approved === true; // Support both field names
    });

    console.log(`[WorkOrderPoller] Found ${approvedWorkOrders.length} approved Work Orders out of ${data.length} pending`);

    return approvedWorkOrders as WorkOrder[];
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
