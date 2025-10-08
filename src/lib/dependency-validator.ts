// src/lib/dependency-validator.ts
// Validates work order dependencies and provides self-healing fixes
import Anthropic from '@anthropic-ai/sdk';
import type { WorkOrder } from '@/types/architect';

export interface ValidationIssue {
  type: 'missing_dependency' | 'circular_dependency' | 'duplicate_files' | 'invalid_reference';
  severity: 'error' | 'warning';
  work_order_ids: string[];
  description: string;
  auto_fixable: boolean;
}

export interface FixStrategy {
  type: 'insert' | 'renumber' | 'split' | 'merge' | 'reorder';
  description: string;
  target_work_orders: string[];
  new_work_orders?: WorkOrder[];
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  fix_strategies: FixStrategy[];
  auto_fixed: boolean;
}

/**
 * DependencyValidator checks work order consistency and provides self-healing fixes
 */
export class DependencyValidator {
  private static instance: DependencyValidator;
  private anthropic: Anthropic;

  private constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for DependencyValidator');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  static getInstance(): DependencyValidator {
    if (!DependencyValidator.instance) {
      DependencyValidator.instance = new DependencyValidator();
    }
    return DependencyValidator.instance;
  }

  /**
   * Validate work orders and optionally apply auto-fixes
   */
  async validate(
    workOrders: WorkOrder[],
    options: { autoFix: boolean } = { autoFix: false }
  ): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const fixStrategies: FixStrategy[] = [];

    // Run validation checks
    issues.push(...this.checkMissingDependencies(workOrders));
    issues.push(...this.checkCircularDependencies(workOrders));
    issues.push(...this.checkDuplicateFiles(workOrders));
    issues.push(...this.checkInvalidReferences(workOrders));

    // Determine fix strategies for each issue
    for (const issue of issues) {
      if (issue.auto_fixable) {
        const strategy = await this.determineFix(issue, workOrders);
        if (strategy) {
          fixStrategies.push(strategy);
        }
      }
    }

    // Apply auto-fixes if requested
    let autoFixed = false;
    if (options.autoFix && fixStrategies.length > 0) {
      autoFixed = await this.applyFixes(workOrders, fixStrategies);
    }

    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      fix_strategies: fixStrategies,
      auto_fixed: autoFixed
    };
  }

  /**
   * Check for missing dependencies (WO depends on non-existent WO)
   */
  private checkMissingDependencies(workOrders: WorkOrder[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const validIds = new Set(workOrders.map((_, idx) => idx.toString()));

    workOrders.forEach((wo, idx) => {
      const missingDeps = wo.dependencies.filter(dep => !validIds.has(dep));

      if (missingDeps.length > 0) {
        issues.push({
          type: 'missing_dependency',
          severity: 'error',
          work_order_ids: [idx.toString()],
          description: `WO-${idx} depends on non-existent work orders: ${missingDeps.join(', ')}`,
          auto_fixable: true
        });
      }
    });

    return issues;
  }

  /**
   * Check for circular dependencies
   */
  private checkCircularDependencies(workOrders: WorkOrder[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const visited = new Set<number>();
    const recursionStack = new Set<number>();

    const hasCycle = (idx: number, path: number[]): number[] | null => {
      if (recursionStack.has(idx)) {
        // Found cycle
        const cycleStart = path.indexOf(idx);
        return path.slice(cycleStart);
      }

      if (visited.has(idx)) {
        return null;
      }

      visited.add(idx);
      recursionStack.add(idx);
      path.push(idx);

      const wo = workOrders[idx];
      for (const depStr of wo.dependencies) {
        const depIdx = parseInt(depStr, 10);
        if (!isNaN(depIdx)) {
          const cycle = hasCycle(depIdx, [...path]);
          if (cycle) {
            return cycle;
          }
        }
      }

      recursionStack.delete(idx);
      return null;
    };

    for (let i = 0; i < workOrders.length; i++) {
      if (!visited.has(i)) {
        const cycle = hasCycle(i, []);
        if (cycle) {
          issues.push({
            type: 'circular_dependency',
            severity: 'error',
            work_order_ids: cycle.map(idx => idx.toString()),
            description: `Circular dependency detected: WO-${cycle.join(' → WO-')} → WO-${cycle[0]}`,
            auto_fixable: true
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check for duplicate file assignments
   */
  private checkDuplicateFiles(workOrders: WorkOrder[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const fileMap = new Map<string, number[]>();

    workOrders.forEach((wo, idx) => {
      wo.files_in_scope.forEach(file => {
        if (!fileMap.has(file)) {
          fileMap.set(file, []);
        }
        fileMap.get(file)!.push(idx);
      });
    });

    fileMap.forEach((woIndices, file) => {
      if (woIndices.length > 1) {
        issues.push({
          type: 'duplicate_files',
          severity: 'warning',
          work_order_ids: woIndices.map(idx => idx.toString()),
          description: `File "${file}" appears in multiple work orders: WO-${woIndices.join(', WO-')}`,
          auto_fixable: true
        });
      }
    });

    return issues;
  }

  /**
   * Check for invalid dependency references (malformed IDs)
   */
  private checkInvalidReferences(workOrders: WorkOrder[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    workOrders.forEach((wo, idx) => {
      const invalidDeps = wo.dependencies.filter(dep => {
        const depNum = parseInt(dep, 10);
        return isNaN(depNum) || depNum < 0 || depNum >= workOrders.length;
      });

      if (invalidDeps.length > 0) {
        issues.push({
          type: 'invalid_reference',
          severity: 'error',
          work_order_ids: [idx.toString()],
          description: `WO-${idx} has invalid dependency references: ${invalidDeps.join(', ')}`,
          auto_fixable: false
        });
      }
    });

    return issues;
  }

  /**
   * Determine fix strategy for an issue
   */
  private async determineFix(
    issue: ValidationIssue,
    workOrders: WorkOrder[]
  ): Promise<FixStrategy | null> {
    switch (issue.type) {
      case 'missing_dependency':
        return this.fixMissingDependency(issue, workOrders);

      case 'circular_dependency':
        return this.fixCircularDependency(issue, workOrders);

      case 'duplicate_files':
        return this.fixDuplicateFiles(issue, workOrders);

      default:
        return null;
    }
  }

  /**
   * Generate missing work order to satisfy dependency
   */
  private async fixMissingDependency(
    issue: ValidationIssue,
    workOrders: WorkOrder[]
  ): Promise<FixStrategy | null> {
    const woIdx = parseInt(issue.work_order_ids[0], 10);
    const wo = workOrders[woIdx];

    // Extract what the missing dependency should do from the dependent WO
    const prompt = this.buildMissingWOPrompt(wo, workOrders);

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].type === 'text' ? response.content[0].text : '';
      const cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const newWO = JSON.parse(cleanContent) as WorkOrder;

      return {
        type: 'insert',
        description: `Insert missing work order before WO-${woIdx}`,
        target_work_orders: [woIdx.toString()],
        new_work_orders: [newWO]
      };
    } catch (error: any) {
      console.error('Failed to generate missing WO:', error.message);
      return null;
    }
  }

  /**
   * Fix circular dependency by re-ordering work orders
   */
  private fixCircularDependency(
    issue: ValidationIssue,
    workOrders: WorkOrder[]
  ): FixStrategy {
    // Simple strategy: Remove the back-edge dependency
    const cycle = issue.work_order_ids.map(id => parseInt(id, 10));
    const lastInCycle = cycle[cycle.length - 1];
    const firstInCycle = cycle[0];

    return {
      type: 'reorder',
      description: `Break circular dependency by removing WO-${lastInCycle}'s dependency on WO-${firstInCycle}`,
      target_work_orders: [lastInCycle.toString()]
    };
  }

  /**
   * Fix duplicate files by merging work orders
   */
  private fixDuplicateFiles(
    issue: ValidationIssue,
    workOrders: WorkOrder[]
  ): FixStrategy {
    const woIndices = issue.work_order_ids.map(id => parseInt(id, 10));

    return {
      type: 'merge',
      description: `Consider merging WO-${woIndices.join(', WO-')} as they operate on the same files`,
      target_work_orders: issue.work_order_ids
    };
  }

  /**
   * Build prompt for generating missing work order
   */
  private buildMissingWOPrompt(dependentWO: WorkOrder, allWorkOrders: WorkOrder[]): string {
    return `A work order depends on a missing prerequisite. Generate the missing work order.

**Dependent Work Order:**
Title: ${dependentWO.title}
Description: ${dependentWO.description}
Files: ${dependentWO.files_in_scope.join(', ')}
Dependencies: ${dependentWO.dependencies.join(', ')}

**Existing Work Orders:**
${allWorkOrders.map((wo, idx) => `WO-${idx}: ${wo.title}`).join('\n')}

**Task:**
Based on the dependent work order's needs, generate a missing prerequisite work order that:
1. Provides the foundation for the dependent work order
2. Has no conflicting dependencies
3. Follows the same format and conventions

**Output Format (JSON only):**
\`\`\`json
{
  "title": "...",
  "description": "...",
  "acceptance_criteria": ["...", "..."],
  "files_in_scope": ["..."],
  "context_budget_estimate": 1000,
  "risk_level": "low",
  "dependencies": []
}
\`\`\`

Generate the missing work order now:`;
  }

  /**
   * Apply fix strategies to work orders (in-place modification)
   */
  private async applyFixes(
    workOrders: WorkOrder[],
    strategies: FixStrategy[]
  ): Promise<boolean> {
    let appliedAny = false;

    for (const strategy of strategies) {
      try {
        switch (strategy.type) {
          case 'insert':
            if (strategy.new_work_orders && strategy.new_work_orders.length > 0) {
              const insertIdx = parseInt(strategy.target_work_orders[0], 10);
              workOrders.splice(insertIdx, 0, ...strategy.new_work_orders);
              appliedAny = true;
              console.log(`✅ Auto-fix: Inserted ${strategy.new_work_orders.length} work order(s) at position ${insertIdx}`);
            }
            break;

          case 'reorder':
            const woIdx = parseInt(strategy.target_work_orders[0], 10);
            const wo = workOrders[woIdx];
            // Remove the problematic dependency
            wo.dependencies = wo.dependencies.filter(dep => {
              const depIdx = parseInt(dep, 10);
              return depIdx !== woIdx; // Remove self-references and back-edges
            });
            appliedAny = true;
            console.log(`✅ Auto-fix: Removed circular dependency from WO-${woIdx}`);
            break;

          // Note: 'merge' and 'split' are suggestions only, not auto-applied
          case 'merge':
          case 'split':
            console.log(`ℹ️  Suggestion: ${strategy.description}`);
            break;
        }
      } catch (error: any) {
        console.error(`❌ Failed to apply fix strategy (${strategy.type}):`, error.message);
      }
    }

    return appliedAny;
  }

  /**
   * Renumber work order dependencies after insertions/deletions
   */
  renumberDependencies(workOrders: WorkOrder[]): void {
    const oldToNew = new Map<string, string>();

    // Build mapping of old indices to new indices
    workOrders.forEach((wo, newIdx) => {
      oldToNew.set(newIdx.toString(), newIdx.toString());
    });

    // Update all dependencies
    workOrders.forEach(wo => {
      wo.dependencies = wo.dependencies
        .map(dep => oldToNew.get(dep) || dep)
        .filter(dep => {
          const depIdx = parseInt(dep, 10);
          return !isNaN(depIdx) && depIdx >= 0 && depIdx < workOrders.length;
        });
    });
  }
}

export const dependencyValidator = DependencyValidator.getInstance();
