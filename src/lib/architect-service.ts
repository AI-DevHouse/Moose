// src/lib/architect-service.ts
// Orchestration layer - delegates all logic to architect-decomposition-rules.ts
import Anthropic from '@anthropic-ai/sdk';
import type { TechnicalSpec, DecompositionOutput, WorkOrder } from '@/types/architect';
import type { WireframeRequest } from '@/types/wireframe';
import {
  buildArchitectPrompt,
  validateWorkOrderCount,
  validateDependencies,
  validateTokenBudgets,
  validateCostEstimate,
  stripMarkdownCodeBlocks
} from './architect-decomposition-rules';
import { wireframeService } from './wireframe-service';
import { contractService } from './contract-service';
import { assessProjectMaturity } from './orchestrator/project-inspector';
import { inferArchitecture } from './bootstrap-architecture-inferrer';
import { generateBootstrapWO } from './bootstrap-wo-generator';
import { ProjectService } from './project-service';
import { requirementAnalyzer, type DetectedRequirement } from './requirement-analyzer';

export interface DecomposeOptions {
  generateWireframes?: boolean;
  generateContracts?: boolean;
  projectId?: string;
}

export class ArchitectService {
  private static instance: ArchitectService;
  private anthropic: Anthropic;

  private constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    });
  }

  static getInstance(): ArchitectService {
    if (!ArchitectService.instance) {
      ArchitectService.instance = new ArchitectService();
    }
    return ArchitectService.instance;
  }

  async decomposeSpec(
    spec: TechnicalSpec,
    options?: DecomposeOptions
  ): Promise<DecompositionOutput> {
    // Build prompt using centralized rules
    const prompt = buildArchitectPrompt(spec);

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16000, // Claude Sonnet 4.5 supports up to 64K, using 16K for safety
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';

    // Strip markdown using centralized function
    const cleanContent = stripMarkdownCodeBlocks(content);

    // Attempt to parse JSON with better error handling
    let decomposition;
    try {
      decomposition = JSON.parse(cleanContent);
    } catch (parseError: any) {
      // Log the malformed JSON for debugging
      console.error('JSON Parse Error:', parseError.message);
      console.error('Raw content length:', content.length);
      console.error('Clean content (first 500 chars):', cleanContent.substring(0, 500));
      console.error('Clean content (last 500 chars):', cleanContent.substring(cleanContent.length - 500));

      // Try to extract JSON from the content more aggressively
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          decomposition = JSON.parse(jsonMatch[0]);
          console.warn('Successfully extracted JSON using fallback regex method');
        } catch {
          throw new Error(
            `Failed to parse architect response as JSON. ` +
            `Parse error: ${parseError.message}. ` +
            `Content length: ${cleanContent.length} chars. ` +
            `This likely means the response exceeded the 4000 token limit and was truncated.`
          );
        }
      } else {
        throw new Error(
          `Failed to parse architect response as JSON and could not extract valid JSON. ` +
          `Parse error: ${parseError.message}`
        );
      }
    }

    // Validate using centralized rules
    validateWorkOrderCount(decomposition.work_orders.length);

    // Validate dependencies (warn but don't fail)
    try {
      validateDependencies(decomposition.work_orders);
    } catch (error: any) {
      console.warn('Dependency validation warning:', error.message);
      // Continue anyway - let human review dependencies in UI
    }

    // Validate token budgets (warn only)
    const tokenWarnings = validateTokenBudgets(decomposition.work_orders);
    if (tokenWarnings.length > 0) {
      console.warn('Token budget warnings:', tokenWarnings);
    }

    // Validate cost estimate (warn only)
    const costWarnings = validateCostEstimate(
      decomposition.total_estimated_cost,
      decomposition.work_orders
    );
    if (costWarnings.length > 0) {
      console.warn('Cost estimate warnings:', costWarnings);
    }

    // Optional: Generate wireframes for UI work orders
    if (options?.generateWireframes) {
      await this.attachWireframes(decomposition);
    }

    // Optional: Generate integration contracts
    if (options?.generateContracts) {
      await this.attachContracts(decomposition);
    }

    // NEW: Greenfield detection and bootstrap injection
    if (options?.projectId) {
      await this.injectBootstrapIfNeeded(decomposition, spec, options.projectId);
    }

    return decomposition;
  }

  /**
   * Detect greenfield projects and inject bootstrap WO-0 if needed
   */
  private async injectBootstrapIfNeeded(
    decomposition: DecompositionOutput,
    spec: TechnicalSpec,
    projectId: string
  ): Promise<void> {
    // KILL SWITCH: Allow emergency disabling of bootstrap injection
    if (process.env.DISABLE_BOOTSTRAP_INJECTION === 'true') {
      console.log('[Architect] Bootstrap injection disabled via DISABLE_BOOTSTRAP_INJECTION env var');
      return;
    }

    try {
      const projectService = new ProjectService();
      const project = await projectService.getProject(projectId);

      if (!project) {
        console.log('[Architect] Project not found, skipping greenfield detection');
        return;
      }

      // Assess project maturity
      const maturity = assessProjectMaturity(project.local_path);

      console.log(`[Architect] Project maturity assessment:`, {
        is_greenfield: maturity.is_greenfield,
        has_src: maturity.has_src_directory,
        dependency_count: maturity.package_json_dependency_count,
        ts_file_count: maturity.existing_ts_file_count,
        confidence: maturity.greenfield_confidence
      });

      if (!maturity.is_greenfield) {
        console.log('[Architect] Established project detected, no bootstrap needed');
        return;
      }

      console.log(`[Architect] Greenfield project detected (confidence: ${maturity.greenfield_confidence.toFixed(2)})`);

      // Infer architecture from spec + generated WOs
      const architecture = inferArchitecture(spec, decomposition.work_orders);

      console.log(`[Architect] Inferred architecture:`, {
        framework: architecture.framework || 'generic TypeScript',
        needs_jsx: architecture.needs_jsx,
        state_management: architecture.state_management,
        testing_framework: architecture.testing_framework,
        dependencies: architecture.required_dependencies.join(', ') || 'none',
        dev_dependencies: architecture.required_dev_dependencies.join(', ')
      });

      // Analyze spec for external service requirements
      console.log('[Architect] Analyzing spec for external service dependencies...');
      let requirements: DetectedRequirement[];
      try {
        requirements = await requirementAnalyzer.analyzeSpec(spec);
        console.log(`[Architect] Detected ${requirements.length} external service(s):`,
          requirements.map(r => r.service).join(', ') || 'none'
        );
      } catch (error: any) {
        console.warn('[Architect] Failed to analyze requirements:', error.message);
        requirements = []; // Continue with empty requirements if analysis fails
      }

      // Generate bootstrap WO with architecture + requirements
      const bootstrapWO = generateBootstrapWO(architecture, maturity, requirements);

      console.log(`[Architect] Generated bootstrap WO: "${bootstrapWO.title}"`);
      console.log(`[Architect] Bootstrap files in scope: ${bootstrapWO.files_in_scope.join(', ')}`);

      // Prepend bootstrap WO as WO-0
      decomposition.work_orders.unshift(bootstrapWO);

      // Update all feature WO dependencies to include "0"
      decomposition.work_orders.slice(1).forEach((wo, index) => {
        // Original dependencies (shifted by 1 because we inserted WO-0)
        const originalDeps = (wo.dependencies || []).map(depIdx => {
          const parsed = parseInt(depIdx);
          if (!isNaN(parsed)) {
            return (parsed + 1).toString();
          }
          return depIdx;
        });

        // Add dependency on bootstrap WO-0
        wo.dependencies = ['0', ...originalDeps];
      });

      // Update decomposition doc to reflect bootstrap injection
      const frameworkDisplay = architecture.framework
        ? architecture.framework.charAt(0).toUpperCase() + architecture.framework.slice(1)
        : 'TypeScript';

      const externalServicesSection = requirements && requirements.length > 0
        ? `\n**External Services (${requirements.length}):** ${requirements.map(r => r.service).join(', ')}\n`
        : '';

      decomposition.decomposition_doc =
        `# Implementation Plan\n\n` +
        `## Bootstrap Phase\n\n` +
        `**WO-0 (Bootstrap):** Creates project infrastructure (package.json, tsconfig.json, src/ structure, .env.example)\n\n` +
        `**Architecture Detected:** ${frameworkDisplay}\n\n` +
        `**Dependencies:** ${architecture.required_dependencies.length > 0 ? architecture.required_dependencies.join(', ') : 'TypeScript only'}${externalServicesSection}\n` +
        `**All feature work orders depend on WO-0 completing first.**\n\n` +
        `---\n\n` +
        decomposition.decomposition_doc;

      console.log(`[Architect] Bootstrap WO injected as WO-0, ${decomposition.work_orders.length - 1} feature WOs updated`);
    } catch (error: any) {
      console.error('[Architect] Failed to inject bootstrap WO:', error.message);
      // Don't fail the entire decomposition if bootstrap injection fails
      // Just log the error and continue
    }
  }

  /**
   * Generate and attach integration contracts
   */
  private async attachContracts(decomposition: DecompositionOutput): Promise<void> {
    const { contracts, cost } = await contractService.generateContracts(decomposition.work_orders);

    // Attach contracts to decomposition
    decomposition.contracts = contracts;
    decomposition.contract_cost = cost;
  }

  /**
   * Generate and attach wireframes to UI work orders
   */
  private async attachWireframes(decomposition: DecompositionOutput): Promise<void> {
    const uiWorkOrders = decomposition.work_orders.filter(wo => this.isUIWorkOrder(wo));

    if (uiWorkOrders.length === 0) {
      console.log('ℹ️  No UI work orders detected, skipping wireframe generation');
      return;
    }

    console.log(`\n🎨 Detected ${uiWorkOrders.length} UI work orders, generating wireframes...`);

    let totalWireframeCost = 0;

    for (const wo of uiWorkOrders) {
      const componentName = this.extractComponentName(wo);
      if (!componentName) {
        console.log(`   ⏭️  ${wo.title}: Unable to extract component name, skipping`);
        continue;
      }

      try {
        const wireframeRequest: WireframeRequest = {
          component_name: componentName,
          work_order_title: wo.title,
          description: wo.description,
          files_in_scope: wo.files_in_scope,
          acceptance_criteria: wo.acceptance_criteria
        };

        const wireframe = await wireframeService.generateWireframe(wireframeRequest);

        // Attach wireframe metadata to work order
        wo.wireframe = {
          component_name: wireframe.component_name,
          generated: true,
          storage_path: wireframe.storage_path || `wireframes/${wireframe.component_name}.tsx`,
          cost: wireframe.cost
        };

        totalWireframeCost += wireframe.cost;
      } catch (error: any) {
        console.error(`   ❌ Failed to generate wireframe for ${wo.title}:`, error.message);
        // Continue with other work orders
      }
    }

    // Add wireframe cost to decomposition output
    decomposition.wireframe_cost = totalWireframeCost;

    console.log(`✅ Wireframe generation complete: $${totalWireframeCost.toFixed(2)}\n`);
  }

  /**
   * Detect if work order involves UI components
   */
  private isUIWorkOrder(wo: WorkOrder): boolean {
    const uiPatterns = [
      /\bui\b/i, /\bview\b/i, /\bcomponent\b/i, /\bscreen\b/i,
      /\bpage\b/i, /\bdialog\b/i, /\bmodal\b/i, /\bform\b/i,
      /\bpanel\b/i, /\bbutton\b/i, /\binterface\b/i, /\bdisplay\b/i,
      /\brender\b/i, /\bfrontend\b/i, /\breact\b/i, /\bvue\b/i
    ];

    const text = `${wo.title} ${wo.description}`.toLowerCase();
    const hasUIKeyword = uiPatterns.some(pattern => pattern.test(text));

    // Also check files_in_scope for .tsx, .jsx, .vue files
    const hasUIFiles = wo.files_in_scope.some(file =>
      /\.(tsx|jsx|vue)$/i.test(file) ||
      /\/components?\//i.test(file) ||
      /\/views?\//i.test(file)
    );

    return hasUIKeyword || hasUIFiles;
  }

  /**
   * Extract component name from work order
   */
  private extractComponentName(wo: WorkOrder): string | null {
    // Strategy 1: Extract from files_in_scope
    for (const file of wo.files_in_scope) {
      // Match PascalCase component names in paths
      const match = file.match(/\/([A-Z][a-zA-Z0-9]+)\.(?:tsx|jsx|vue)$/);
      if (match) {
        return match[1];
      }
    }

    // Strategy 2: Extract from title (look for PascalCase words with UI suffixes)
    const titleMatch = wo.title.match(/\b([A-Z][a-zA-Z0-9]*(?:View|Page|Panel|Dialog|Modal|Form|Component|Screen|Dashboard|Settings))\b/);
    if (titleMatch) {
      return titleMatch[1];
    }

    // Strategy 3: Generate from title (convert to PascalCase and add suffix)
    const words = wo.title
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 0)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

    if (words.length > 0) {
      const baseName = words.slice(0, 3).join(''); // Use first 3 words max
      // Add appropriate suffix if not present
      if (!/(?:View|Page|Panel|Dialog|Modal|Form|Component)$/i.test(baseName)) {
        return `${baseName}View`;
      }
      return baseName;
    }

    return null;
  }
}

export const architectService = ArchitectService.getInstance();