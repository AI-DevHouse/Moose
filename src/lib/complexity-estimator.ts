// src/lib/complexity-estimator.ts
// Estimates project complexity and determines optimal batching strategy
import Anthropic from '@anthropic-ai/sdk';
import type { TechnicalSpec } from '@/types/architect';

export interface FeatureBatch {
  name: string;
  description: string;
  estimated_work_orders: number;
  focus_areas: string[];
}

export interface ComplexityEstimate {
  total_work_orders: number;
  requires_batching: boolean;
  batches?: FeatureBatch[];
  reasoning: string;
  estimated_cost: number;
  estimated_time_seconds: number;
}

/**
 * ComplexityEstimator analyzes technical specs and determines:
 * 1. Total work order count needed
 * 2. Whether batching is required (>20 WOs)
 * 3. Optimal feature-based batch boundaries
 */
export class ComplexityEstimator {
  private static instance: ComplexityEstimator;
  private anthropic: Anthropic;

  private constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for ComplexityEstimator');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  static getInstance(): ComplexityEstimator {
    if (!ComplexityEstimator.instance) {
      ComplexityEstimator.instance = new ComplexityEstimator();
    }
    return ComplexityEstimator.instance;
  }

  /**
   * Estimate project complexity and determine batching strategy
   */
  async estimate(spec: TechnicalSpec): Promise<ComplexityEstimate> {
    const prompt = this.buildEstimationPrompt(spec);

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000, // Estimation data with reasoning
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse estimation response
    const estimate = this.parseEstimationResponse(content);

    // Calculate cost and time estimates
    estimate.estimated_cost = this.calculateEstimatedCost(estimate);
    estimate.estimated_time_seconds = this.calculateEstimatedTime(estimate);

    return estimate;
  }

  /**
   * Build prompt for complexity estimation
   */
  private buildEstimationPrompt(spec: TechnicalSpec): string {
    return `You are analyzing a technical specification to estimate project complexity and plan decomposition strategy.

**Technical Specification:**
Feature: ${spec.feature_name}

Objectives:
${spec.objectives.map((obj, i) => `${i + 1}. ${obj}`).join('\n')}

Constraints:
${spec.constraints.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Acceptance Criteria:
${spec.acceptance_criteria.map((ac, i) => `${i + 1}. ${ac}`).join('\n')}

Budget: ${spec.budget_estimate ? `$${spec.budget_estimate}` : 'Not specified'}
Timeline: ${spec.time_estimate || 'Not specified'}

---

**Your Task:**

Analyze this specification and provide a complexity estimate with the following structure:

1. **Total Work Orders**: How many work orders will this project require?
   - Consider: Setup, infrastructure, core features, UI, testing, polish
   - Each WO should be 1-3 days of work (~800-2000 tokens context)
   - Count carefully - this determines the entire decomposition strategy

2. **Batching Required**: Does this exceed 20 work orders?
   - If ≤20: Single-call decomposition (fast path)
   - If >20: Multi-batch decomposition required

3. **Feature-Based Batches** (only if >20 WOs):
   - Break project into more smaller batches (aim for 8-12 batches total)
   - Each batch should be cohesive (related work orders)
   - Examples: "Infrastructure", "Core Systems", "UI Layer", "Testing & Polish"
   - Estimate WOs per batch (aim for 4-5 WOs each, MAX 5 to avoid token truncation)

4. **Reasoning**: Brief explanation of your estimation logic

**Output Format (JSON only, no markdown):**

\`\`\`json
{
  "total_work_orders": <number>,
  "requires_batching": <boolean>,
  "batches": [
    {
      "name": "Infrastructure",
      "description": "Project setup, build system, process architecture",
      "estimated_work_orders": 8,
      "focus_areas": ["Electron setup", "TypeScript config", "IPC layer"]
    }
  ],
  "reasoning": "This project requires X work orders because..."
}
\`\`\`

**Important Guidelines:**
- Be realistic with WO counts (don't underestimate)
- Each batch should have clear boundaries
- Batches should build on each other (Infrastructure → Core → UI → Polish)
- **CRITICAL**: Aim for 4-5 WOs per batch (MAXIMUM 5, no exceptions) to avoid token truncation
- Always prefer more smaller batches over fewer large batches
- If a feature needs 7 WOs, split it into two batches of 3-4 each

Provide your complexity estimate now:`;
  }

  /**
   * Parse the estimation response from Claude
   */
  private parseEstimationResponse(content: string): ComplexityEstimate {
    // Strip markdown code blocks if present
    const cleanContent = content
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    try {
      const parsed = JSON.parse(cleanContent);

      return {
        total_work_orders: parsed.total_work_orders,
        requires_batching: parsed.requires_batching || parsed.total_work_orders > 20,
        batches: parsed.batches || [],
        reasoning: parsed.reasoning || '',
        estimated_cost: 0, // Will be calculated
        estimated_time_seconds: 0 // Will be calculated
      };
    } catch (error: any) {
      console.error('Failed to parse estimation response:', error.message);
      console.error('Content:', cleanContent);
      throw new Error(`Failed to parse complexity estimation: ${error.message}`);
    }
  }

  /**
   * Calculate estimated cost for decomposition
   */
  private calculateEstimatedCost(estimate: ComplexityEstimate): number {
    const ESTIMATION_COST = 0.02; // This estimation call

    if (!estimate.requires_batching) {
      // Single call decomposition
      return ESTIMATION_COST + 0.15; // ~$0.17 total
    }

    // Batched decomposition
    const numBatches = estimate.batches?.length || Math.ceil(estimate.total_work_orders / 10);
    const BATCH_COST = 0.10; // Per batch
    const VALIDATION_COST = 0.03; // Final validation

    return ESTIMATION_COST + (numBatches * BATCH_COST) + VALIDATION_COST;
  }

  /**
   * Calculate estimated time for decomposition
   */
  private calculateEstimatedTime(estimate: ComplexityEstimate): number {
    const ESTIMATION_TIME = 15; // This call (seconds)

    if (!estimate.requires_batching) {
      // Single call decomposition
      return ESTIMATION_TIME + 30; // ~45 seconds total
    }

    // Batched decomposition
    const numBatches = estimate.batches?.length || Math.ceil(estimate.total_work_orders / 10);
    const BATCH_TIME = 35; // Per batch (includes context window growth)
    const VALIDATION_TIME = 10; // Final validation

    return ESTIMATION_TIME + (numBatches * BATCH_TIME) + VALIDATION_TIME;
  }

  /**
   * Validate that batch estimates are reasonable
   */
  validateBatches(estimate: ComplexityEstimate): string[] {
    const warnings: string[] = [];

    if (!estimate.batches || estimate.batches.length === 0) {
      return warnings;
    }

    // Check batch count
    if (estimate.batches.length < 2) {
      warnings.push('Only 1 batch defined - batching may not be necessary');
    }
    if (estimate.batches.length > 10) {
      warnings.push(`${estimate.batches.length} batches is excessive - consider consolidating`);
    }

    // Check WO distribution
    const totalEstimated = estimate.batches.reduce((sum, b) => sum + b.estimated_work_orders, 0);
    const difference = Math.abs(totalEstimated - estimate.total_work_orders);
    if (difference > 5) {
      warnings.push(
        `Batch estimates (${totalEstimated} WOs) don't match total (${estimate.total_work_orders} WOs)`
      );
    }

    // Check individual batch sizes
    for (const batch of estimate.batches) {
      if (batch.estimated_work_orders < 3) {
        warnings.push(`Batch "${batch.name}" has only ${batch.estimated_work_orders} WOs - too small`);
      }
      if (batch.estimated_work_orders > 18) {
        warnings.push(`Batch "${batch.name}" has ${batch.estimated_work_orders} WOs - may hit token limit`);
      }
    }

    return warnings;
  }
}

export const complexityEstimator = ComplexityEstimator.getInstance();
