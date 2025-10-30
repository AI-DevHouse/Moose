export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300; // 5 minutes for bootstrap execution

// src/app/api/architect/decompose/route.ts
// UPDATED: Integrates bootstrap pre-execution with conflict detection

import { NextRequest, NextResponse} from 'next/server';
import { randomUUID } from 'crypto';
import { batchedArchitectService } from '@/lib/batched-architect-service';
import type { TechnicalSpec } from '@/types/architect';
import { withRateLimit, architectApiLimiter } from '@/lib/rate-limiter';
import { validateTechnicalSpec, securityCheck } from '@/lib/input-sanitizer';
import { projectService } from '@/lib/project-service';
import { createSupabaseServiceClient } from '@/lib/supabase';
import { aggregateRequirements } from '@/lib/bootstrap/requirements-aggregator';
import { BootstrapExecutor } from '@/lib/bootstrap/bootstrap-executor';
import { assessProjectMaturity } from '@/lib/orchestrator/project-inspector';
import { specPreprocessor } from '@/lib/spec-preprocessor';

export async function POST(request: NextRequest) {
  // Apply rate limiting
  return withRateLimit(request, architectApiLimiter, async () => {
    const supabase = createSupabaseServiceClient();

    try {
      const body = await request.json();

      // Extract project_id (required)
      const projectId = body.project_id;
      if (!projectId) {
        return NextResponse.json({
          success: false,
          error: 'project_id is required'
        }, { status: 400 });
      }

      // Extract spec and options
      let specData: any;
      let wireframesFlag = false;
      let contractsFlag = false;

      if (body.spec) {
        specData = body.spec;
        wireframesFlag = body.options?.generateWireframes ?? body.generateWireframes ?? false;
        contractsFlag = body.options?.generateContracts ?? body.generateContracts ?? false;
      } else {
        specData = body;
        wireframesFlag = false;
        contractsFlag = false;
      }

      // Validate project exists
      const project = await projectService.getProject(projectId);
      if (!project) {
        return NextResponse.json({
          success: false,
          error: `Project not found: ${projectId}`
        }, { status: 404 });
      }

      // Generate unique decomposition ID
      const decompositionId = randomUUID();
      console.log(`[Decompose] Starting decomposition ${decompositionId}`);

      // Check if spec needs preprocessing
      const isRawDocument = typeof specData === 'string';
      const needsPreprocessing = isRawDocument && specPreprocessor.needsPreprocessing(specData);

      let allWorkOrders: any[] = [];
      let combinedDecompositionDoc = '';
      let totalCost = 0;

      if (needsPreprocessing) {
        console.log('\n🔄 Large document detected - using spec preprocessor...');
        console.log(`   Document size: ${specData.length} characters\n`);

        // Preprocess: Split document into sections
        const sections = await specPreprocessor.preprocess(specData, {
          document_title: project.name
        });

        console.log(`\n📦 Processing ${sections.length} sections through Architect...\n`);

        const sectionWorkOrders: Map<string, any[]> = new Map();

        // Process each section
        for (let i = 0; i < sections.length; i++) {
          const section = sections[i];
          console.log(`\n--- Section ${i + 1}/${sections.length}: ${section.title} ---`);

          const sectionSpec = validateTechnicalSpec(section.technical_spec);

          const secCheck = securityCheck(sectionSpec.feature_name);
          if (!secCheck.safe) {
            console.warn(`⚠️  Section ${section.section_number} flagged: ${secCheck.threats.join(', ')}`);
            console.warn(`   Skipping section for security reasons\n`);
            continue;
          }

          const decomposition = await batchedArchitectService.decompose(
            sectionSpec as TechnicalSpec,
            {
              generateWireframes: wireframesFlag,
              generateContracts: contractsFlag,
              projectId: projectId
            }
          );

          // Save work orders with status='pending_review' and decomposition_id
          const workOrdersToInsert = decomposition.work_orders.map((wo: any) => ({
            title: wo.title,
            description: wo.description,
            risk_level: wo.risk_level || 'low',
            status: 'pending_review', // NEW: Not approved yet
            proposer_id: wo.proposer_id || 'a40c5caf-b0fb-4a8b-a544-ca82bb2ab939',
            estimated_cost: wo.estimated_cost || 0,
            pattern_confidence: wo.pattern_confidence || 0.5,
            acceptance_criteria: wo.acceptance_criteria || [],
            files_in_scope: wo.files_in_scope || [],
            context_budget_estimate: wo.context_budget_estimate || 2000,
            decomposition_doc: `Section ${i + 1}: ${section.title}\n\n${decomposition.decomposition_doc || ''}`,
            project_id: projectId,
            technical_requirements: wo.technical_requirements, // NEW FIELD
            metadata: {
              decomposition_id: decompositionId,
              section_number: section.section_number,
              wo_index_in_section: wo.dependencies || []
            }
          }));

          const { data: savedWOs, error: saveError } = await supabase
            .from('work_orders')
            .insert(workOrdersToInsert)
            .select();

          if (saveError) {
            console.error(`Failed to save work orders for section ${section.section_number}:`, saveError);
            throw new Error(`Failed to save work orders: ${saveError.message}`);
          }

          console.log(`💾 Saved ${savedWOs.length} work orders (pending_review)`);

          sectionWorkOrders.set(section.section_number, savedWOs);
          allWorkOrders.push(...savedWOs);
          totalCost += decomposition.total_estimated_cost || 0;
          combinedDecompositionDoc += `\n## Section ${i + 1}: ${section.title}\n\n${decomposition.decomposition_doc || ''}\n`;

          console.log(`✅ Section ${i + 1} complete: ${savedWOs.length} work orders\n`);
        }

        // Add cross-section dependencies
        console.log('🔗 Adding cross-section dependencies...');
        for (let i = 0; i < sections.length; i++) {
          const section = sections[i];
          const workOrders = sectionWorkOrders.get(section.section_number) || [];

          for (const wo of workOrders) {
            const existingDeps = wo.metadata?.dependencies || [];

            for (const depSectionNum of section.dependencies) {
              const depWorkOrders = sectionWorkOrders.get(depSectionNum) || [];
              existingDeps.push(...depWorkOrders.map(depWo => depWo.id));
            }

            const uniqueDeps = Array.from(new Set(existingDeps));

            if (uniqueDeps.length > 0) {
              await supabase
                .from('work_orders')
                .update({
                  metadata: {
                    ...wo.metadata,
                    dependencies: uniqueDeps
                  }
                })
                .eq('id', wo.id);
            }
          }
        }

        console.log(`📊 Total: ${allWorkOrders.length} work orders from ${sections.length} sections\n`);

      } else {
        // Standard flow: single spec
        console.log('\n📄 Processing single technical specification...\n');

        const spec = validateTechnicalSpec(specData);

        const secCheck = securityCheck(spec.feature_name);
        if (!secCheck.safe) {
          return NextResponse.json({
            success: false,
            error: `Security threat detected: ${secCheck.threats.join(', ')}`,
          }, { status: 400 });
        }

        // Decompose spec
        const decomposition = await batchedArchitectService.decompose(
          spec as TechnicalSpec,
          {
            generateWireframes: wireframesFlag,
            generateContracts: contractsFlag,
            projectId: projectId
          }
        );

        console.log(`[Decompose] Architect generated ${decomposition.work_orders.length} work orders`);

        // Save work orders with status='pending_review'
        const workOrdersToInsert = decomposition.work_orders.map((wo: any, index: number) => ({
          title: wo.title,
          description: wo.description,
          risk_level: wo.risk_level || 'low',
          status: 'pending_review', // NEW: Not approved yet
          proposer_id: wo.proposer_id || 'a40c5caf-b0fb-4a8b-a544-ca82bb2ab939',
          estimated_cost: wo.estimated_cost || 0,
          pattern_confidence: wo.pattern_confidence || 0.5,
          acceptance_criteria: wo.acceptance_criteria || [],
          files_in_scope: wo.files_in_scope || [],
          context_budget_estimate: wo.context_budget_estimate || 2000,
          decomposition_doc: decomposition.decomposition_doc || null,
          project_id: projectId,
          technical_requirements: wo.technical_requirements, // NEW FIELD
          metadata: {
            decomposition_id: decompositionId,
            wo_index: index,
            original_dependencies: wo.dependencies || []
          }
        }));

        const { data: savedWOs, error: insertError } = await supabase
          .from('work_orders')
          .insert(workOrdersToInsert)
          .select();

        if (insertError) {
          console.error('Failed to save work orders:', insertError);
          throw new Error(`Failed to save work orders: ${insertError.message}`);
        }

        // Convert array-index dependencies to UUIDs
        const dependencyUpdates = [];
        for (let i = 0; i < decomposition.work_orders.length; i++) {
          const originalWO = decomposition.work_orders[i];
          const savedWO = savedWOs[i];

          const deps = originalWO.dependencies || [];

          if (deps.length > 0) {
            const dependencyUUIDs = deps.map((depIndex: string) => {
              const depIndexNum = parseInt(depIndex);
              if (isNaN(depIndexNum) || depIndexNum >= savedWOs.length) {
                console.warn(`Invalid dependency index "${depIndex}" for WO ${savedWO.title}`);
                return null;
              }
              return savedWOs[depIndexNum].id;
            }).filter((id: string | null): id is string => id !== null);

            if (dependencyUUIDs.length > 0) {
              const existingMetadata = (savedWO.metadata && typeof savedWO.metadata === 'object' && !Array.isArray(savedWO.metadata))
                ? savedWO.metadata as Record<string, any>
                : {};
              dependencyUpdates.push({
                id: savedWO.id,
                metadata: {
                  ...existingMetadata,
                  dependencies: dependencyUUIDs
                }
              });
            }
          }
        }

        if (dependencyUpdates.length > 0) {
          for (const update of dependencyUpdates) {
            await supabase
              .from('work_orders')
              .update({ metadata: update.metadata })
              .eq('id', update.id);
          }
          console.log(`✅ Updated ${dependencyUpdates.length} work orders with dependency UUIDs`);
        }

        allWorkOrders = savedWOs;
        combinedDecompositionDoc = decomposition.decomposition_doc || '';
        totalCost = decomposition.total_estimated_cost || 0;
      }

      // ========================================================================
      // NEW: Validate packages with architect self-correction
      // ========================================================================

      console.log('[Decompose] Validating packages with architect self-correction...');

      const { validateWorkOrderSetWithArchitectCorrection } = await import('@/lib/architect-package-validator');

      // Fetch active proposer config (prioritize Anthropic, fall back to first active)
      const { data: proposerConfigs, error: proposerError } = await supabase
        .from('proposer_configs')
        .select('provider, model')
        .eq('active', true)
        .order('created_at');

      if (proposerError || !proposerConfigs || proposerConfigs.length === 0) {
        console.error('[Decompose] Failed to fetch proposer config:', proposerError);
        return NextResponse.json({
          success: false,
          error: 'No active proposer configuration found. Please configure a proposer in settings.'
        }, { status: 500 });
      }

      // Prefer Anthropic provider, otherwise use first active config
      const proposerConfig = proposerConfigs.find(p => p.provider === 'anthropic') || proposerConfigs[0];
      const { provider, model } = proposerConfig;

      console.log(`[Decompose] Using ${provider}/${model} for package corrections`);

      const specForCorrection = typeof specData === 'string' ? specData : JSON.stringify(specData);

      const validationResult = await validateWorkOrderSetWithArchitectCorrection(
        allWorkOrders as any,
        projectId,
        provider,
        model,
        specForCorrection
      );

      // Handle validation failures (packages that architect couldn't fix)
      if (!validationResult.allValid) {
        console.error(`[Decompose] ❌ ${validationResult.failedWOs} WOs failed validation after architect correction`);

        // Update failed WOs to blocked status
        const failedWOIds = validationResult.failures.map(f => f.woId);
        await supabase
          .from('work_orders')
          .update({ status: 'blocked_by_conflicts' })
          .in('id', failedWOIds);

        // Return validation failure with details
        return NextResponse.json({
          success: false,
          blocked_by_validation: true,
          error: `Package validation failed for ${validationResult.failedWOs} work orders`,
          validation_summary: {
            total_wos: validationResult.totalWOs,
            valid_wos: validationResult.validWOs,
            corrected_wos: validationResult.correctedWOs,
            failed_wos: validationResult.failedWOs
          },
          failures: validationResult.failures,
          message: 'Some work orders have invalid packages that the architect could not auto-correct. Manual review required.',
          next_action: 'review_validation_failures'
        }, { status: 400 });
      }

      // Log successful validations/corrections
      if (validationResult.correctedWOs > 0) {
        console.log(`[Decompose] ✅ Architect auto-corrected ${validationResult.correctedWOs} WOs`);
        validationResult.corrections.forEach(c => {
          console.log(`   - "${c.woTitle}": ${c.packageCorrections} package corrections`);
        });

        // Refresh allWorkOrders with corrected data from database
        const { data: refreshedWOs } = await supabase
          .from('work_orders')
          .select('*')
          .in('id', allWorkOrders.map(wo => wo.id));

        if (refreshedWOs) {
          allWorkOrders = refreshedWOs;
        }
      } else {
        console.log(`[Decompose] ✅ All packages validated (no corrections needed)`);
      }

      // ========================================================================
      // Aggregate requirements and check for conflicts
      // ========================================================================

      console.log('[Decompose] Aggregating technical requirements...');

      // Convert stored WOs to architect format for aggregation
      const workOrdersForAggregation = allWorkOrders.map(wo => ({
        title: wo.title,
        description: wo.description,
        acceptance_criteria: wo.acceptance_criteria || [],
        files_in_scope: wo.files_in_scope || [],
        context_budget_estimate: wo.context_budget_estimate || 2000,
        risk_level: wo.risk_level || 'low',
        dependencies: wo.metadata?.dependencies || [],
        technical_requirements: wo.technical_requirements
      }));

      const { requirements, report } = await aggregateRequirements(workOrdersForAggregation);

      console.log(`[Decompose] Aggregation complete: ${report.critical.length} critical, ${report.warnings.length} warnings`);

      // Check for critical conflicts
      const hasConflicts = report.critical.length > 0;

      if (hasConflicts) {
        console.error('[Decompose] ❌ Critical conflicts detected - blocking execution');

        // Update all WOs to blocked status
        await supabase
          .from('work_orders')
          .update({ status: 'blocked_by_conflicts' })
          .in('id', allWorkOrders.map(wo => wo.id));

        // Store conflict report in metadata table
        await supabase
          .from('decomposition_metadata')
          .insert({
            project_id: projectId,
            decomposition_id: decompositionId,
            work_order_ids: allWorkOrders.map(wo => wo.id),
            has_conflicts: true,
            conflict_report: report as any,
            aggregated_requirements: requirements as any,
            bootstrap_needed: false // Will determine after conflicts resolved
          });

        console.error('[Decompose] Work orders marked as blocked_by_conflicts');

        // Return conflict report (NOT an error - this is expected flow)
        return NextResponse.json({
          success: false,
          blocked_by_conflicts: true,
          decomposition_id: decompositionId,
          work_orders: allWorkOrders,
          conflict_report: report,
          message: 'Architecture conflicts detected. Review and resolve conflicts before execution.',
          next_action: 'resolve_conflicts' // Frontend shows conflict UI
        }, { status: 200 });
      }

      // No conflicts - proceed to bootstrap (if needed)
      const maturity = assessProjectMaturity(project.local_path);

      console.log('[Decompose] Project maturity:', {
        is_greenfield: maturity.is_greenfield,
        has_package_json: maturity.has_package_json,
        confidence: maturity.greenfield_confidence
      });

      let bootstrapResult = null;
      const bootstrapNeeded = maturity.is_greenfield;

      if (bootstrapNeeded) {
        console.log('[Decompose] 🚀 Greenfield detected, executing bootstrap...');
        console.log('[Decompose] ⏳ This will take 2-5 minutes...');

        const executor = new BootstrapExecutor();
        bootstrapResult = await executor.execute(
          project.local_path,
          requirements,
          maturity,
          projectId
        );

        if (!bootstrapResult.success) {
          console.error('[Decompose] ❌ Bootstrap failed');

          // Update WOs to blocked status
          await supabase
            .from('work_orders')
            .update({ status: 'blocked_by_conflicts' })
            .in('id', allWorkOrders.map(wo => wo.id));

          // Store failure in metadata
          await supabase
            .from('decomposition_metadata')
            .insert({
              project_id: projectId,
              decomposition_id: decompositionId,
              work_order_ids: allWorkOrders.map(wo => wo.id),
              has_conflicts: false,
              aggregated_requirements: requirements as any,
              bootstrap_needed: true,
              bootstrap_executed: true,
              bootstrap_result: bootstrapResult as any
            });

          return NextResponse.json({
            success: false,
            bootstrap_failed: true,
            decomposition_id: decompositionId,
            work_orders: allWorkOrders,
            error_message: bootstrapResult.error_message,
            validation_errors: bootstrapResult.validation_errors,
            message: 'Bootstrap infrastructure setup failed. Review errors and try again.',
            next_action: 'fix_bootstrap_errors'
          }, { status: 500 });
        }

        console.log(`[Decompose] ✅ Bootstrap completed: ${bootstrapResult.commit_hash}`);
      }

      // Success - approve WOs for orchestrator
      await supabase
        .from('work_orders')
        .update({ status: 'approved' })
        .in('id', allWorkOrders.map(wo => wo.id));

      // Store success metadata
      await supabase
        .from('decomposition_metadata')
        .insert({
          project_id: projectId,
          decomposition_id: decompositionId,
          work_order_ids: allWorkOrders.map(wo => wo.id),
          has_conflicts: false,
          conflict_report: report as any, // Store warnings even if no critical
          aggregated_requirements: requirements as any,
          bootstrap_needed: bootstrapNeeded,
          bootstrap_executed: bootstrapNeeded,
          bootstrap_commit_hash: bootstrapResult?.commit_hash,
          bootstrap_result: bootstrapResult as any
        });

      console.log('[Decompose] ✅ Complete - WOs approved for orchestrator');

      return NextResponse.json({
        success: true,
        decomposition_id: decompositionId,
        project_id: projectId,
        project_name: project.name,
        work_orders_created: allWorkOrders.length,
        work_orders: allWorkOrders,
        decomposition_doc: combinedDecompositionDoc,
        total_estimated_cost: totalCost,
        preprocessing_used: needsPreprocessing,
        validation: {
          all_valid: validationResult.allValid,
          total_wos: validationResult.totalWOs,
          valid_wos: validationResult.validWOs,
          corrected_wos: validationResult.correctedWOs,
          failed_wos: validationResult.failedWOs,
          corrections: validationResult.corrections.map(c => ({
            wo_title: c.woTitle,
            package_corrections: c.packageCorrections
          })),
          execution_time_ms: validationResult.executionTimeMs
        },
        infrastructure: {
          bootstrap_executed: bootstrapNeeded,
          bootstrap_commit: bootstrapResult?.commit_hash,
          bootstrap_branch: bootstrapResult?.branch_name,
          bootstrap_time_ms: bootstrapResult?.execution_time_ms,
          files_created: bootstrapResult?.files_created
        },
        requirements_summary: {
          total_dependencies: requirements.dependencies.length,
          total_dev_dependencies: requirements.devDependencies.length,
          total_env_vars: requirements.environmentVariables.length,
          total_services: requirements.externalServices.length,
          frameworks: report.metadata.frameworks_detected
        },
        warnings: report.warnings,
        next_action: 'start_orchestrator',
        message: `✅ ${allWorkOrders.length} work orders created, validated, and approved for execution`
      });

    } catch (error: any) {
      console.error('[Decompose] Unexpected error:', error);

      return NextResponse.json({
        success: false,
        error: 'Internal server error',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, { status: 500 });
    }
  });
}
