// src/lib/batched-architect-service.ts
// Wrapper service that handles batched decomposition for large projects
import Anthropic from '@anthropic-ai/sdk';
import type { TechnicalSpec, DecompositionOutput, WorkOrder } from '@/types/architect';
import type { DecomposeOptions } from './architect-service';
import { architectService } from './architect-service';
import { complexityEstimator, type ComplexityEstimate, type FeatureBatch } from './complexity-estimator';
import { dependencyValidator } from './dependency-validator';
import { buildArchitectPrompt, stripMarkdownCodeBlocks } from './architect-decomposition-rules';

/**
 * WorkOrderContextSummary provides structured metadata for previous work orders
 * This maintains architectural coherence across batches without bloating context
 */
interface WorkOrderContextSummary {
  id: string;
  title: string;
  primary_file: string;
  exports?: string[];
  dependencies: string[];
}

export interface BatchProgress {
  batch_number: number;
  total_batches: number;
  batch_name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  work_orders_generated?: number;
}

/**
 * BatchedArchitectService orchestrates multi-batch decomposition for large projects
 * Automatically determines when batching is needed and handles it transparently
 */
export class BatchedArchitectService {
  private static instance: BatchedArchitectService;
  private anthropic: Anthropic;
  private progressCallback?: (progress: BatchProgress) => void;

  private constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for BatchedArchitectService');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  static getInstance(): BatchedArchitectService {
    if (!BatchedArchitectService.instance) {
      BatchedArchitectService.instance = new BatchedArchitectService();
    }
    return BatchedArchitectService.instance;
  }

  /**
   * Set callback for batch progress updates
   */
  onProgress(callback: (progress: BatchProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Main entry point: decompose spec with automatic batching
   */
  async decompose(
    spec: TechnicalSpec,
    options?: DecomposeOptions
  ): Promise<DecompositionOutput> {
    console.log('\n🔍 Estimating project complexity...');

    // Step 1: Estimate complexity
    const estimate = await complexityEstimator.estimate(spec);

    console.log(`📊 Estimation complete:`);
    console.log(`   Total work orders: ${estimate.total_work_orders}`);
    console.log(`   Requires batching: ${estimate.requires_batching ? 'Yes' : 'No'}`);
    console.log(`   Estimated cost: $${estimate.estimated_cost.toFixed(2)}`);
    console.log(`   Estimated time: ${Math.round(estimate.estimated_time_seconds)}s`);

    // Step 2: Choose decomposition path
    if (!estimate.requires_batching) {
      console.log('✅ Using fast path (single-call decomposition)\n');
      return architectService.decomposeSpec(spec, options);
    }

    console.log(`\n🔄 Using batched decomposition (${estimate.batches?.length || 'multiple'} batches)...\n`);

    // Step 3: Batched decomposition
    const decomposition = await this.decomposeInBatches(spec, estimate, options);

    console.log('\n✅ Batched decomposition complete\n');

    return decomposition;
  }

  /**
   * Perform batched decomposition across multiple API calls
   */
  private async decomposeInBatches(
    spec: TechnicalSpec,
    estimate: ComplexityEstimate,
    options?: DecomposeOptions
  ): Promise<DecompositionOutput> {
    const batches = estimate.batches || this.createDefaultBatches(estimate.total_work_orders);
    const allWorkOrders: WorkOrder[] = [];
    let decompositionDoc = '';

    // Generate work orders batch by batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      this.reportProgress({
        batch_number: i + 1,
        total_batches: batches.length,
        batch_name: batch.name,
        status: 'in_progress'
      });

      console.log(`📦 Batch ${i + 1}/${batches.length}: ${batch.name}`);
      console.log(`   Target: ${batch.estimated_work_orders} work orders`);
      console.log(`   Focus: ${batch.focus_areas.join(', ')}`);

      try {
        const batchResult = await this.generateBatch(
          spec,
          batch,
          allWorkOrders,
          i + 1,
          batches.length
        );

        allWorkOrders.push(...batchResult.work_orders);
        decompositionDoc += batchResult.batch_doc;

        console.log(`   ✅ Generated ${batchResult.work_orders.length} work orders\n`);

        this.reportProgress({
          batch_number: i + 1,
          total_batches: batches.length,
          batch_name: batch.name,
          status: 'completed',
          work_orders_generated: batchResult.work_orders.length
        });
      } catch (error: any) {
        console.error(`   ❌ Batch failed: ${error.message}\n`);

        this.reportProgress({
          batch_number: i + 1,
          total_batches: batches.length,
          batch_name: batch.name,
          status: 'failed'
        });

        throw new Error(`Batch ${i + 1} failed: ${error.message}`);
      }
    }

    // Step 4: Validate and heal dependencies
    console.log('🔍 Validating dependencies...');
    const validation = await dependencyValidator.validate(allWorkOrders, { autoFix: true });

    if (!validation.valid) {
      console.warn('⚠️  Validation issues found:');
      validation.issues.forEach(issue => {
        console.warn(`   - ${issue.description}`);
      });

      if (validation.auto_fixed) {
        console.log('✅ Auto-fixes applied\n');
      }
    } else {
      console.log('✅ All dependencies valid\n');
    }

    // Step 5: Create final decomposition output
    const decomposition: DecompositionOutput = {
      work_orders: allWorkOrders,
      decomposition_doc: this.buildCombinedDoc(decompositionDoc, estimate, validation),
      total_estimated_cost: this.calculateTotalCost(allWorkOrders)
    };

    // Step 6: Optional enhancements (contracts, wireframes)
    if (options?.generateContracts) {
      await architectService['attachContracts'](decomposition);
    }

    if (options?.generateWireframes) {
      await architectService['attachWireframes'](decomposition);
    }

    return decomposition;
  }

  /**
   * Generate a single batch of work orders
   */
  private async generateBatch(
    spec: TechnicalSpec,
    batch: FeatureBatch,
    previousWorkOrders: WorkOrder[],
    batchNumber: number,
    totalBatches: number
  ): Promise<{ work_orders: WorkOrder[]; batch_doc: string }> {
    const prompt = this.buildBatchPrompt(spec, batch, previousWorkOrders, batchNumber, totalBatches);

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16000, // Claude Sonnet 4.5 supports up to 64K, using 16K per batch
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleanContent = stripMarkdownCodeBlocks(content);

    let parsed;
    try {
      parsed = JSON.parse(cleanContent);
    } catch (error: any) {
      console.error('Batch parse error:', error.message);
      console.error('Content length:', cleanContent.length);
      throw new Error(`Failed to parse batch ${batchNumber}: ${error.message}`);
    }

    return {
      work_orders: parsed.work_orders || [],
      batch_doc: parsed.decomposition_doc || ''
    };
  }

  /**
   * Build prompt for a single batch
   */
  private buildBatchPrompt(
    spec: TechnicalSpec,
    batch: FeatureBatch,
    previousWorkOrders: WorkOrder[],
    batchNumber: number,
    totalBatches: number
  ): string {
    const contextSummary = this.buildContextSummary(previousWorkOrders);
    const basePrompt = buildArchitectPrompt(spec);

    return `${basePrompt}

---

**BATCHING CONTEXT:**

This is batch ${batchNumber} of ${totalBatches} for this project.

**Current Batch Focus:**
- **Name:** ${batch.name}
- **Description:** ${batch.description}
- **Target:** ${batch.estimated_work_orders} work orders
- **Focus Areas:** ${batch.focus_areas.join(', ')}

${contextSummary ? `**Previous Work Orders (from earlier batches):**
${contextSummary}

IMPORTANT: Build on the foundation established by previous batches. Reference existing files, modules, and patterns.` : '**Previous Work Orders:** None (this is the first batch)'}

**Your Task:**
Generate ONLY the work orders for this batch (${batch.name}). Focus exclusively on the areas listed above.

- Number work orders starting from ${previousWorkOrders.length}
- Reference previous work orders in dependencies where appropriate
- Maintain consistency with established patterns and file structures
- Generate approximately ${batch.estimated_work_orders} work orders (±2 is acceptable)

**Output Format:**
\`\`\`json
{
  "work_orders": [ /* array of work orders for this batch */ ],
  "decomposition_doc": "# ${batch.name}\\n\\nRationale and strategy for this batch..."
}
\`\`\`

Generate the work orders for this batch now:`;
  }

  /**
   * Build structured context summary from previous work orders
   * Uses compact format to preserve architectural information within token budget
   */
  private buildContextSummary(workOrders: WorkOrder[]): string {
    if (workOrders.length === 0) {
      return '';
    }

    const summaries: WorkOrderContextSummary[] = workOrders.map((wo, idx) => ({
      id: `WO-${idx}`,
      title: wo.title,
      primary_file: wo.files_in_scope[0] || 'N/A',
      exports: this.extractExports(wo),
      dependencies: wo.dependencies
    }));

    return summaries
      .map(s => {
        const exports = s.exports && s.exports.length > 0 ? ` | Exports: ${s.exports.join(', ')}` : '';
        const deps = s.dependencies.length > 0 ? ` | Deps: ${s.dependencies.join(', ')}` : '';
        return `${s.id}: ${s.title} | File: ${s.primary_file}${exports}${deps}`;
      })
      .join('\n');
  }

  /**
   * Extract likely exports from work order description
   */
  private extractExports(wo: WorkOrder): string[] {
    const exports: string[] = [];

    // Look for class names (PascalCase)
    const classMatches = wo.description.match(/\b([A-Z][a-zA-Z0-9]*(?:Service|Manager|Handler|Controller|Component))\b/g);
    if (classMatches) {
      exports.push(...classMatches.slice(0, 3)); // Max 3
    }

    // Look for function names (camelCase)
    const funcMatches = wo.description.match(/\b([a-z][a-zA-Z0-9]*)\(\)/g);
    if (funcMatches) {
      exports.push(...funcMatches.slice(0, 2).map(f => f.replace('()', ''))); // Max 2
    }

    return Array.from(new Set(exports)); // Dedupe
  }

  /**
   * Create default batches if estimator doesn't provide them
   */
  private createDefaultBatches(totalWorkOrders: number): FeatureBatch[] {
    const batchSize = 10;
    const numBatches = Math.ceil(totalWorkOrders / batchSize);
    const batches: FeatureBatch[] = [];

    for (let i = 0; i < numBatches; i++) {
      batches.push({
        name: `Batch ${i + 1}`,
        description: `Work orders ${i * batchSize + 1}-${Math.min((i + 1) * batchSize, totalWorkOrders)}`,
        estimated_work_orders: Math.min(batchSize, totalWorkOrders - i * batchSize),
        focus_areas: ['General implementation']
      });
    }

    return batches;
  }

  /**
   * Build combined decomposition document
   */
  private buildCombinedDoc(
    batchDocs: string,
    estimate: ComplexityEstimate,
    validation: any
  ): string {
    return `# Project Decomposition (Batched)

## Overview
This project was decomposed using batched decomposition to handle ${estimate.total_work_orders} work orders.

## Estimation
${estimate.reasoning}

## Batches
${estimate.batches?.map((b, i) => `### Batch ${i + 1}: ${b.name}
- **Work Orders:** ${b.estimated_work_orders}
- **Focus:** ${b.description}
- **Areas:** ${b.focus_areas.join(', ')}
`).join('\n')}

## Batch Details
${batchDocs}

## Validation
${validation.valid ? '✅ All dependencies validated successfully' : `⚠️ Issues found: ${validation.issues.length}`}
${validation.auto_fixed ? '🔧 Auto-fixes applied to resolve issues' : ''}
`;
  }

  /**
   * Calculate total estimated cost
   */
  private calculateTotalCost(workOrders: WorkOrder[]): number {
    return workOrders.reduce((sum, wo) => sum + (wo.context_budget_estimate / 1000), 0);
  }

  /**
   * Report progress to callback
   */
  private reportProgress(progress: BatchProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }
}

export const batchedArchitectService = BatchedArchitectService.getInstance();
