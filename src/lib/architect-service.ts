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

    return decomposition;
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