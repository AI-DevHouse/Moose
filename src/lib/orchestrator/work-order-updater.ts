// Work Order Updater - Safely update WO technical requirements in database
// Handles package corrections and metadata updates

import { createSupabaseServiceClient } from '@/lib/supabase';
import type { TechnicalRequirements } from '@/types/architect';
import { logPackageCorrections } from './package-correction-logger';
import type { PackageCorrection } from './package-validator';

// ============================================================================
// Update Functions
// ============================================================================

/**
 * Update work order's technical requirements with corrected packages
 *
 * @param woId - Work Order ID
 * @param projectId - Project ID (for audit logging)
 * @param correctedRequirements - Corrected technical requirements
 * @param corrections - Array of corrections made (for audit logging)
 * @param context - Execution context
 */
export async function updateWorkOrderPackages(
  woId: string,
  projectId: string,
  correctedRequirements: TechnicalRequirements,
  corrections: PackageCorrection[],
  context: 'pre_proposer' | 'bootstrap' | 'manual_audit'
): Promise<void> {
  const supabase = createSupabaseServiceClient();

  try {
    // First, get existing metadata
    const { data: woData, error: fetchError } = await supabase
      .from('work_orders')
      .select('metadata')
      .eq('id', woId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch WO metadata: ${fetchError.message}`);
    }

    const existingMetadata = (woData?.metadata && typeof woData.metadata === 'object' && !Array.isArray(woData.metadata))
      ? woData.metadata as Record<string, any>
      : {};

    // Build correction summary for metadata
    const correctionSummary = corrections.map(c => ({
      package: c.packageName,
      from: c.oldVersion,
      to: c.newVersion,
      reason: c.reason,
      confidence: c.confidence
    }));

    // Update WO with corrected requirements and metadata
    const { error: updateError } = await supabase
      .from('work_orders')
      .update({
        technical_requirements: correctedRequirements as any,
        metadata: {
          ...existingMetadata,
          package_validation: {
            last_validated_at: new Date().toISOString(),
            corrections_applied: corrections.length,
            auto_corrected: true,
            validation_context: context,
            corrections: correctionSummary
          }
        }
      })
      .eq('id', woId);

    if (updateError) {
      throw new Error(`Failed to update WO: ${updateError.message}`);
    }

    console.log(`[WOUpdater] ✅ Updated WO ${woId} with ${corrections.length} package corrections`);

    // Log corrections to audit table (async, don't await)
    logPackageCorrections(projectId, woId, corrections, context)
      .catch(err => {
        console.error('[WOUpdater] Failed to log corrections to audit table:', err);
      });

  } catch (error: any) {
    console.error('[WOUpdater] Failed to update work order packages:', error);
    throw error;
  }
}

/**
 * Mark work order as having package validation applied
 * (For cases where validation passed with no corrections)
 *
 * @param woId - Work Order ID
 * @param context - Execution context
 */
export async function markWorkOrderValidated(
  woId: string,
  context: 'pre_proposer' | 'bootstrap' | 'manual_audit'
): Promise<void> {
  const supabase = createSupabaseServiceClient();

  try {
    // Get existing metadata
    const { data: woData, error: fetchError } = await supabase
      .from('work_orders')
      .select('metadata')
      .eq('id', woId)
      .single();

    if (fetchError) {
      console.warn(`[WOUpdater] Failed to fetch WO metadata for validation mark: ${fetchError.message}`);
      return; // Don't throw - this is non-critical
    }

    const existingMetadata = (woData?.metadata && typeof woData.metadata === 'object' && !Array.isArray(woData.metadata))
      ? woData.metadata as Record<string, any>
      : {};

    // Update metadata to indicate validation occurred
    const { error: updateError } = await supabase
      .from('work_orders')
      .update({
        metadata: {
          ...existingMetadata,
          package_validation: {
            last_validated_at: new Date().toISOString(),
            corrections_applied: 0,
            auto_corrected: false,
            validation_context: context
          }
        }
      })
      .eq('id', woId);

    if (updateError) {
      console.warn(`[WOUpdater] Failed to mark WO as validated: ${updateError.message}`);
      // Don't throw - this is non-critical metadata
    }

  } catch (error: any) {
    console.warn('[WOUpdater] Unexpected error marking WO as validated:', error.message);
    // Don't throw - this is non-critical
  }
}

/**
 * Get package validation metadata for a work order
 *
 * @param woId - Work Order ID
 * @returns Package validation metadata or null if not validated
 */
export async function getWorkOrderValidationMetadata(
  woId: string
): Promise<{
  last_validated_at: string;
  corrections_applied: number;
  auto_corrected: boolean;
  validation_context: string;
  corrections?: Array<{
    package: string;
    from: string;
    to: string;
    reason: string;
    confidence: string;
  }>;
} | null> {
  const supabase = createSupabaseServiceClient();

  try {
    const { data, error } = await supabase
      .from('work_orders')
      .select('metadata')
      .eq('id', woId)
      .single();

    if (error) {
      console.error('[WOUpdater] Failed to fetch WO metadata:', error);
      return null;
    }

    const metadata = (data?.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata))
      ? data.metadata as Record<string, any>
      : {};

    return metadata.package_validation || null;

  } catch (error: any) {
    console.error('[WOUpdater] Unexpected error fetching validation metadata:', error.message);
    return null;
  }
}
