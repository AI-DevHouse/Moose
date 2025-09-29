// Enhanced Proposer Service - Phase 2.2.3
// Performance monitoring for gpt-4o-mini fallback optimization

import { proposerRegistry, type ProposerConfig, type RoutingDecision } from './proposer-registry';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface PerformanceMetrics {
  execution_time_ms: number;
  cost: number;
  token_efficiency: number; // tokens per second
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
  complexity_analysis: {
    score: number;
    factors: Record<string, number>;
    reasoning: string;
  };
  routing_decision: RoutingDecision;
  performance_metrics: PerformanceMetrics;
  fallback_monitoring?: FallbackMonitoring;
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
    
    // Analyze complexity for initial routing
    const complexityAnalysis = await this.analyzeComplexity(request);
    console.log('🔍 DIAGNOSTIC: Complexity Analysis:', {
      task_description: request.task_description.substring(0, 50) + '...',
      complexity_score: complexityAnalysis.score,
      factors: complexityAnalysis.factors,
      reasoning: complexityAnalysis.reasoning
    });
    
    const routingDecision = await proposerRegistry.routeRequest(
      request.task_description,
      complexityAnalysis.score,
      request.context
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
      try {
        const attemptStartTime = Date.now();
        
        // Determine proposer for this attempt
        const proposerName = this.selectProposerForAttempt(
          attempt, 
          routingDecision, 
          retryConfig
        );
        
        const proposerConfig = proposerRegistry.getProposer(proposerName);
        if (!proposerConfig) {
          throw new Error(`Proposer ${proposerName} not found`);
        }

        // Track if this is a fallback request
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

        // Execute request
        const response = await this.executeWithProposer(request, proposerConfig);
        
        console.log('🔍 DIAGNOSTIC: API Response:', {
          proposer_used: response.proposer_used,
          success: response.success,
          cost: response.cost,
          token_usage: response.token_usage,
          content_length: response.content?.length || 0
        });
        const attemptExecutionTime = Date.now() - attemptStartTime;

        // Calculate performance metrics
        const performanceMetrics = this.calculatePerformanceMetrics(
          response,
          attemptExecutionTime,
          attempt,
          isFallback
        );

        // Update performance history
        this.updatePerformanceHistory(proposerName, performanceMetrics);

        // Update fallback monitoring
        const fallbackMonitoring = this.updateFallbackMonitoring(isFallback, true);

        // Record successful attempt
        retryHistory.push({
          attempt: attempt + 1,
          proposer: proposerName,
          success: true,
          cost: response.cost,
          execution_time_ms: attemptExecutionTime
        });

        // Store performance data in database
        await this.storePerformanceData(request, response, performanceMetrics, isFallback);

        const totalExecutionTime = Date.now() - startTime;

        return {
          ...response,
          execution_time_ms: totalExecutionTime,
          complexity_analysis: complexityAnalysis,
          routing_decision: routingDecision,
          performance_metrics: performanceMetrics,
          fallback_monitoring: fallbackMonitoring,
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

        // Update fallback monitoring for failure
        this.updateFallbackMonitoring(false, false);

        // If this is the last attempt, break
        if (attempt === retryConfig.max_retries) break;

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryConfig.retry_delay_ms));
      }
    }

    // All retries failed
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

    // Use fallback after escalation threshold
    if (attempt >= retryConfig.escalation_threshold && 
        retryConfig.fallback_on_failure && 
        routingDecision.fallback_proposer) {
      return routingDecision.fallback_proposer;
    }

    return routingDecision.selected_proposer;
  }

  private async analyzeComplexity(request: ProposerRequest) {
    const { task_description, context, security_context, expected_output_type } = request;
    
    // Reuse existing complexity analysis logic
    const codeComplexity = this.assessCodeComplexity(task_description);
    const contextRequirements = this.assessContextRequirements(context);
    const securityImplications = this.assessSecurityImplications(security_context, task_description);
    const architecturalImpact = this.assessArchitecturalImpact(task_description, expected_output_type);
    const reasoningDepth = this.assessReasoningDepth(task_description, expected_output_type);

    const factors = {
      codeComplexity,
      contextRequirements,
      securityImplications,
      architecturalImpact,
      reasoningDepth
    };

    const score = (
      codeComplexity * 0.25 +
      contextRequirements * 0.15 +
      securityImplications * 0.20 +
      architecturalImpact * 0.25 +
      reasoningDepth * 0.15
    );

    const reasoning = this.generateComplexityReasoning(factors, score);

    return { score, factors, reasoning };
  }

  private calculatePerformanceMetrics(
    response: any,
    executionTime: number,
    retryCount: number,
    fallbackUsed: boolean
  ): PerformanceMetrics {
    const tokenEfficiency = response.token_usage.total / (executionTime / 1000); // tokens per second
    
    return {
      execution_time_ms: executionTime,
      cost: response.cost,
      token_efficiency: tokenEfficiency,
      success_rate: 1.0, // This execution succeeded
      retry_count: retryCount,
      fallback_used: fallbackUsed,
      routing_accuracy: fallbackUsed ? 0.7 : 1.0 // Lower if fallback was needed
    };
  }

  private updatePerformanceHistory(proposerName: string, metrics: PerformanceMetrics): void {
    if (!this.performanceHistory.has(proposerName)) {
      this.performanceHistory.set(proposerName, []);
    }
    
    const history = this.performanceHistory.get(proposerName)!;
    history.push(metrics);
    
    // Keep only last 100 entries
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
          complexity_score: response.complexity_analysis?.score || 0
        }
      });
    } catch (error) {
      console.error('Failed to store performance data:', error);
      // Don't throw - this is monitoring, not critical path
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

    return {
      proposer_performance: proposerPerformance,
      fallback_monitoring: this.fallbackStats,
      cost_optimization: {
        total_savings: this.fallbackStats.cost_savings,
        fallback_efficiency: this.fallbackStats.fallback_success_rate,
        routing_accuracy: this.fallbackStats.routing_efficiency
      }
    };
  }

  // Reuse existing complexity assessment methods from original service
  private assessCodeComplexity(description: string): number {
    const complexityIndicators = [
      /\b(refactor|architecture|design pattern|algorithm|optimization)\b/i,
      /\b(async|concurrent|parallel|threading|performance)\b/i,
      /\b(integration|api|database|schema|migration)\b/i,
      /\b(complex|sophisticated|advanced|enterprise)\b/i,
      /\b(multi-step|workflow|orchestration|pipeline)\b/i
    ];

    let score = 0.1;
    complexityIndicators.forEach(pattern => {
      if (pattern.test(description)) score += 0.18;
    });

    return Math.min(score, 1.0);
  }

  private assessContextRequirements(context: string[]): number {
    const contextSize = context.join(' ').length;
    if (contextSize > 10000) return 0.9;
    if (contextSize > 5000) return 0.7;
    if (contextSize > 2000) return 0.5;
    if (contextSize > 500) return 0.3;
    return 0.1;
  }

  private assessSecurityImplications(security_context: string | undefined, description: string): number {
    if (security_context === 'high') return 0.9;
    if (security_context === 'medium') return 0.6;
    
    const securityKeywords = /\b(auth|security|encryption|permission|validate|sanitize|vulnerability)\b/i;
    return securityKeywords.test(description) ? 0.7 : 0.2;
  }

  private assessArchitecturalImpact(description: string, outputType: string): number {
    const architecturalKeywords = /\b(architecture|system|infrastructure|scalability|maintainability)\b/i;
    
    if (outputType === 'planning' && architecturalKeywords.test(description)) return 0.8;
    if (outputType === 'analysis' && architecturalKeywords.test(description)) return 0.7;
    if (architecturalKeywords.test(description)) return 0.6;
    
    return 0.2;
  }

  private assessReasoningDepth(description: string, outputType: string): number {
    const reasoningKeywords = /\b(analyze|evaluate|compare|assess|strategy|decision|trade-off)\b/i;
    
    if (outputType === 'analysis') return 0.8;
    if (outputType === 'planning') return 0.7;
    if (reasoningKeywords.test(description)) return 0.6;
    
    return 0.3;
  }

  private generateComplexityReasoning(factors: Record<string, number>, score: number): string {
    const highFactors = Object.entries(factors)
      .filter(([_, value]) => value > 0.6)
      .map(([key, _]) => key);

    if (score > 0.7) {
      return `High complexity (${score.toFixed(2)}) due to: ${highFactors.join(', ')}. Requires Claude Sonnet 4.`;
    } else if (score > 0.4) {
      return `Medium complexity (${score.toFixed(2)}). Factors: ${highFactors.join(', ') || 'moderate requirements'}.`;
    } else {
      return `Low complexity (${score.toFixed(2)}). Suitable for gpt-4o-mini optimization.`;
    }
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
      (inputTokens / 1000) * proposer.cost_profile.input_cost_per_1k_tokens +
      (outputTokens / 1000) * proposer.cost_profile.output_cost_per_1k_tokens
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
      (inputTokens / 1000) * proposer.cost_profile.input_cost_per_1k_tokens +
      (outputTokens / 1000) * proposer.cost_profile.output_cost_per_1k_tokens
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