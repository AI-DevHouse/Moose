// src/lib/llm-service.ts - PROPERLY ALIGNED WITH EXISTING INTERFACES
import { Tables } from '@/types/supabase';

export type ProposerConfig = Tables<'proposer_configs'>;
import { 
  LLMRequest, 
  LLMResponse, 
  LLMProvider,
  WorkOrderGenerationRequest,
  ContractValidationRequest
} from '@/types/llm';

// Keep the options interface for backward compatibility with test files
interface WorkOrderGenerationOptions {
  complexity_override?: 'low' | 'medium' | 'high';
  test_mode?: boolean;
  log_to_database?: boolean;
  force_error?: boolean;
}

interface ContractValidationOptions {
  test_mode?: boolean;
}

interface WorkOrderResult {
  success: boolean;
  content: string;
  work_order?: any;
  execution_time: number;
  cost: number;
  token_usage: {
    input: number;
    output: number;
    total: number;
  };
  provider: string;
  model: string;
  metadata?: {
    mockResponse?: boolean;
    [key: string]: any;
  };
  error?: string;
}

interface ContractValidationResult {
  success: boolean;
  content: string;
  validation?: any;
  execution_time: number;
  cost: number;
  token_usage: {
    input: number;
    output: number;
    total: number;
  };
  provider: string;
  model: string;
  error?: string;
}

/**
 * LLM Service Wrapper - Aligned with existing interfaces
 */
export class LLMService {
  private anthropicApiKey: string;
  private openaiApiKey: string;
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();

  constructor() {
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
    
    if (!this.anthropicApiKey || !this.openaiApiKey) {
      console.warn('LLM API keys not configured. Service will run in mock mode.');
    }
  }

  /**
   * Generate Work Order - supports both string and object input for backward compatibility
   */
  async generateWorkOrder(
    request: WorkOrderGenerationRequest | string, 
    options: WorkOrderGenerationOptions = {}
  ): Promise<WorkOrderResult> {
    const startTime = Date.now();
    
    try {
      // Handle force_error for testing
      if (options.force_error) {
        throw new Error('Forced error for testing error handling');
      }

      // Extract user request from either format
      const userRequest = typeof request === 'string' ? request : request.userRequest;
      const userId = typeof request === 'object' && 'userId' in request ? request.userId : 'unknown';

      const systemPrompt = `You are the Manager LLM for Moose Mission Control. Generate ONLY valid JSON for this work order.

CRITICAL: Respond with ONLY the JSON object below, no other text, explanations, or markdown:

{
  "id": "wo_[timestamp]",
  "title": "Clear, actionable title",
  "description": "Detailed technical description",
  "risk_level": "low|medium|high",
  "estimated_cost": 0.00,
  "pattern_confidence": 0.8,
  "complexity_score": 0.3,
  "acceptance_criteria": ["Specific", "Testable", "Criteria"],
  "metadata": {
    "complexity_factors": ["list", "of", "factors"],
    "affected_contracts": ["api", "domain"],
    "estimated_time_hours": 1
  }
}`;

      const llmRequest: LLMRequest = {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userRequest }
        ],
        maxTokens: 2000,
        temperature: 0.1,
        metadata: {
          requestType: 'work_order_generation'
        }
      };

      // Use complexity-based routing
      const complexity = this.assessComplexity(userRequest);
      const proposer = (complexity > 0.3 || options.complexity_override === 'high') 
        ? await this.getPrimaryProposer() 
        : await this.getFallbackProposer();

      const response = await this.processRequest(llmRequest, proposer);
      const executionTime = Date.now() - startTime;
      
      // Parse and validate JSON response
      const workOrder = this.parseJsonResponse(response.content, 'work_order');
      workOrder.id = workOrder.id || `wo_${Date.now()}`;
      
      // Apply complexity override if specified
      if (options.complexity_override) {
        workOrder.risk_level = options.complexity_override;
      }

      return {
        success: true,
        content: response.content,
        work_order: workOrder,
        execution_time: executionTime,
        cost: response.cost,
        token_usage: response.tokenUsage,
        provider: response.provider,
        model: response.model || proposer.name,
        metadata: response.metadata
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        content: '',
        execution_time: executionTime,
        cost: 0,
        token_usage: { input: 0, output: 0, total: 0 },
        provider: 'unknown',
        model: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate contracts - using correct interface from types/llm.ts
   */
  async validateContracts(
    request: ContractValidationRequest,
    options: ContractValidationOptions = {}
  ): Promise<ContractValidationResult> {
    const startTime = Date.now();
    
    try {
      const systemPrompt = `You are the Contract Validation Engine for Moose Mission Control.

CRITICAL: Respond with ONLY valid JSON, no other text:

{
  "hasBreakingChanges": false,
  "breakingChanges": [],
  "warnings": [],
  "recommendations": [],
  "safeToMerge": true,
  "confidence": 0.95
}

Analyze the contracts and code changes for breaking changes.`;

      // Convert the interface to a prompt
      const contractsText = JSON.stringify(request.contracts, null, 2);
      const promptText = `Contracts: ${contractsText}\n\nCode Changes: ${request.codeChanges}`;

      const llmRequest: LLMRequest = {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: promptText }
        ],
        maxTokens: 3000,
        temperature: 0.0,
        metadata: {
          requestType: 'contract_validation'
        }
      };

      const proposer = await this.getPrimaryProposer();
      const response = await this.processRequest(llmRequest, proposer);
      const executionTime = Date.now() - startTime;
      
      const validation = this.parseJsonResponse(response.content, 'contract_validation');

      return {
        success: true,
        content: response.content,
        validation,
        execution_time: executionTime,
        cost: response.cost,
        token_usage: response.tokenUsage,
        provider: response.provider,
        model: response.model || proposer.name
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        content: '',
        execution_time: executionTime,
        cost: 0,
        token_usage: { input: 0, output: 0, total: 0 },
        provider: 'unknown',
        model: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Backward compatibility: validateContract method for existing test files
   */
  async validateContract(
    oldContent: string,
    newContent: string,
    contractType: string,
    options: ContractValidationOptions = {}
  ): Promise<ContractValidationResult> {
    // Convert old interface to new interface
    const request: ContractValidationRequest = {
      contracts: [
        {
          id: 'temp-contract',
          contract_type: contractType as any,
          name: 'Legacy Contract',
          version: '1.0',
          specification: { old: oldContent, new: newContent },
          breaking_changes: null,
          validation_rules: {},
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ],
      codeChanges: `Old: ${oldContent}\nNew: ${newContent}`
    };

    return this.validateContracts(request, options);
  }

  /**
   * JSON parsing with comprehensive cleaning
   */
  private parseJsonResponse(content: string, type: string): any {
    try {
      let cleanContent = content.trim();
      
      // Remove markdown code blocks
      cleanContent = cleanContent.replace(/^```json\s*/gm, '');
      cleanContent = cleanContent.replace(/^```\s*/gm, '');
      cleanContent = cleanContent.replace(/```\s*$/gm, '');
      
      // Remove any text before the first {
      const firstBrace = cleanContent.indexOf('{');
      if (firstBrace > 0) {
        cleanContent = cleanContent.substring(firstBrace);
      }
      
      // Remove any text after the last }
      const lastBrace = cleanContent.lastIndexOf('}');
      if (lastBrace !== -1 && lastBrace < cleanContent.length - 1) {
        cleanContent = cleanContent.substring(0, lastBrace + 1);
      }
      
      // Remove any trailing commas before closing braces/brackets
      cleanContent = cleanContent.replace(/,(\s*[}\]])/g, '$1');
      
      return JSON.parse(cleanContent);
      
    } catch (error) {
      console.error(`Failed to parse ${type} JSON:`, error);
      console.error('Raw content:', content);
      throw new Error(`Failed to parse ${type} JSON from LLM response`);
    }
  }

  /**
   * Main entry point for LLM requests
   */
  async processRequest(request: LLMRequest, proposer: ProposerConfig): Promise<LLMResponse> {
    try {
      await this.checkRateLimit(proposer.provider);
      const response = await this.callProvider(request, proposer);
      
      if (!request.metadata?.testMode) {
        await this.logInteraction(request, response, proposer);
      }
      
      return response;
    } catch (error) {
      console.error(`LLM Service error for ${proposer.name}:`, error);
      throw new LLMServiceError(`Failed to process request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<any> {
    return {
      service: 'LLM Service',
      status: 'operational',
      providers: {
        anthropic: { 
          configured: !!this.anthropicApiKey,
          model: 'claude-sonnet-4-5-20250929'
        },
        openai: {
          configured: !!this.openaiApiKey,
          model: 'gpt-4o-mini'
        }
      },
      mock_mode: !this.anthropicApiKey || !this.openaiApiKey,
      timestamp: new Date().toISOString()
    };
  }

  private assessComplexity(userRequest: string): number {
    const complexityIndicators = [
      'authentication', 'database', 'api', 'websocket', 'real-time',
      'security', 'encryption', 'payment', 'integration', 'architecture'
    ];
    
    const matches = complexityIndicators.filter(indicator => 
      userRequest.toLowerCase().includes(indicator)
    );
    
    return Math.min(matches.length * 0.2, 1.0);
  }

  private async callProvider(request: LLMRequest, proposer: ProposerConfig): Promise<LLMResponse> {
    if (proposer.provider === 'anthropic') {
      return await this.callAnthropic(request, proposer);
    } else if (proposer.provider === 'openai') {
      return await this.callOpenAI(request, proposer);
    } else {
      throw new Error(`Unsupported provider: ${proposer.provider}`);
    }
  }

  private async callAnthropic(request: LLMRequest, proposer: ProposerConfig): Promise<LLMResponse> {
    if (!this.anthropicApiKey) {
      return this.createMockResponse(request, proposer, 'anthropic');
    }

    const systemMessage = request.messages.find(msg => msg.role === 'system');
    const userMessages = request.messages.filter(msg => msg.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: request.maxTokens || 4000,
        temperature: request.temperature || 0.3,
        system: systemMessage?.content || '',
        messages: userMessages
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown API error' } }));
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    const cost = this.calculateCostFromAPI(inputTokens, outputTokens, proposer);

    return {
      content: data.content[0]?.text || '',
      success: true,
      executionTime: Date.now(),
      tokenUsage: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens
      },
      cost,
      provider: 'anthropic',
      model: proposer.name,
      metadata: {
        anthropicVersion: '2023-06-01',
        stopReason: data.stop_reason
      }
    };
  }

  private async callOpenAI(request: LLMRequest, proposer: ProposerConfig): Promise<LLMResponse> {
    if (!this.openaiApiKey) {
      return this.createMockResponse(request, proposer, 'openai');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: request.messages,
        max_tokens: request.maxTokens || 4000,
        temperature: request.temperature || 0.3
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown API error' } }));
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;
    const cost = this.calculateCostFromAPI(inputTokens, outputTokens, proposer);

    return {
      content: data.choices[0]?.message?.content || '',
      success: true,
      executionTime: Date.now(),
      tokenUsage: {
        input: inputTokens,
        output: outputTokens,
        total: data.usage?.total_tokens || inputTokens + outputTokens
      },
      cost,
      provider: 'openai',
      model: proposer.name,
      metadata: {
        finishReason: data.choices[0]?.finish_reason
      }
    };
  }

  private createMockResponse(request: LLMRequest, proposer: ProposerConfig, provider: LLMProvider): LLMResponse {
    const mockContent = request.metadata?.requestType === 'work_order_generation' 
      ? JSON.stringify({
          id: `wo_${Date.now()}`,
          title: "Mock Work Order: Add Hello World Function",
          description: "This is a mock work order generated without API keys for testing purposes",
          risk_level: "low",
          estimated_cost: 0.50,
          pattern_confidence: 0.8,
          complexity_score: 0.3,
          acceptance_criteria: ["Function should return 'Hello World'", "Function should be exported from utils.js", "Function should have proper TypeScript types"],
          metadata: {
            complexity_factors: ["simple_function", "single_file"],
            affected_contracts: ["api"],
            estimated_time_hours: 1
          }
        }, null, 2)
      : request.metadata?.requestType === 'contract_validation'
      ? JSON.stringify({
          hasBreakingChanges: false,
          breakingChanges: [],
          warnings: [],
          recommendations: [],
          safeToMerge: true,
          confidence: 0.95
        }, null, 2)
      : 'Mock LLM response generated without API keys configured.';

    return {
      content: mockContent,
      success: true,
      executionTime: 100,
      tokenUsage: { input: 100, output: 50, total: 150 },
      cost: 0.01,
      provider,
      model: proposer.name,
      metadata: { mockResponse: true }
    };
  }

  private async checkRateLimit(provider: string): Promise<void> {
    const key = `${provider}_requests`;
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxRequests = provider === 'anthropic' ? 50 : 60;

    const current = this.requestCounts.get(key) || { count: 0, resetTime: now + windowMs };
    
    if (now > current.resetTime) {
      this.requestCounts.set(key, { count: 1, resetTime: now + windowMs });
    } else if (current.count >= maxRequests) {
      const waitMs = current.resetTime - now;
      throw new LLMServiceError(`Rate limit exceeded for ${provider}. Try again in ${Math.ceil(waitMs / 1000)} seconds.`);
    } else {
      current.count++;
      this.requestCounts.set(key, current);
    }
  }

  private calculateCostFromAPI(inputTokens: number, outputTokens: number, proposer: ProposerConfig): number {
    const costProfile = proposer.cost_profile as { input_cost_per_token: number; output_cost_per_token: number };
    return (inputTokens * costProfile.input_cost_per_token) + (outputTokens * costProfile.output_cost_per_token);
  }

  private async getPrimaryProposer(): Promise<ProposerConfig> {
    return {
      id: "a40c5caf-b0fb-4a8b-a544-ca82bb2ab939",
      name: "claude-sonnet-4-5-20250929",
      provider: "anthropic",
      model: "claude-sonnet-4-5-20250929",
      cost_profile: {
        input_cost_per_token: 0.000003,
        output_cost_per_token: 0.000015,
        endpoint: "https://api.anthropic.com/v1/messages",
        context_limit: 200000
      } as any,
      complexity_threshold: 0.30,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  private async getFallbackProposer(): Promise<ProposerConfig> {
    return {
      id: "fallback-gpt-4o-mini",
      name: "gpt-4o-mini",
      provider: "openai",
      model: "gpt-4o-mini",
      cost_profile: {
        input_cost_per_token: 0.00000015,
        output_cost_per_token: 0.0000006,
        endpoint: "https://api.openai.com/v1/chat/completions",
        context_limit: 128000
      } as any,
      complexity_threshold: 0.30,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  private async logInteraction(
    request: LLMRequest, 
    response: LLMResponse, 
    proposer: ProposerConfig
  ): Promise<void> {
    try {
      console.log('Cost tracking data:', {
        service_name: `llm-${proposer.provider}`,
        cost: response.cost,
        metadata: {
          model: proposer.name,
          tokens: response.tokenUsage,
          execution_time_ms: response.executionTime,
          request_type: request.metadata?.requestType,
          success: response.success
        }
      });
    } catch (error) {
      console.error('Failed to log LLM interaction:', error);
    }
  }
}

export class LLMServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'LLMServiceError';
  }
}

export function createLLMService(): LLMService {
  return new LLMService();
}

export const llmService = new LLMService();