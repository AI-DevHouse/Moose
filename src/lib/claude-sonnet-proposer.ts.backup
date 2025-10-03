import { proposerRegistry, type ProposerConfig, type RoutingDecision } from './proposer-registry';

export interface ComplexityAnalysis {
  score: number;
  factors: {
    codeComplexity: number;
    contextRequirements: number;
    securityImplications: number;
    architecturalImpact: number;
    reasoningDepth: number;
  };
  reasoning: string;
}

export interface ProposerRequest {
  task_description: string;
  context: string[];
  security_context?: 'high' | 'medium' | 'low';
  expected_output_type: 'code' | 'analysis' | 'planning' | 'refactoring';
}

export interface ProposerResponse {
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
}

export class ClaudeSonnetProposer {
  private static instance: ClaudeSonnetProposer;
  
  static getInstance(): ClaudeSonnetProposer {
    if (!ClaudeSonnetProposer.instance) {
      ClaudeSonnetProposer.instance = new ClaudeSonnetProposer();
    }
    return ClaudeSonnetProposer.instance;
  }

  async analyzeComplexity(request: ProposerRequest): Promise<ComplexityAnalysis> {
    const { task_description, context, security_context, expected_output_type } = request;
    
    // Analyze different complexity factors
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

    // Weighted complexity score
    const score = (
      codeComplexity * 0.25 +
      contextRequirements * 0.15 +
      securityImplications * 0.20 +
      architecturalImpact * 0.25 +
      reasoningDepth * 0.15
    );

    const reasoning = this.generateComplexityReasoning(factors, score);

    return {
      score,
      factors,
      reasoning
    };
  }

  private assessCodeComplexity(description: string): number {
    const complexityIndicators = [
      /\b(refactor|architecture|design pattern|algorithm|optimization)\b/i,
      /\b(async|concurrent|parallel|threading|performance)\b/i,
      /\b(integration|api|database|schema|migration)\b/i,
      /\b(complex|sophisticated|advanced|enterprise)\b/i,
      /\b(multi-step|workflow|orchestration|pipeline)\b/i
    ];

    let score = 0.1; // Base score
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

  private generateComplexityReasoning(factors: ComplexityAnalysis['factors'], score: number): string {
    const highFactors = Object.entries(factors)
      .filter(([_, value]) => value > 0.6)
      .map(([key, _]) => key);

    if (score > 0.7) {
      return `High complexity (${score.toFixed(2)}) due to: ${highFactors.join(', ')}. Requires Claude Sonnet 4.`;
    } else if (score > 0.4) {
      return `Medium complexity (${score.toFixed(2)}). Factors: ${highFactors.join(', ') || 'moderate requirements'}.`;
    } else {
      return `Low complexity (${score.toFixed(2)}). Suitable for cost-optimized routing.`;
    }
  }

  async routeAndExecute(request: ProposerRequest): Promise<ProposerResponse> {
    const startTime = Date.now();
    
    // Initialize proposer registry
    await proposerRegistry.initialize();
    
    // Analyze complexity
    const complexityAnalysis = await this.analyzeComplexity(request);
    
    // Get routing decision
    const routingDecision = await proposerRegistry.routeRequest(
      request.task_description,
      complexityAnalysis.score,
      request.context
    );

    // Get selected proposer config
    const proposerConfig = proposerRegistry.getProposer(routingDecision.selected_proposer);
    if (!proposerConfig) {
      throw new Error(`Proposer ${routingDecision.selected_proposer} not found`);
    }

    // Execute the request
    const response = await this.executeWithProposer(request, proposerConfig);
    
    const executionTime = Date.now() - startTime;

    return {
      ...response,
      execution_time_ms: executionTime,
      complexity_analysis: complexityAnalysis,
      routing_decision: routingDecision
    };
  }

  private async executeWithProposer(
    request: ProposerRequest, 
    proposer: ProposerConfig
  ): Promise<Omit<ProposerResponse, 'execution_time_ms' | 'complexity_analysis' | 'routing_decision'>> {
    
    if (proposer.provider === 'anthropic') {
      return this.executeWithClaude(request, proposer);
    } else if (proposer.provider === 'openai') {
      return this.executeWithOpenAI(request, proposer);
    } else {
      throw new Error(`Unsupported provider: ${proposer.provider}`);
    }
  }

  private async executeWithClaude(
    request: ProposerRequest, 
    proposer: ProposerConfig
  ): Promise<Omit<ProposerResponse, 'execution_time_ms' | 'complexity_analysis' | 'routing_decision'>> {
    
    const prompt = this.buildClaudePrompt(request);
    
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.ANTHROPIC_API_KEY!,
        'Anthropic-Version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!anthropicResponse.ok) {
      throw new Error(`Anthropic API error: ${anthropicResponse.statusText}`);
    }

    const data = await anthropicResponse.json();
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

  private async executeWithOpenAI(
    request: ProposerRequest, 
    proposer: ProposerConfig
  ): Promise<Omit<ProposerResponse, 'execution_time_ms' | 'complexity_analysis' | 'routing_decision'>> {
    
    const prompt = this.buildOpenAIPrompt(request);
    
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY!}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 2000
      })
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.statusText}`);
    }

    const data = await openaiResponse.json();
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

export const claudeSonnetProposer = ClaudeSonnetProposer.getInstance();