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

      // Analyze requirements (detect external dependencies)
      console.log('🔍 Analyzing spec for external dependencies...');
      const requirements = await requirementAnalyzer.analyzeSpec(spec);
      console.log(`✅ Detected ${requirements.length} external dependencies`);

      // Update .env.local.template in project directory if requirements found
      if (requirements.length > 0 && project.local_path && fs.existsSync(project.local_path)) {
        const envTemplatePath = path.join(project.local_path, '.env.local.template');

        // Read existing template or create new one
        let envContent = '';
        if (fs.existsSync(envTemplatePath)) {
          envContent = fs.readFileSync(envTemplatePath, 'utf-8');
        } else {
          envContent = '# Environment Variables\n# Copy this file to .env.local and fill in your values\n\n';
        }

        // Add new environment variables
        for (const req of requirements) {
          if (!envContent.includes(req.env_var)) {
            envContent += `\n# ${req.service} (${req.category})${req.required ? ' - REQUIRED' : ' - Optional'}\n`;
            envContent += `# ${req.instructions}\n`;
            envContent += `# Get from: ${req.setup_url}\n`;
            envContent += `${req.env_var}=\n`;
          }
        }

        fs.writeFileSync(envTemplatePath, envContent);
        console.log(`✅ Updated .env.local.template with ${requirements.length} dependencies`);
      }

      // Save work orders to database with project_id
      const supabase = createSupabaseServiceClient();
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
        decomposition_doc: decomposition.decomposition_doc || null,
        project_id: projectId  // Link to project
      }));

      const { data: savedWorkOrders, error: insertError } = await supabase
        .from('work_orders')
        .insert(workOrdersToInsert)
        .select();

      if (insertError) {
        console.error('Failed to save work orders:', insertError);
        throw new Error(`Failed to save work orders: ${insertError.message}`);
      }

      return NextResponse.json({
        success: true,
        project_id: projectId,
        project_name: project.name,
        work_orders_created: savedWorkOrders?.length || 0,
        work_orders: savedWorkOrders,
        detected_requirements: requirements,
        decomposition_doc: decomposition.decomposition_doc,
        total_estimated_cost: decomposition.total_estimated_cost
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