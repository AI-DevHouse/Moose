// Enhanced Proposer Service - Phase 2.2.3 → 2.2.6
// Performance monitoring for gpt-4o-mini fallback optimization
// Integrated with modular ComplexityAnalyzer
// Phase 2.2.6: Self-refinement with TypeScript error detection

import { proposerRegistry, type ProposerConfig, type RoutingDecision } from './proposer-registry';
import { complexityAnalyzer, type ComplexityAnalysis, parseTypeScriptErrors, type TypeScriptError } from './complexity-analyzer';
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
  refinement_metadata?: {
    refinement_count: number;
    initial_errors: number;
    final_errors: number;
    refinement_success: boolean;
    error_details: TypeScriptError[];
  };
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

  private async attemptSelfRefinement(
    originalContent: string,
    request: ProposerRequest,
    proposer: ProposerConfig,
    maxAttempts: number = 1
  ): Promise<{
    content: string;
    refinement_count: number;
    initial_errors: number;
    final_errors: number;
    refinement_success: boolean;
    error_details: TypeScriptError[];
  }> {
    let currentContent = originalContent;
    let refinementCount = 0;
    let initialErrorCount = 0;
    let currentErrors: TypeScriptError[] = [];

    const initialErrors = await this.checkTypeScriptErrors(currentContent);
    initialErrorCount = initialErrors.length;
    currentErrors = initialErrors;

    console.log('🔍 SELF-REFINEMENT: Initial TS check found', initialErrorCount, 'errors');

    if (initialErrorCount === 0) {
      return {
        content: currentContent,
        refinement_count: 0,
        initial_errors: 0,
        final_errors: 0,
        refinement_success: true,
        error_details: []
      };
    }

    while (refinementCount < maxAttempts && currentErrors.length > 0) {
      refinementCount++;
      
      console.log(`🔧 SELF-REFINEMENT: Attempt ${refinementCount}/${maxAttempts}`);
      console.log('   Errors to fix:', currentErrors.map(e => `${e.code}: ${e.message}`).join('; '));

      const refinementPrompt = this.buildRefinementPrompt(request, currentContent, currentErrors);

      const refinedResponse = await this.executeWithProposerDirect(
        { ...request, task_description: refinementPrompt },
        proposer
      );

      currentContent = refinedResponse.content;

      const newErrors = await this.checkTypeScriptErrors(currentContent);
      
      console.log(`   Result: ${currentErrors.length} → ${newErrors.length} errors`);

      currentErrors = newErrors;
    }

    const refinementSuccess = currentErrors.length < initialErrorCount;

    return {
      content: currentContent,
      refinement_count: refinementCount,
      initial_errors: initialErrorCount,
      final_errors: currentErrors.length,
      refinement_success: refinementSuccess,
      error_details: currentErrors
    };
  }

  private async checkTypeScriptErrors(code: string): Promise<TypeScriptError[]> {
    const fs = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');

    const tempDir = path.join(process.cwd(), '.temp-refinement');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFile = path.join(tempDir, `check-${Date.now()}.ts`);
    
    try {
      fs.writeFileSync(tempFile, code, 'utf8');

      execSync(`npx tsc --noEmit ${tempFile}`, {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: 'pipe'
      });

      return [];

    } catch (error: any) {
      const stderr = error.stderr || error.stdout || '';
      const errors = parseTypeScriptErrors(stderr);
      return errors;

    } finally {
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch (cleanupError) {
        console.error('Failed to cleanup temp file:', cleanupError);
      }
    }
  }

  private buildRefinementPrompt(
    request: ProposerRequest,
    previousCode: string,
    errors: TypeScriptError[]
  ): string {
    const errorSummary = errors.map(e => 
      `- Line ${e.line}, Column ${e.column}: ${e.code} - ${e.message}`
    ).join('\n');

    return `${request.task_description}

PREVIOUS ATTEMPT HAD TYPESCRIPT ERRORS:
${errorSummary}

PREVIOUS CODE:
\`\`\`typescript
${previousCode}
\`\`\`

Please fix these TypeScript errors and provide corrected code. Ensure:
1. All imports are present
2. All types are correctly defined
3. All variables are declared before use
4. Function signatures have proper type annotations
5. No syntax errors

Provide only the corrected code without explanation.`;
  }

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
    
    const routingDecision = await proposerRegistry.routeRequest(
      request.task_description,
      complexityAnalysis.score,
      request.context,
      complexityAnalysis.hard_stop_required || false
    );
    
    console.log('🔍 DIAGNOSTIC: Routing Decision:', {
      selected_proposer: routingDecision.selected_proposer,
      reason: routingDecision.reason,
      confidence: routingDecision.confidence,
      fallback_proposer: routingDecision.fallback_proposer,
      complexity_score_used: complexityAnalysis.score
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
        
        let refinementMetadata = undefined;
        if (response.success && response.content && request.expected_output_type === 'code') {
          const refinementResult = await this.attemptSelfRefinement(
            response.content,
            request,
            proposerConfig,
            1
          );
          
          response.content = refinementResult.content;
          
          refinementMetadata = {
            refinement_count: refinementResult.refinement_count,
            initial_errors: refinementResult.initial_errors,
            final_errors: refinementResult.final_errors,
            refinement_success: refinementResult.refinement_success,
            error_details: refinementResult.error_details
          };

          console.log('🔍 SELF-REFINEMENT: Complete', refinementMetadata);
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

        return {
          ...response,
          execution_time_ms: totalExecutionTime,
          complexity_analysis: complexityAnalysis,
          routing_decision: routingDecision,
          performance_metrics: performanceMetrics,
          fallback_monitoring: fallbackMonitoring,
          refinement_metadata: refinementMetadata,
          retry_history: retryHistory
        };

      } catch (error) {
        lastError = error as Error;
        const attemptExecutionTime = Date.now() - attemptStartTime;

        retryHistory.push({
          attempt: attempt + 1,
          proposer: routingDecision.selected_proposer,
          success: false,
          error: lastError.message,
          cost: 0,
          execution_time_ms: attemptExecutionTime
        });

        this.updateFallbackMonitoring(false, false);

        if (attempt === retryConfig.max_retries) break;

        await new Promise(resolve => setTimeout(resolve, retryConfig.retry_delay_ms));
      }
    }

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
        }
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
    
    for (const [proposerName, history] of this.performanceHistory.entries()) {
      if (history.length === 0) continue;
      
      proposerPerformance[proposerName] = {
        avg_execution_time: history.reduce((sum, m) => sum + m.execution_time_ms, 0) / history.length,
        avg_cost: history.reduce((sum, m) => sum + m.cost, 0) / history.length,
        avg_token_efficiency: history.reduce((sum, m) => sum + m.token_efficiency, 0) / history.length,
        success_rate: history.reduce((sum, m) => sum + m.success_rate, 0) / history.length,
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
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
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
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000
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

