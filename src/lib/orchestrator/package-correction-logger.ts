// Package Correction Logger - Audit trail for package version corrections
// Provides transparency and debugging for automatic package corrections

import { createSupabaseServiceClient } from '@/lib/supabase';
import type { PackageCorrection } from './package-validator';

// ============================================================================
// Types
// ============================================================================

export interface CorrectionLogEntry {
  id: string;
  project_id: string;
  work_order_id: string;
  package_name: string;
  old_version: string;
  new_version: string;
  correction_reason: string;
  source_work_order_id: string | null;
  confidence_level: string;
  validated_at: string;
  execution_context: string;
  metadata: {
    source_wo_title?: string;
    dependency_type?: string;
  };
}

export interface CorrectionHistory {
  total_corrections: number;
  by_reason: Record<string, number>;
  by_confidence: Record<string, number>;
  recent_corrections: CorrectionLogEntry[];
}

// ============================================================================
// Logging Functions
// ============================================================================

/**
 * Log a package correction to the audit table
 *
 * @param projectId - Project ID
 * @param workOrderId - Work Order ID being corrected
 * @param correction - Correction details
 * @param context - Execution context (e.g., 'pre_proposer', 'bootstrap')
 */
export async function logPackageCorrection(
  projectId: string,
  workOrderId: string,
  correction: PackageCorrection,
  context: 'pre_proposer' | 'bootstrap' | 'manual_audit'
): Promise<void> {
  const supabase = createSupabaseServiceClient();

  try {
    const { error } = await supabase
      .from('package_version_corrections')
      .insert({
        project_id: projectId,
        work_order_id: workOrderId,
        package_name: correction.packageName,
        old_version: correction.oldVersion,
        new_version: correction.newVersion,
        correction_reason: correction.reason,
        source_work_order_id: correction.sourceWoId || null,
        confidence_level: correction.confidence,
        execution_context: context,
        metadata: {
          source_wo_title: correction.sourceWoTitle,
          dependency_type: correction.dependencyType
        }
      });

    if (error) {
      console.error('[CorrectionLogger] Failed to log correction:', error);
      // Don't throw - logging failure shouldn't block execution
    } else {
      console.log(`[CorrectionLogger] ✅ Logged correction: ${correction.packageName} ${correction.oldVersion}→${correction.newVersion}`);
    }
  } catch (err: any) {
    console.error('[CorrectionLogger] Unexpected error logging correction:', err.message);
    // Don't throw - logging failure shouldn't block execution
  }
}

/**
 * Log multiple corrections in batch
 *
 * @param projectId - Project ID
 * @param workOrderId - Work Order ID
 * @param corrections - Array of corrections
 * @param context - Execution context
 */
export async function logPackageCorrections(
  projectId: string,
  workOrderId: string,
  corrections: PackageCorrection[],
  context: 'pre_proposer' | 'bootstrap' | 'manual_audit'
): Promise<void> {
  if (corrections.length === 0) return;

  const supabase = createSupabaseServiceClient();

  try {
    const entries = corrections.map(correction => ({
      project_id: projectId,
      work_order_id: workOrderId,
      package_name: correction.packageName,
      old_version: correction.oldVersion,
      new_version: correction.newVersion,
      correction_reason: correction.reason,
      source_work_order_id: correction.sourceWoId || null,
      confidence_level: correction.confidence,
      execution_context: context,
      metadata: {
        source_wo_title: correction.sourceWoTitle,
        dependency_type: correction.dependencyType
      }
    }));

    const { error } = await supabase
      .from('package_version_corrections')
      .insert(entries);

    if (error) {
      console.error('[CorrectionLogger] Failed to log batch corrections:', error);
    } else {
      console.log(`[CorrectionLogger] ✅ Logged ${corrections.length} corrections for WO ${workOrderId}`);
    }
  } catch (err: any) {
    console.error('[CorrectionLogger] Unexpected error logging batch:', err.message);
  }
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get correction history for a project
 *
 * @param projectId - Project ID
 * @param limit - Max number of recent corrections to return (default 50)
 * @returns Correction history with stats and recent entries
 */
export async function getProjectCorrectionHistory(
  projectId: string,
  limit: number = 50
): Promise<CorrectionHistory> {
  const supabase = createSupabaseServiceClient();

  try {
    const { data, error } = await supabase
      .from('package_version_corrections')
      .select('*')
      .eq('project_id', projectId)
      .order('validated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[CorrectionLogger] Failed to fetch correction history:', error);
      throw new Error(`Failed to fetch correction history: ${error.message}`);
    }

    const corrections = (data || []) as CorrectionLogEntry[];

    // Calculate stats
    const byReason: Record<string, number> = {};
    const byConfidence: Record<string, number> = {};

    for (const correction of corrections) {
      byReason[correction.correction_reason] = (byReason[correction.correction_reason] || 0) + 1;
      byConfidence[correction.confidence_level] = (byConfidence[correction.confidence_level] || 0) + 1;
    }

    return {
      total_corrections: corrections.length,
      by_reason: byReason,
      by_confidence: byConfidence,
      recent_corrections: corrections
    };

  } catch (err: any) {
    console.error('[CorrectionLogger] Unexpected error fetching history:', err.message);
    throw err;
  }
}

/**
 * Get corrections for a specific work order
 *
 * @param workOrderId - Work Order ID
 * @returns Array of corrections for this WO
 */
export async function getWorkOrderCorrections(
  workOrderId: string
): Promise<CorrectionLogEntry[]> {
  const supabase = createSupabaseServiceClient();

  try {
    const { data, error } = await supabase
      .from('package_version_corrections')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('validated_at', { ascending: false });

    if (error) {
      console.error('[CorrectionLogger] Failed to fetch WO corrections:', error);
      throw new Error(`Failed to fetch WO corrections: ${error.message}`);
    }

    return (data || []) as CorrectionLogEntry[];

  } catch (err: any) {
    console.error('[CorrectionLogger] Unexpected error fetching WO corrections:', err.message);
    throw err;
  }
}

/**
 * Get all corrections for a specific package across the project
 *
 * @param projectId - Project ID
 * @param packageName - Package name
 * @returns Array of corrections for this package
 */
export async function getPackageCorrectionHistory(
  projectId: string,
  packageName: string
): Promise<CorrectionLogEntry[]> {
  const supabase = createSupabaseServiceClient();

  try {
    const { data, error } = await supabase
      .from('package_version_corrections')
      .select('*')
      .eq('project_id', projectId)
      .eq('package_name', packageName)
      .order('validated_at', { ascending: false });

    if (error) {
      console.error('[CorrectionLogger] Failed to fetch package corrections:', error);
      throw new Error(`Failed to fetch package corrections: ${error.message}`);
    }

    return (data || []) as CorrectionLogEntry[];

  } catch (err: any) {
    console.error('[CorrectionLogger] Unexpected error fetching package corrections:', err.message);
    throw err;
  }
}

/**
 * Get most frequently corrected packages for a project
 *
 * @param projectId - Project ID
 * @param limit - Max number of packages to return (default 10)
 * @returns Array of packages sorted by correction frequency
 */
export async function getMostCorrectedPackages(
  projectId: string,
  limit: number = 10
): Promise<Array<{ package_name: string; correction_count: number }>> {
  const supabase = createSupabaseServiceClient();

  try {
    const { data, error } = await supabase
      .from('package_version_corrections')
      .select('package_name')
      .eq('project_id', projectId);

    if (error) {
      console.error('[CorrectionLogger] Failed to fetch corrections:', error);
      throw new Error(`Failed to fetch corrections: ${error.message}`);
    }

    // Count occurrences
    const counts = new Map<string, number>();
    for (const row of (data || [])) {
      const pkg = (row as any).package_name;
      counts.set(pkg, (counts.get(pkg) || 0) + 1);
    }

    // Sort and limit
    const sorted = Array.from(counts.entries())
      .map(([package_name, correction_count]) => ({ package_name, correction_count }))
      .sort((a, b) => b.correction_count - a.correction_count)
      .slice(0, limit);

    return sorted;

  } catch (err: any) {
    console.error('[CorrectionLogger] Unexpected error calculating frequency:', err.message);
    throw err;
  }
}
