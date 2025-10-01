// src/lib/architect-service.ts
// Orchestration layer - delegates all logic to architect-decomposition-rules.ts
import Anthropic from '@anthropic-ai/sdk';
import type { TechnicalSpec, DecompositionOutput } from '@/types/architect';
import {
  buildArchitectPrompt,
  validateWorkOrderCount,
  validateDependencies,
  validateTokenBudgets,
  validateCostEstimate,
  stripMarkdownCodeBlocks
} from './architect-decomposition-rules';

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

  async decomposeSpec(spec: TechnicalSpec): Promise<DecompositionOutput> {
    // Build prompt using centralized rules
    const prompt = buildArchitectPrompt(spec);

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';

    // Strip markdown using centralized function
    const cleanContent = stripMarkdownCodeBlocks(content);

    const decomposition = JSON.parse(cleanContent);

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

    return decomposition;
  }
}

export const architectService = ArchitectService.getInstance();