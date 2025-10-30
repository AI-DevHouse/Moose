export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300; // 5 minutes for bootstrap execution

// src/app/api/architect/resolve-conflicts/route.ts
// User has edited WO technical_requirements and wants to re-validate

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase';
import { aggregateRequirements } from '@/lib/bootstrap/requirements-aggregator';
import { BootstrapExecutor } from '@/lib/bootstrap/bootstrap-executor';
import { assessProjectMaturity } from '@/lib/orchestrator/project-inspector';
import { projectService } from '@/lib/project-service';
import { WorkOrder } from '@/types/architect';

/**
 * Re-validate technical requirements after user edits
 *
 * Flow:
 * 1. Fetch WOs by decomposition_id
 * 2. Re-aggregate requirements
 * 3. If still conflicts: return updated report
 * 4. If resolved: execute bootstrap (if greenfield), approve WOs
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServiceClient();

  try {
    const body = await request.json();
    const { decomposition_id } = body;

    if (!decomposition_id) {
      return NextResponse.json({
        success: false,
        error: 'decomposition_id is required'
      }, { status: 400 });
    }

    console.log(`[ResolveConflicts] Processing decomposition ${decomposition_id}`);

    // Step 1: Get decomposition metadata
    const { data: metadata, error: metaError } = await supabase
      .from('decomposition_metadata')
      .select('*')
      .eq('decomposition_id', decomposition_id)
      .single();

    if (metaError || !metadata) {
      return NextResponse.json({
        success: false,
        error: `Decomposition ${decomposition_id} not found`
      }, { status: 404 });
    }

    if (!metadata.has_conflicts) {
      return NextResponse.json({
        success: false,
        error: `Decomposition ${decomposition_id} has no conflicts to resolve`
      }, { status: 400 });
    }

    // Step 2: Fetch updated WOs from database
    const { data: workOrders, error: woError } = await supabase
      .from('work_orders')
      .select('*')
      .in('id', metadata.work_order_ids);

    if (woError || !workOrders) {
      return NextResponse.json({
        success: false,
        error: `Failed to fetch work orders: ${woError?.message}`
      }, { status: 500 });
    }

    console.log(`[ResolveConflicts] Re-aggregating requirements from ${workOrders.length} updated WOs`);

    // Step 3: Re-aggregate requirements
    const workOrdersForAggregation = workOrders.map(wo => ({
      title: wo.title,
      description: wo.description,
      acceptance_criteria: (Array.isArray(wo.acceptance_criteria) ? wo.acceptance_criteria : []) as string[],
      files_in_scope: (Array.isArray(wo.files_in_scope) ? wo.files_in_scope : []) as string[],
      context_budget_estimate: wo.context_budget_estimate || 2000,
      risk_level: wo.risk_level as any,
      dependencies: (wo.metadata as any)?.dependencies || [],
      technical_requirements: wo.technical_requirements as any
    } as WorkOrder));

    const { requirements, report } = await aggregateRequirements(workOrdersForAggregation);

    // Step 4: Check if conflicts are resolved
    if (report.critical.length > 0) {
      console.error('[ResolveConflicts] ❌ Conflicts still exist after user edits');

      // Update conflict report with new results
      await supabase
        .from('decomposition_metadata')
        .update({
          conflict_report: report as any,
          aggregated_requirements: requirements as any,
          updated_at: new Date().toISOString()
        })
        .eq('decomposition_id', decomposition_id);

      return NextResponse.json({
        success: false,
        conflicts_remain: true,
        conflict_report: report,
        message: 'Conflicts still exist. Please review and update work orders again.'
      }, { status: 400 });
    }

    console.log('[ResolveConflicts] ✅ Conflicts resolved!');

    // Step 5: Execute bootstrap if needed
    const project = await projectService.getProject(metadata.project_id);
    if (!project) {
      return NextResponse.json({
        success: false,
        error: 'Project not found'
      }, { status: 404 });
    }
    const maturity = assessProjectMaturity(project.local_path);

    let bootstrapResult = null;
    const bootstrapNeeded = maturity.is_greenfield;

    if (bootstrapNeeded) {
      console.log('[ResolveConflicts] Executing bootstrap...');

      const executor = new BootstrapExecutor();
      bootstrapResult = await executor.execute(
        project.local_path,
        requirements,
        maturity,
        metadata.project_id
      );

      if (!bootstrapResult.success) {
        console.error('[ResolveConflicts] Bootstrap failed');

        await supabase
          .from('decomposition_metadata')
          .update({
            bootstrap_executed: true,
            bootstrap_result: bootstrapResult as any
          })
          .eq('decomposition_id', decomposition_id);

        return NextResponse.json({
          success: false,
          bootstrap_failed: true,
          error_message: bootstrapResult.error_message,
          validation_errors: bootstrapResult.validation_errors
        }, { status: 500 });
      }

      console.log(`[ResolveConflicts] Bootstrap complete: ${bootstrapResult.commit_hash}`);
    }

    // Step 6: Approve WOs for orchestrator
    await supabase
      .from('work_orders')
      .update({ status: 'approved' })
      .in('id', metadata.work_order_ids);

    // Update metadata
    await supabase
      .from('decomposition_metadata')
      .update({
        has_conflicts: false,
        conflicts_resolved_at: new Date().toISOString(),
        conflict_report: report as any, // Updated report with warnings only
        aggregated_requirements: requirements as any,
        bootstrap_needed: bootstrapNeeded,
        bootstrap_executed: bootstrapNeeded,
        bootstrap_commit_hash: bootstrapResult?.commit_hash,
        bootstrap_result: bootstrapResult as any
      })
      .eq('decomposition_id', decomposition_id);

    console.log('[ResolveConflicts] ✅ Complete - WOs approved');

    return NextResponse.json({
      success: true,
      conflicts_resolved: true,
      work_orders_approved: metadata.work_order_ids.length,
      bootstrap_executed: bootstrapNeeded,
      bootstrap_commit: bootstrapResult?.commit_hash,
      bootstrap_branch: bootstrapResult?.branch_name,
      bootstrap_time_ms: bootstrapResult?.execution_time_ms,
      warnings: report.warnings,
      next_action: 'start_orchestrator'
    }, { status: 200 });

  } catch (error: any) {
    console.error('[ResolveConflicts] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
