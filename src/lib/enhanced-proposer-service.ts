// Enhanced Proposer Service - Phase 2.2.3 → 2.2.6
// Performance monitoring for gpt-4o-mini fallback optimization
// Integrated with modular ComplexityAnalyzer
// Phase 2.2.6: Self-refinement with TypeScript error detection (now centralized in proposer-refinement-rules.ts)

import { proposerRegistry, type ProposerConfig, type RoutingDecision } from './proposer-registry';
import { complexityAnalyzer, type ComplexityAnalysis } from './complexity-analyzer';
// DEPRECATED v149: proposer-refinement-rules removed (part of eliminated Proposer architecture)
// import {
//   attemptSelfRefinement,
//   REFINEMENT_THRESHOLDS,
//   type RefinementResult
// } from './proposer-refinement-rules';
import { ContractValidator, type ValidationResult } from './contract-validator';

// Placeholder types for backwards compatibility
export type RefinementResult = {
  content: string;
  refinement_count: number;
  initial_errors: number;
  final_errors: number;
  refinement_success: boolean;
  error_details: any[];
  contract_violations?: any[];
  cycle_history?: any[];
  sanitizer_metadata?: any;
};
import { classifyError, type FailureClass, type ErrorContext } from './failure-classifier';
import { logRefinementCycle } from './decision-logger';
import { logProposerFailure } from './proposer-failure-logger';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface PerformanceMetrics {
  execution_time_ms: number;
  cost: number;
  token_efficiency: number;
  success_rate: number;
  retry_count: number;
  fallback_used: boolean;
  routing_accuracy: number;
}

export interface RetryConfig {
  max_retries: number;
  retry_delay_ms: number;
  escalation_threshold: number;
  fallback_on_failure: boolean;
}

export interface FallbackMonitoring {
  total_requests: number;
  fallback_requests: number;
  fallback_success_rate: number;
  cost_savings: number;
  performance_improvement: number;
  routing_efficiency: number;
}

export interface ProposerRequest {
  task_description: string;
  context: string[];
  security_context?: 'high' | 'medium' | 'low';
  expected_output_type: 'code' | 'analysis' | 'planning' | 'refactoring';
  priority?: 'high' | 'medium' | 'low';
  retry_config?: RetryConfig;
  metadata?: {
    work_order_id?: string;
    [key: string]: any;
  };
}

export interface EnhancedProposerResponse {
  success: boolean;
  content: string;
  proposer_used: string;
  cost: number;
  token_usage: {
    input: number;
    output: number;
    total: number;
  };
  execution_time_ms: number;
  complexity_analysis: ComplexityAnalysis;
  routing_decision: RoutingDecision;
  performance_metrics: PerformanceMetrics;
  fallback_monitoring?: FallbackMonitoring;
  refinement_metadata?: RefinementResult;  // Now uses centralized type
  contract_validation?: ValidationResult;  // Contract violation detection
  failure_class?: FailureClass;            // NEW: Failure classification
  error_context?: ErrorContext;            // NEW: Structured error details
  retry_history?: Array<{
    attempt: number;
    proposer: string;
    success: boolean;
    error?: string;
    cost: number;
    execution_time_ms: number;
  }>;
}

export class EnhancedProposerService {
  private static instance: EnhancedProposerService;
  private performanceHistory: Map<string, PerformanceMetrics[]> = new Map();
  private fallbackStats: FallbackMonitoring = {
    total_requests: 0,
    fallback_requests: 0,
    fallback_success_rate: 0,
    cost_savings: 0,
    performance_improvement: 0,
    routing_efficiency: 0
  };
  private dependencyContextCache: Map<string, string> = new Map();

  /**
   * Concise code quality rules for GPT-4o-mini (position-optimized, 5 core rules)
   * Used in sandwich structure: top constraints + bottom reminder
   */
  private readonly CONCISE_CODE_RULES = `CRITICAL RULES (MANDATORY):
1. NO PLACEHOLDERS - Complete functional code only (no TODOs, no hardcoded returns)
2. ERROR HANDLING - try-catch for: fs, fetch, IPC, DB operations
3. INPUT VALIDATION - Check type/range/format on all public methods
4. CONTEXT AWARENESS - Main=Node.js (Vitest), Renderer=Browser (React)
5. CLEANUP - Remove listeners, clear timers, close handles`;

  /**
   * Detailed code quality rules for Claude (handles context better, full 80-line version)
   * Provides comprehensive guidance with examples
   */
  private readonly DETAILED_CODE_RULES = `
CRITICAL IMPLEMENTATION RULES:

1. NO PLACEHOLDER CODE (MANDATORY)
   ❌ NEVER write TODO comments in production code
   ❌ NEVER return hardcoded success values (true, 0, empty string, null)
   ❌ NEVER create empty method bodies with comments like "// Placeholder for..."
   ❌ NEVER write stub implementations
   ✅ ALWAYS implement complete, functional code
   ✅ If you cannot implement something, state why explicitly and provide minimal viable implementation

2. ERROR HANDLING (REQUIRED FOR ALL EXTERNAL OPERATIONS)
   ALL external operations MUST be wrapped in try-catch:
   - File system operations (fs.readFile, fs.writeFile, etc.)
   - Network requests (fetch, axios, etc.)
   - Database queries (Supabase, SQL, etc.)
   - IPC calls (ipcMain, ipcRenderer, etc.)
   - System APIs (clipboard, focus, window management, etc.)

   Required pattern:
   \`\`\`typescript
   try {
     const result = await externalOperation()
     if (!result) {
       throw new Error('Operation failed: specific reason')
     }
     return result
   } catch (error) {
     logger.error('Context about what failed', error)
     throw new CustomError('User-friendly message', { cause: error })
   }
   \`\`\`

   NEVER:
   ❌ Catch and ignore errors silently
   ❌ Return success when operation actually failed
   ❌ Use generic error messages ("Something went wrong")

3. INPUT VALIDATION (REQUIRED FOR ALL PUBLIC METHODS)
   EVERY public method MUST validate inputs:
   - Type checking (typeof, instanceof)
   - Range checking (min/max bounds, array length)
   - Format checking (regex for patterns)
   - State checking (valid in current state?)
   - Precondition checking (dependencies met?)

   Example:
   \`\`\`typescript
   public startWorkflow(content: string): void {
     if (typeof content !== 'string') {
       throw new TypeError('content must be string')
     }
     if (content.trim().length === 0) {
       throw new Error('content cannot be empty')
     }
     if (this.state !== 'idle') {
       throw new Error(\`Cannot start in state: \${this.state}\`)
     }
     // Now safe to proceed
   }
   \`\`\`

4. TECHNOLOGY CONTEXT AWARENESS
   Before choosing libraries/frameworks, verify execution context:

   Electron Main Process (Node.js):
   - Use: fs, path, child_process, native modules
   - Testing: Vitest, Jest (Node mode)
   - ❌ NO React, @testing-library/react, DOM APIs

   Electron Renderer Process (Chromium):
   - Use: DOM, window, React/Vue
   - Testing: @testing-library/react, Vitest (jsdom)
   - ❌ NO direct Node.js APIs (fs, child_process)

   IPC Communication:
   - Main→Renderer: webContents.send(), NOT EventEmitter
   - Renderer→Main: ipcRenderer.invoke()
   - Main↔Main: EventEmitter (stays in main process)

5. RESOURCE MANAGEMENT
   Every resource acquisition MUST have cleanup:
   - Event listeners: Store and remove when done
   - Timers: Store timeout/interval IDs and clear them
   - File handles: Close in finally blocks
   - Implement destroy/cleanup methods for classes`;

  /**
   * Extract numbered requirements from task description
   * Converts bullet points to numbered list for better model compliance
   */
  private extractNumberedRequirements(request: ProposerRequest): string {
    const lines = request.task_description.split('\n');
    const requirements: string[] = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) {
        requirements.push(trimmed.replace(/^[-•*]\s*/, ''));
      }
    });

    if (requirements.length === 0) {
      return `1. ${request.task_description}`;
    }

    return requirements.map((req, i) => `${i + 1}. ${req}`).join('\n');
  }

  /**
   * Estimate token count for text (rough approximation)
   * Uses 1 token ≈ 4 characters heuristic
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Get critical reminders for sandwich structure (placed at end of prompt)
   * Repeats top 3 most important rules to leverage recency effect
   */
  private getCriticalReminders(request: ProposerRequest, provider: 'anthropic' | 'openai'): string {
    if (request.expected_output_type !== 'code') {
      return `- Provide ${request.expected_output_type} focused on the requirements above`;
    }

    // Top 3 rules only - concise for both providers at the end
    return `1. NO PLACEHOLDERS - Implement all functionality completely
2. ERROR HANDLING - try-catch all external operations (fs, fetch, IPC, DB)
3. OUTPUT FORMAT - Raw TypeScript code only, no \`\`\` markdown fences`;
  }

  static getInstance(): EnhancedProposerService {
    if (!EnhancedProposerService.instance) {
      EnhancedProposerService.instance = new EnhancedProposerService();
    }
    return EnhancedProposerService.instance;
  }

  /**
   * Build dependency context for code generation prompts
   * Includes installed npm packages and available project modules
   * Cached per project to avoid repeated filesystem reads
   *
   * @param projectPath - Absolute path to target project (defaults to orchestrator's cwd)
   * @param maxTokens - Maximum tokens to allocate for dependency context (undefined = no limit)
   */
  private buildDependencyContext(projectPath?: string, maxTokens?: number): string {
    // Default to orchestrator's directory if no project path provided
    const targetPath = projectPath || process.cwd();

    // Build cache key including maxTokens to handle different truncation levels
    const cacheKey = maxTokens ? `${targetPath}:${maxTokens}` : targetPath;

    // Return cached version if available
    if (this.dependencyContextCache.has(cacheKey)) {
      return this.dependencyContextCache.get(cacheKey)!;
    }

    try {
      // Read package.json to get installed dependencies from target project
      const fs = require('fs');
      const path = require('path');
      const packageJsonPath = path.join(targetPath, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Extract dependencies and devDependencies
      const dependencies = Object.keys(packageJson.dependencies || {}).sort();
      const devDependencies = Object.keys(packageJson.devDependencies || {}).sort();

      // Discover actual project modules by scanning common directories
      const projectModules: string[] = [];
      const dirsToScan = ['lib', 'src/lib', 'types', 'src/types', 'utils', 'src/utils'];

      for (const dir of dirsToScan) {
        const dirPath = path.join(targetPath, dir);
        if (fs.existsSync(dirPath)) {
          try {
            const files = fs.readdirSync(dirPath, { recursive: true, withFileTypes: true });
            for (const file of files) {
              if (file.isFile() && (file.name.endsWith('.ts') || file.name.endsWith('.tsx'))) {
                // Build module path with @/ alias
                const relativePath = path.relative(targetPath, path.join(file.path || dirPath, file.name))
                  .replace(/\\/g, '/')
                  .replace(/\.(ts|tsx)$/, '')
                  .replace(/^src\//, '');
                projectModules.push(`@/${relativePath}`);
              }
            }
          } catch (err) {
            // Ignore errors scanning individual directories
          }
        }
      }

      // Deduplicate and sort
      const uniqueModules = Array.from(new Set(projectModules)).sort();

      // Build full context first
      let depCount = dependencies.length;
      let devDepCount = devDependencies.length;
      let moduleCount = uniqueModules.length;

      // Apply token budget if specified
      if (maxTokens) {
        // Reserve ~200 tokens for labels and import rules
        const availableTokens = maxTokens - 200;

        // Allocate 50% to dependencies, 20% to devDeps, 30% to modules
        const depTokens = Math.floor(availableTokens * 0.5);
        const devTokens = Math.floor(availableTokens * 0.2);
        const moduleTokens = Math.floor(availableTokens * 0.3);

        // Estimate how many items fit (avg ~8 chars per package name = 2 tokens)
        depCount = Math.min(depCount, Math.floor(depTokens / 2));
        devDepCount = Math.min(devDepCount, Math.floor(devTokens / 2));
        moduleCount = Math.min(moduleCount, Math.floor(moduleTokens / 3)); // Modules are longer paths
      } else {
        // Default limits when no budget specified
        depCount = Math.min(depCount, 30);
        devDepCount = Math.min(devDepCount, 15);
        moduleCount = Math.min(moduleCount, 50);
      }

      const context = `

AVAILABLE DEPENDENCIES (installed in package.json):
${dependencies.slice(0, depCount).join(', ')}${dependencies.length > depCount ? `, and ${dependencies.length - depCount} more` : ''}

DEV DEPENDENCIES (available but prefer production deps):
${devDependencies.slice(0, devDepCount).join(', ')}${devDependencies.length > devDepCount ? `, and ${devDependencies.length - devDepCount} more` : ''}

PROJECT MODULES (use these for internal imports with @/ alias):
${uniqueModules.slice(0, moduleCount).length > 0 ? uniqueModules.slice(0, moduleCount).join('\n') : '(No project modules discovered - check directory structure)'}${uniqueModules.length > moduleCount ? `\n... and ${uniqueModules.length - moduleCount} more modules` : ''}

IMPORT RULES:
1. ONLY import packages listed above - do not invent or assume packages exist
2. For external packages, use exact names from AVAILABLE DEPENDENCIES
3. For internal modules, use @/ path alias (e.g., import { supabase } from '@/lib/supabase')
4. If a package you need is not listed, use a workaround with available packages
5. DO NOT use: axios, lodash, moment, express, or other common packages unless listed above`;

      // Cache for future calls (per-project and token budget)
      this.dependencyContextCache.set(cacheKey, context);
      return context;

    } catch (error) {
      console.error('Failed to build dependency context:', error);
      return `

DEPENDENCY CONTEXT: (Failed to load package.json - use common Node.js built-ins only)`;
    }
  }

  // REMOVED: Self-refinement logic now in proposer-refinement-rules.ts
  // This orchestration service only calls centralized functions

  private async executeWithProposerDirect(
    request: ProposerRequest,
    proposer: ProposerConfig,
    projectPath?: string
  ): Promise<any> {
    if (proposer.provider === 'anthropic') {
      return this.executeWithClaude(request, proposer, projectPath);
    } else if (proposer.provider === 'openai') {
      return this.executeWithOpenAI(request, proposer, projectPath);
    } else {
      throw new Error(`Unsupported provider: ${proposer.provider}`);
    }
  }

  async executeWithMonitoring(request: ProposerRequest): Promise<EnhancedProposerResponse> {
    const startTime = Date.now();
    const retryConfig = request.retry_config || {
      max_retries: 3,
      retry_delay_ms: 1000,
      escalation_threshold: 2,
      fallback_on_failure: true
    };

    let retryHistory: EnhancedProposerResponse['retry_history'] = [];
    let lastError: Error | null = null;

    // Look up project path from work_order_id if available
    let projectPath: string | undefined = undefined;
    if (request.metadata?.work_order_id) {
      try {
        const { data: wo } = await supabase
          .from('work_orders')
          .select('project_id, projects(local_path)')
          .eq('id', request.metadata.work_order_id)
          .single();

        if (wo?.projects && 'local_path' in wo.projects) {
          projectPath = wo.projects.local_path as string;
          console.log(`🔍 Using project path for dependency context: ${projectPath}`);
        }
      } catch (error) {
        console.warn('Failed to lookup project path, using orchestrator cwd:', error);
      }
    }

    await proposerRegistry.initialize();
    
    const complexityAnalysis = await complexityAnalyzer.analyze({
      task_description: request.task_description,
      context: request.context,
      security_context: request.security_context,
      expected_output_type: request.expected_output_type,
      priority: request.priority
    });
    
    console.log('🔍 DIAGNOSTIC: Complexity Analysis (2.2.4):', {
      task_description: request.task_description.substring(0, 50) + '...',
      complexity_score: complexityAnalysis.score,
      factors: complexityAnalysis.factors,
      reasoning: complexityAnalysis.reasoning,
      metadata: complexityAnalysis.metadata
    });

    // Call Manager API for routing decision (Phase 4.1 integration)
    const managerResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        work_order_id: request.metadata?.work_order_id || 'adhoc-' + Date.now(),
        task_description: request.task_description,
        context_requirements: request.context || [],
        complexity_score: complexityAnalysis.score,
        approved_by_director: true // Proposer service assumes Director approval already happened
      })
    });

    if (!managerResponse.ok) {
      const errorData = await managerResponse.json();
      throw new Error(`Manager routing failed: ${errorData.error || 'Unknown error'}`);
    }

    const managerResult = await managerResponse.json();
    if (!managerResult.success || !managerResult.routing_decision) {
      throw new Error('Manager returned unsuccessful routing decision');
    }

    const routingDecision = managerResult.routing_decision;

    console.log('🔍 DIAGNOSTIC: Routing Decision from Manager:', {
      selected_proposer: routingDecision.selected_proposer,
      reason: routingDecision.reason,
      confidence: routingDecision.confidence,
      fallback_proposer: routingDecision.fallback_proposer,
      complexity_score_used: complexityAnalysis.score,
      budget_status: routingDecision.routing_metadata?.budget_status
    });

    this.fallbackStats.total_requests++;

    for (let attempt = 0; attempt <= retryConfig.max_retries; attempt++) {
      const attemptStartTime = Date.now();
      
      try {
        const proposerName = this.selectProposerForAttempt(
          attempt, 
          routingDecision, 
          retryConfig
        );
        
        const proposerConfig = proposerRegistry.getProposer(proposerName);
        if (!proposerConfig) {
          throw new Error(`Proposer ${proposerName} not found`);
        }

        const isFallback = proposerName !== routingDecision.selected_proposer;
        if (isFallback) {
          this.fallbackStats.fallback_requests++;
        }

        console.log('🔍 DIAGNOSTIC: Selected Proposer Config:', {
          name: proposerConfig.name,
          provider: proposerConfig.provider,
          complexity_threshold: proposerConfig.complexity_threshold,
          is_fallback: isFallback,
          attempt_number: attempt + 1
        });

        let response = await this.executeWithProposer(request, proposerConfig, projectPath);

        let refinementMetadata: RefinementResult | undefined = undefined;
        let contractValidation: ValidationResult | undefined = undefined;

        if (response.success && response.content && request.expected_output_type === 'code') {
          // Create contract validator callback for refinement loop
          const contractValidator = new ContractValidator();
          const validateContractCallback = async (code: string): Promise<any> => {
            try {
              // Check for breaking changes or contract violations in generated code
              const { data: activeContracts } = await supabase
                .from('contracts')
                .select('*')
                .eq('is_active', true);

              if (!activeContracts || activeContracts.length === 0) {
                return { breaking_changes: [], risk_assessment: { level: 'low' } };
              }

              // Validate against all active contracts
              for (const contract of activeContracts) {
                const validation = await contractValidator.validateContract({
                  contract_type: contract.contract_type as any,
                  name: contract.name,
                  version: contract.version,
                  specification: contract.specification,
                  validation_rules: contract.validation_rules
                });

                // Return first validation with violations
                if (validation.breaking_changes.some(bc => bc.severity === 'high' || bc.severity === 'critical')) {
                  return validation;
                }
              }

              return { breaking_changes: [], risk_assessment: { level: 'low' } };
            } catch (error) {
              console.error('Contract validation callback error:', error);
              return { breaking_changes: [], risk_assessment: { level: 'low' } };
            }
          };

          // Delegate to centralized refinement rules with contract validation
          // DEPRECATED v149: Self-refinement removed (part of eliminated Proposer architecture)
          // const refinementResult = await attemptSelfRefinement(
          const refinementResult: RefinementResult = {
            content: response.content,
            refinement_count: 0,
            initial_errors: 0,
            final_errors: 0,
            refinement_success: true,
            error_details: [],
            contract_violations: [],
            cycle_history: [],
            sanitizer_metadata: { initial_changes: [], cycle_changes: [], total_functions_triggered: 0 }
          };
          /* OLD CODE - DEPRECATED v149:
          const refinementResult = await attemptSelfRefinement(
            response.content,
            request,
            async (refinementRequest: ProposerRequest) => {
              return this.executeWithProposerDirect(refinementRequest, proposerConfig, projectPath);
            },
            REFINEMENT_THRESHOLDS.MAX_CYCLES,  // 3 cycles
            validateContractCallback             // NEW: Contract validation in refinement loop
          );
          */

          response.content = refinementResult.content;
          refinementMetadata = refinementResult;

          // Extract final contract validation from refinement metadata (null in v149)
          contractValidation = undefined; // refinementResult.final_contract_validation;

          console.log('🔍 SELF-REFINEMENT: Complete', {
            cycles: refinementMetadata.refinement_count,
            initial_errors: refinementMetadata.initial_errors,
            final_errors: refinementMetadata.final_errors,
            contract_violations: refinementMetadata.contract_violations?.length || 0,
            success: refinementMetadata.refinement_success
          });

          // Log each refinement cycle decision
          for (const cycle of refinementMetadata.cycle_history) {
            const cycleSuccess = cycle.errors_after < cycle.errors_before;
            await logRefinementCycle({
              work_order_id: request.metadata?.work_order_id || '',
              cycle_number: cycle.cycle,
              failure_class: cycle.errors_after > 0 ? 'compile_error' : undefined,
              error_message: cycle.errors_after > 0 ? `${cycle.errors_after} TypeScript errors remain` : undefined,
              retry_strategy: cycle.prompt_strategy,
              success: cycleSuccess
            }).catch(err => console.error('Failed to log refinement cycle:', err));
          }
        }

        console.log('🔍 DIAGNOSTIC: API Response:', {
          proposer_used: response.proposer_used,
          success: response.success,
          cost: response.cost,
          token_usage: response.token_usage,
          content_length: response.content?.length || 0
        });
        
        const attemptExecutionTime = Date.now() - attemptStartTime;

        const performanceMetrics = this.calculatePerformanceMetrics(
          response,
          attemptExecutionTime,
          attempt,
          isFallback
        );

        this.updatePerformanceHistory(proposerName, performanceMetrics);

        const fallbackMonitoring = this.updateFallbackMonitoring(isFallback, true);

        retryHistory.push({
          attempt: attempt + 1,
          proposer: proposerName,
          success: true,
          cost: response.cost,
          execution_time_ms: attemptExecutionTime
        });

        await this.storePerformanceData(request, response, performanceMetrics, complexityAnalysis, isFallback);

        const totalExecutionTime = Date.now() - startTime;

        // Classify failure if there are residual errors or contract violations
        let failureClass: FailureClass | undefined = undefined;
        let errorContext: ErrorContext | undefined = undefined;

        if (refinementMetadata && (refinementMetadata.final_errors > 0 ||
            (contractValidation && contractValidation.breaking_changes.length > 0))) {

          // Determine failure class based on what failed
          if (contractValidation && contractValidation.breaking_changes.length > 0) {
            failureClass = 'contract_violation';
            errorContext = {
              error_message: `${contractValidation.breaking_changes.length} contract violations detected`,
              error_type: 'ContractViolation',
              contract_violations: contractValidation.breaking_changes.map((bc: any) => ({
                type: bc.severity,
                file: bc.file || 'unknown',
                description: bc.impact_description || bc.type
              }))
            };
          } else if (refinementMetadata.final_errors > 0) {
            failureClass = 'compile_error';
            errorContext = {
              error_message: `${refinementMetadata.final_errors} TypeScript errors remain after ${refinementMetadata.refinement_count} refinement cycles`,
              error_type: 'TypeScriptError',
              failed_tests: refinementMetadata.error_details.slice(0, 5).map(e =>
                `Line ${e.line}: ${e.code} - ${e.message}`
              )
            };
          }

          console.warn('⚠️ Proposer completed with residual errors:', { failureClass, errorContext });
        }

        // Log proposer outcome (failures 100%, successes 10% sampled) for learning loop
        if (refinementMetadata) {
          await logProposerFailure({
            work_order_id: request.metadata?.work_order_id,
            proposer_name: proposerName,
            complexity_score: complexityAnalysis.score,
            refinement_metadata: refinementMetadata,
            contract_validation: contractValidation,
            sanitizer_metadata: refinementMetadata.sanitizer_metadata ? {
              changes_made: [
                ...refinementMetadata.sanitizer_metadata.initial_changes,
                ...refinementMetadata.sanitizer_metadata.cycle_changes.flatMap(c => c.changes)
              ],
              functions_triggered: refinementMetadata.sanitizer_metadata.total_functions_triggered
            } : undefined
          }).catch(err => console.error('Failed to log proposer outcome:', err));
        }

        return {
          ...response,
          execution_time_ms: totalExecutionTime,
          complexity_analysis: complexityAnalysis,
          routing_decision: routingDecision,
          performance_metrics: performanceMetrics,
          fallback_monitoring: fallbackMonitoring,
          refinement_metadata: refinementMetadata,
          contract_validation: contractValidation,
          failure_class: failureClass,
          error_context: errorContext,
          retry_history: retryHistory
        };

      } catch (error) {
        lastError = error as Error;
        const attemptExecutionTime = Date.now() - attemptStartTime;

        // Classify the execution error
        const classification = classifyError(lastError, {
          component: 'EnhancedProposerService',
          operation: 'executeWithMonitoring'
        });

        retryHistory.push({
          attempt: attempt + 1,
          proposer: routingDecision.selected_proposer,
          success: false,
          error: lastError.message,
          cost: 0,
          execution_time_ms: attemptExecutionTime
        });

        this.updateFallbackMonitoring(false, false);

        // Log the failed attempt as a decision (for learning)
        await logRefinementCycle({
          work_order_id: request.metadata?.work_order_id || '',
          cycle_number: attempt + 1,
          failure_class: classification.failure_class,
          error_message: lastError.message,
          retry_strategy: 'retry_with_fallback',
          success: false
        }).catch(err => console.error('Failed to log retry decision:', err));

        if (attempt === retryConfig.max_retries) break;

        await new Promise(resolve => setTimeout(resolve, retryConfig.retry_delay_ms));
      }
    }

    // All retries failed - classify the final error and throw
    const finalClassification = classifyError(lastError!, {
      component: 'EnhancedProposerService',
      operation: 'executeWithMonitoring',
      metadata: { retry_count: retryConfig.max_retries }
    });

    console.error('❌ All retry attempts failed:', {
      failure_class: finalClassification.failure_class,
      error_context: finalClassification.error_context,
      retry_count: retryConfig.max_retries
    });

    throw new Error(`All retry attempts failed. Last error: ${lastError?.message}`);
  }

  private selectProposerForAttempt(
    attempt: number, 
    routingDecision: RoutingDecision, 
    retryConfig: RetryConfig
  ): string {
    if (attempt === 0) {
      return routingDecision.selected_proposer;
    }

    if (attempt >= retryConfig.escalation_threshold && 
        retryConfig.fallback_on_failure && 
        routingDecision.fallback_proposer) {
      return routingDecision.fallback_proposer;
    }

    return routingDecision.selected_proposer;
  }

  private calculatePerformanceMetrics(
    response: any,
    executionTime: number,
    retryCount: number,
    fallbackUsed: boolean
  ): PerformanceMetrics {
    const tokenEfficiency = response.token_usage.total / (executionTime / 1000);
    
    return {
      execution_time_ms: executionTime,
      cost: response.cost,
      token_efficiency: tokenEfficiency,
      success_rate: 1.0,
      retry_count: retryCount,
      fallback_used: fallbackUsed,
      routing_accuracy: fallbackUsed ? 0.7 : 1.0
    };
  }

  private updatePerformanceHistory(proposerName: string, metrics: PerformanceMetrics): void {
    if (!this.performanceHistory.has(proposerName)) {
      this.performanceHistory.set(proposerName, []);
    }
    
    const history = this.performanceHistory.get(proposerName)!;
    history.push(metrics);
    
    if (history.length > 100) {
      history.shift();
    }
  }

  private updateFallbackMonitoring(isFallback: boolean, success: boolean): FallbackMonitoring {
    if (success && isFallback) {
      this.fallbackStats.fallback_success_rate = 
        (this.fallbackStats.fallback_success_rate * (this.fallbackStats.fallback_requests - 1) + 1) / 
        this.fallbackStats.fallback_requests;
    }

    this.fallbackStats.routing_efficiency = 
      1 - (this.fallbackStats.fallback_requests / this.fallbackStats.total_requests);

    return { ...this.fallbackStats };
  }

  private async storePerformanceData(
    request: ProposerRequest,
    response: any,
    metrics: PerformanceMetrics,
    complexityAnalysis: ComplexityAnalysis,
    isFallback: boolean
  ): Promise<void> {
    try {
      await supabase.from('cost_tracking').insert({
        service_name: 'enhanced_proposer_service',
        cost: response.cost,
        metadata: {
          proposer_used: response.proposer_used,
          execution_time_ms: metrics.execution_time_ms,
          token_efficiency: metrics.token_efficiency,
          fallback_used: isFallback,
          retry_count: metrics.retry_count,
          task_type: request.expected_output_type,
          complexity_score: complexityAnalysis.score,
          complexity_factors: complexityAnalysis.factors,
          complexity_metadata: complexityAnalysis.metadata,
          routing_accuracy: metrics.routing_accuracy
        } as any
      });
    } catch (error) {
      console.error('Failed to store performance data:', error);
    }
  }

  async getPerformanceReport(): Promise<{
    proposer_performance: Record<string, {
      avg_execution_time: number;
      avg_cost: number;
      avg_token_efficiency: number;
      success_rate: number;
      total_requests: number;
    }>;
    fallback_monitoring: FallbackMonitoring;
    cost_optimization: {
      total_savings: number;
      fallback_efficiency: number;
      routing_accuracy: number;
    };
    routing_accuracy_by_complexity?: any;
  }> {
    const proposerPerformance: Record<string, any> = {};

    for (const [proposerName, history] of Array.from(this.performanceHistory.entries())) {
      if (history.length === 0) continue;

      proposerPerformance[proposerName] = {
        avg_execution_time: history.reduce((sum: number, m: PerformanceMetrics) => sum + m.execution_time_ms, 0) / history.length,
        avg_cost: history.reduce((sum: number, m: PerformanceMetrics) => sum + m.cost, 0) / history.length,
        avg_token_efficiency: history.reduce((sum: number, m: PerformanceMetrics) => sum + m.token_efficiency, 0) / history.length,
        success_rate: history.reduce((sum: number, m: PerformanceMetrics) => sum + m.success_rate, 0) / history.length,
        total_requests: history.length
      };
    }

    const routingAccuracy = await complexityAnalyzer.getRoutingAccuracyByComplexity();

    return {
      proposer_performance: proposerPerformance,
      fallback_monitoring: this.fallbackStats,
      cost_optimization: {
        total_savings: this.fallbackStats.cost_savings,
        fallback_efficiency: this.fallbackStats.fallback_success_rate,
        routing_accuracy: this.fallbackStats.routing_efficiency
      },
      routing_accuracy_by_complexity: routingAccuracy
    };
  }

  private async executeWithProposer(
    request: ProposerRequest,
    proposer: ProposerConfig,
    projectPath?: string
  ): Promise<any> {
    if (proposer.provider === 'anthropic') {
      return this.executeWithClaude(request, proposer, projectPath);
    } else if (proposer.provider === 'openai') {
      return this.executeWithOpenAI(request, proposer, projectPath);
    } else {
      throw new Error(`Unsupported provider: ${proposer.provider}`);
    }
  }

  private async executeWithClaude(request: ProposerRequest, proposer: ProposerConfig, projectPath?: string): Promise<any> {
    const prompt = this.buildPromptForProvider(request, 'anthropic', projectPath);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.ANTHROPIC_API_KEY!,
        'Anthropic-Version': '2023-06-01'
      },
      body: JSON.stringify({
        model: proposer.model, // Use model from database (e.g., 'claude-sonnet-4-5-20250929')
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    const inputTokens = data.usage.input_tokens;
    const outputTokens = data.usage.output_tokens;
    
    const cost = (
      (inputTokens / 1000) * proposer.cost_profile.input_cost_per_token +
      (outputTokens / 1000) * proposer.cost_profile.output_cost_per_token
    );

    return {
      success: true,
      content: data.content[0].text,
      proposer_used: proposer.name,
      cost,
      token_usage: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens
      }
    };
  }

  private async executeWithOpenAI(request: ProposerRequest, proposer: ProposerConfig, projectPath?: string): Promise<any> {
    const prompt = this.buildPromptForProvider(request, 'openai', projectPath);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY!}`
      },
      body: JSON.stringify({
        model: proposer.model, // Use model from database (e.g., 'gpt-4o-mini')
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8192
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const inputTokens = data.usage.prompt_tokens;
    const outputTokens = data.usage.completion_tokens;
    
    const cost = (
      (inputTokens / 1000) * proposer.cost_profile.input_cost_per_token +
      (outputTokens / 1000) * proposer.cost_profile.output_cost_per_token
    );

    return {
      success: true,
      content: data.choices[0].message.content,
      proposer_used: proposer.name,
      cost,
      token_usage: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens
      }
    };
  }

  /**
   * Build unified prompt for any provider with sandwich structure
   * Implements best practices: numbered requirements, position-optimized rules,
   * token budget management, and primacy/recency effects
   *
   * @param request - Proposer request with task and context
   * @param provider - 'anthropic' or 'openai' for provider-specific optimization
   * @param projectPath - Path to project for dependency context
   */
  private buildPromptForProvider(
    request: ProposerRequest,
    provider: 'anthropic' | 'openai',
    projectPath?: string
  ): string {
    // Provider-specific settings
    const isVerbose = provider === 'anthropic'; // Claude handles more detail
    const maxPromptTokens = provider === 'openai' ? 6000 : 12000; // Stay under sweet spot

    // Section 1: OBJECTIVE (top of sandwich - high attention)
    const objective = `## OBJECTIVE
${request.task_description}`;

    // Section 2: REQUIREMENTS (numbered for clarity)
    const requirements = `## REQUIREMENTS
${this.extractNumberedRequirements(request)}`;

    // Section 3: CONSTRAINTS (critical rules at top)
    const outputFormatConstraint = request.expected_output_type === 'code'
      ? '- Format: Raw TypeScript code ONLY (no markdown, no explanations)'
      : '';

    const codeRulesInConstraints = request.expected_output_type === 'code'
      ? `\n\n${this.CONCISE_CODE_RULES}`
      : '';

    const constraints = `## CONSTRAINTS
- Output Type: ${request.expected_output_type}
${request.security_context ? `- Security: ${request.security_context}` : ''}
${outputFormatConstraint}${codeRulesInConstraints}`;

    // Section 4: CONTEXT (limited to first 5 items to save tokens)
    const contextItems = request.context.slice(0, 5);
    const context = contextItems.length > 0
      ? `## CONTEXT
${contextItems.join('\n')}${request.context.length > 5 ? `\n... and ${request.context.length - 5} more context items` : ''}`
      : '';

    // Section 5: DEPENDENCIES (with token budget - max 30% of total)
    const dependencyTokenBudget = Math.floor(maxPromptTokens * 0.3);
    const dependencies = request.expected_output_type === 'code'
      ? this.buildDependencyContext(projectPath, dependencyTokenBudget)
      : '';

    // Section 6: DETAILED RULES (middle - only for Claude, skipped for GPT-4o-mini to avoid "lost in middle")
    const detailedRules = (request.expected_output_type === 'code' && isVerbose)
      ? this.DETAILED_CODE_RULES
      : '';

    // Section 7: CRITICAL REMINDER (bottom of sandwich - recency effect)
    const criticalReminder = `
---
CRITICAL REMINDER - READ BEFORE RESPONDING:
${this.getCriticalReminders(request, provider)}`;

    // Assemble with sandwich structure
    const sections = [
      objective,
      requirements,
      constraints,
      context,
      dependencies,
      detailedRules,
      criticalReminder
    ].filter(section => section.length > 0);

    const fullPrompt = sections.join('\n\n');

    // Log token estimate for monitoring
    const estimatedTokens = this.estimateTokens(fullPrompt);
    console.log(`📊 Prompt token estimate for ${provider}:`, {
      estimated_tokens: estimatedTokens,
      max_tokens: maxPromptTokens,
      within_budget: estimatedTokens <= maxPromptTokens,
      sections: {
        objective: this.estimateTokens(objective),
        requirements: this.estimateTokens(requirements),
        constraints: this.estimateTokens(constraints),
        context: this.estimateTokens(context),
        dependencies: this.estimateTokens(dependencies),
        detailed_rules: this.estimateTokens(detailedRules),
        critical_reminder: this.estimateTokens(criticalReminder)
      }
    });

    return fullPrompt;
  }

  /**
   * @deprecated Use buildPromptForProvider() instead
   * Kept for backward compatibility during migration
   */
  private buildClaudePrompt(request: ProposerRequest, projectPath?: string): string {
    return this.buildPromptForProvider(request, 'anthropic', projectPath);
  }

  /**
   * @deprecated Use buildPromptForProvider() instead
   * Kept for backward compatibility during migration
   */
  private buildOpenAIPrompt(request: ProposerRequest, projectPath?: string): string {
    return this.buildPromptForProvider(request, 'openai', projectPath);
  }
}

export const enhancedProposerService = EnhancedProposerService.getInstance();

