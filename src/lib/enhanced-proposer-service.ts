// Enhanced Proposer Service - Phase 2.2.3 → 2.2.6
// Performance monitoring for gpt-4o-mini fallback optimization
// Integrated with modular ComplexityAnalyzer
// Phase 2.2.6: Self-refinement with TypeScript error detection (now centralized in proposer-refinement-rules.ts)

import { proposerRegistry, type ProposerConfig, type RoutingDecision } from './proposer-registry';
import { complexityAnalyzer, type ComplexityAnalysis } from './complexity-analyzer';
import {
  attemptSelfRefinement,
  REFINEMENT_THRESHOLDS,
  type RefinementResult
} from './proposer-refinement-rules';
import { ContractValidator, type ValidationResult } from './contract-validator';
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

  static getInstance(): EnhancedProposerService {
    if (!EnhancedProposerService.instance) {
      EnhancedProposerService.instance = new EnhancedProposerService();
    }
    return EnhancedProposerService.instance;
  }

  // REMOVED: Self-refinement logic now in proposer-refinement-rules.ts
  // This orchestration service only calls centralized functions

  private async executeWithProposerDirect(
    request: ProposerRequest, 
    proposer: ProposerConfig
  ): Promise<any> {
    if (proposer.provider === 'anthropic') {
      return this.executeWithClaude(request, proposer);
    } else if (proposer.provider === 'openai') {
      return this.executeWithOpenAI(request, proposer);
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

        let response = await this.executeWithProposer(request, proposerConfig);

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
          const refinementResult = await attemptSelfRefinement(
            response.content,
            request,
            async (refinementRequest: ProposerRequest) => {
              return this.executeWithProposerDirect(refinementRequest, proposerConfig);
            },
            REFINEMENT_THRESHOLDS.MAX_CYCLES,  // 3 cycles
            validateContractCallback             // NEW: Contract validation in refinement loop
          );

          response.content = refinementResult.content;
          refinementMetadata = refinementResult;

          // Extract final contract validation from refinement metadata
          contractValidation = refinementResult.final_contract_validation;

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
    proposer: ProposerConfig
  ): Promise<any> {
    if (proposer.provider === 'anthropic') {
      return this.executeWithClaude(request, proposer);
    } else if (proposer.provider === 'openai') {
      return this.executeWithOpenAI(request, proposer);
    } else {
      throw new Error(`Unsupported provider: ${proposer.provider}`);
    }
  }

  private async executeWithClaude(request: ProposerRequest, proposer: ProposerConfig): Promise<any> {
    const prompt = this.buildClaudePrompt(request);

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

  private async executeWithOpenAI(request: ProposerRequest, proposer: ProposerConfig): Promise<any> {
    const prompt = this.buildOpenAIPrompt(request);

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

  private buildClaudePrompt(request: ProposerRequest): string {
    return `Task: ${request.task_description}

Context: ${request.context.join('\n')}

Expected Output Type: ${request.expected_output_type}
${request.security_context ? `Security Context: ${request.security_context}` : ''}

Please provide a detailed, well-structured response that addresses the task requirements. Focus on accuracy, clarity, and actionable guidance.`;
  }

  private buildOpenAIPrompt(request: ProposerRequest): string {
    return `${request.task_description}

Context: ${request.context.join(' ')}

Provide a concise, practical response for ${request.expected_output_type}.`;
  }
}

export const enhancedProposerService = EnhancedProposerService.getInstance();

