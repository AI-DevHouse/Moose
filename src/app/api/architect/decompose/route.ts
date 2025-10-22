export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// src/app/api/architect/decompose/route.ts
import { NextRequest, NextResponse} from 'next/server';
import { batchedArchitectService } from '@/lib/batched-architect-service';
import type { TechnicalSpec } from '@/types/architect';
import { withRateLimit, architectApiLimiter } from '@/lib/rate-limiter';
import { validateTechnicalSpec, securityCheck } from '@/lib/input-sanitizer';
import { projectService } from '@/lib/project-service';
import { createSupabaseServiceClient } from '@/lib/supabase';
import { requirementAnalyzer } from '@/lib/requirement-analyzer';
import { specPreprocessor } from '@/lib/spec-preprocessor';
import * as fs from 'fs';
import * as path from 'path';

export async function POST(request: NextRequest) {
  // Apply rate limiting (100 req/min - Claude Sonnet 4.x supports 1000 RPM, 450k input TPM)
  return withRateLimit(request, architectApiLimiter, async () => {
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

      // Extract spec and options from body
      // Supports both formats:
      // 1. { spec: {...}, options: {...} }
      // 2. { spec: {...}, generateWireframes: true, generateContracts: true }
      // 3. Direct spec { feature_name: ..., ... }
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

      // Check if spec needs preprocessing (large unstructured document)
      const isRawDocument = typeof specData === 'string';
      const needsPreprocessing = isRawDocument && specPreprocessor.needsPreprocessing(specData);

      let allWorkOrders: any[] = [];
      let combinedDecompositionDoc = '';
      let totalCost = 0;
      let allRequirements: any[] = [];

      // Initialize Supabase client for incremental saves
      const supabase = createSupabaseServiceClient();

      if (needsPreprocessing) {
        console.log('\n🔄 Large document detected - using spec preprocessor...');
        console.log(`   Document size: ${specData.length} characters\n`);

        // Preprocess: Split document into sections
        const sections = await specPreprocessor.preprocess(specData, {
          document_title: project.name
        });

        console.log(`\n📦 Processing ${sections.length} sections through Architect...\n`);

        // Track work orders per section for dependency mapping
        const sectionWorkOrders: Map<string, any[]> = new Map();

        // Process each section
        for (let i = 0; i < sections.length; i++) {
          const section = sections[i];
          console.log(`\n--- Section ${i + 1}/${sections.length}: ${section.title} ---`);

          // Validate this section's spec
          const sectionSpec = validateTechnicalSpec(section.technical_spec);

          // Security check
          const secCheck = securityCheck(sectionSpec.feature_name);
          if (!secCheck.safe) {
            console.warn(`⚠️  Section ${section.section_number} flagged: ${secCheck.threats.join(', ')}`);
            console.warn(`   Skipping section for security reasons\n`);
            continue;
          }

          // Decompose this section
          const decomposition = await batchedArchitectService.decompose(
            sectionSpec as TechnicalSpec,
            {
              generateWireframes: wireframesFlag,
              generateContracts: contractsFlag,
              projectId: projectId
            }
          );

          // Analyze requirements for this section
          const requirements = await requirementAnalyzer.analyzeSpec(sectionSpec);

          // Save work orders immediately (incremental save - Bug #4 fix)
          const workOrdersToInsert = decomposition.work_orders.map((wo: any) => ({
            title: wo.title,
            description: wo.description,
            risk_level: wo.risk_level || 'low',
            status: 'pending',
            proposer_id: wo.proposer_id || 'a40c5caf-b0fb-4a8b-a544-ca82bb2ab939',
            estimated_cost: wo.estimated_cost || 0,
            pattern_confidence: wo.pattern_confidence || 0.5,
            acceptance_criteria: wo.acceptance_criteria || [],
            files_in_scope: wo.files_in_scope || [],
            context_budget_estimate: wo.context_budget_estimate || 2000,
            decomposition_doc: `Section ${i + 1}: ${section.title}\n\n${decomposition.decomposition_doc || ''}`,
            project_id: projectId,
            metadata: {
              auto_approved: true,
              approved_at: new Date().toISOString(),
              approved_by: 'architect',
              section_number: section.section_number
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

          console.log(`💾 Saved ${savedWOs.length} work orders to database`);

          // Store saved work orders for this section
          sectionWorkOrders.set(section.section_number, savedWOs);

          // Add to combined results
          allWorkOrders.push(...savedWOs);
          allRequirements.push(...requirements);
          totalCost += decomposition.total_estimated_cost || 0;
          combinedDecompositionDoc += `\n## Section ${i + 1}: ${section.title}\n\n${decomposition.decomposition_doc || ''}\n`;

          console.log(`✅ Section ${i + 1} complete: ${savedWOs.length} work orders\n`);
        }

        // Add cross-section dependencies (using real work order IDs)
        console.log('🔗 Adding cross-section dependencies...');
        const dependencyUpdates = [];

        for (let i = 0; i < sections.length; i++) {
          const section = sections[i];
          const workOrders = sectionWorkOrders.get(section.section_number) || [];

          // For each work order in this section
          for (const wo of workOrders) {
            const existingDeps = wo.metadata?.dependencies || [];

            // Add dependencies on previous section's work orders (using real IDs)
            for (const depSectionNum of section.dependencies) {
              const depWorkOrders = sectionWorkOrders.get(depSectionNum) || [];
              existingDeps.push(...depWorkOrders.map(depWo => depWo.id));
            }

            const uniqueDeps = Array.from(new Set(existingDeps)); // Dedupe

            // Update work order metadata with dependencies
            if (uniqueDeps.length > 0) {
              dependencyUpdates.push({
                id: wo.id,
                metadata: {
                  ...wo.metadata,
                  dependencies: uniqueDeps
                }
              });
            }
          }
        }

        // Apply dependency updates to database
        if (dependencyUpdates.length > 0) {
          for (const update of dependencyUpdates) {
            await supabase
              .from('work_orders')
              .update({ metadata: update.metadata })
              .eq('id', update.id);
          }
          console.log(`✅ Updated ${dependencyUpdates.length} work orders with cross-section dependencies\n`);
        }

        console.log(`📊 Total: ${allWorkOrders.length} work orders from ${sections.length} sections\n`);

      } else {
        // Standard flow: single spec
        console.log('\n📄 Processing single technical specification...\n');

        // Validate and sanitize input
        const spec = validateTechnicalSpec(specData);

        // Security check on feature_name
        const secCheck = securityCheck(spec.feature_name);
        if (!secCheck.safe) {
          return NextResponse.json({
            success: false,
            error: `Security threat detected: ${secCheck.threats.join(', ')}`,
          }, { status: 400 });
        }

        // Call batched architect service (automatically handles batching when needed)
        const decomposition = await batchedArchitectService.decompose(
          spec as TechnicalSpec,
          {
            generateWireframes: wireframesFlag,
            generateContracts: contractsFlag,
            projectId: projectId
          }
        );

        // NOTE: Requirement analysis now integrated into bootstrap WO for greenfield projects
        // For established projects, requirements are detected but not auto-written to disk
        // Bootstrap WO-0 handles .env.example creation via proposer (proper git workflow)
        console.log('ℹ️  Requirement analysis integrated into bootstrap WO for greenfield projects');

        allWorkOrders = decomposition.work_orders;
        combinedDecompositionDoc = decomposition.decomposition_doc || '';
        totalCost = decomposition.total_estimated_cost || 0;
      }

      // REMOVED: Server-side .env.local.template write
      // Reason: Environment template creation now handled by bootstrap WO-0 for greenfield projects
      // - Greenfield: Bootstrap WO creates .env.example with framework + service requirements
      // - Established: No automatic env file creation (user manages their own .env files)
      // This follows proper git workflow (proposer creates files, not server-side writes)

      // For non-preprocessed specs, save work orders in single batch
      if (!needsPreprocessing && allWorkOrders.length > 0) {
        const workOrdersToInsert = allWorkOrders.map((wo: any) => ({
          title: wo.title,
          description: wo.description,
          risk_level: wo.risk_level || 'low',
          status: 'pending',
          proposer_id: wo.proposer_id || 'a40c5caf-b0fb-4a8b-a544-ca82bb2ab939',
          estimated_cost: wo.estimated_cost || 0,
          pattern_confidence: wo.pattern_confidence || 0.5,
          acceptance_criteria: wo.acceptance_criteria || [],
          files_in_scope: wo.files_in_scope || [],
          context_budget_estimate: wo.context_budget_estimate || 2000,
          decomposition_doc: combinedDecompositionDoc || null,
          project_id: projectId,
          metadata: {
            auto_approved: true,
            approved_at: new Date().toISOString(),
            approved_by: 'architect'
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

        // Convert array-index dependencies to UUIDs and update metadata
        const dependencyUpdates = [];

        for (let i = 0; i < allWorkOrders.length; i++) {
          const originalWO = allWorkOrders[i];
          const savedWO = savedWOs[i]; // Same order as inserted

          // Get dependencies from architect output (array indices like ["0", "1"])
          const deps = originalWO.dependencies || [];

          if (deps.length > 0) {
            // Convert array indices to actual UUIDs
            const dependencyUUIDs = deps.map((depIndex: string) => {
              const depIndexNum = parseInt(depIndex);
              if (isNaN(depIndexNum) || depIndexNum >= savedWOs.length) {
                console.warn(`Invalid dependency index "${depIndex}" for WO ${savedWO.title}`);
                return null;
              }
              return savedWOs[depIndexNum].id;
            }).filter((id: string | null): id is string => id !== null); // Remove invalid entries

            if (dependencyUUIDs.length > 0) {
              dependencyUpdates.push({
                id: savedWO.id,
                metadata: {
                  ...(savedWO.metadata || {}),
                  dependencies: dependencyUUIDs
                }
              });
            }
          }
        }

        // Update work orders with converted dependencies
        if (dependencyUpdates.length > 0) {
          for (const update of dependencyUpdates) {
            await supabase
              .from('work_orders')
              .update({ metadata: update.metadata })
              .eq('id', update.id);
          }
          console.log(`✅ Updated ${dependencyUpdates.length} work orders with dependency UUIDs`);
        }

        allWorkOrders = savedWOs; // Replace with saved work orders (includes IDs)
      }

      return NextResponse.json({
        success: true,
        project_id: projectId,
        project_name: project.name,
        work_orders_created: allWorkOrders.length,
        work_orders: allWorkOrders,
        detected_requirements: allRequirements,
        decomposition_doc: combinedDecompositionDoc,
        total_estimated_cost: totalCost,
        preprocessing_used: needsPreprocessing
      });

    } catch (error: any) {
      console.error('Architect decompose error:', error);

      // Check if validation error
      if (error.message.includes('required') || error.message.includes('must be')) {
        return NextResponse.json({
          success: false,
          error: error.message
        }, { status: 400 });
      }

      return NextResponse.json({
        success: false,
        error: 'Internal server error'
      }, { status: 500 });
    }
  });
}