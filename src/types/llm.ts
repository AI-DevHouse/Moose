// src/types/llm.ts
import { Contract } from './supabase';

export type LLMProvider = 'anthropic' | 'openai';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  metadata?: {
    requestType?: 'work_order_generation' | 'contract_validation' | 'general';
    userId?: string;
    workOrderId?: string;
    [key: string]: any;
  };
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface LLMResponse {
  content: string;
  success: boolean;
  error?: string;
  executionTime: number;
  tokenUsage: TokenUsage;
  cost: number;
  provider: LLMProvider;
  model: string;
  metadata?: {
    [key: string]: any;
  };
}

// Work Order Generation Types (Phase 2.1.3)
export interface WorkOrderGenerationRequest {
  userRequest: string;
  userId: string;
  context?: {
    currentRepository?: string;
    recentWorkOrders?: Array<{
      title: string;
      description: string;
      outcome: 'success' | 'failure';
    }>;
    availableContracts?: Contract[];
  };
}

export interface WorkOrderSpec {
  title: string;
  description: string;
  risk_level: 'low' | 'medium' | 'high';
  estimated_cost: number;
  pattern_confidence: number; // 0.0 to 1.0
  acceptance_criteria: string[];
  metadata: {
    complexity_factors: string[];
    affected_contracts: string[];
    estimated_time_hours: number;
    requires_human_review?: boolean;
    breaking_change_risk?: boolean;
  };
}

// Contract Validation Types (Phase 2.1.2)
export interface ContractValidationRequest {
  contracts: Contract[];
  codeChanges: string; // Diff or file contents
  metadata?: {
    branchName?: string;
    prNumber?: number;
    authorId?: string;
  };
}

export interface BreakingChange {
  type: 'removed_field' | 'type_change' | 'status_change' | 'signature_change' | 'behavior_change';
  location: string; // file:line or API path
  description: string;
  impact: 'high' | 'medium' | 'low';
  affectedSystems: string[];
  remediation?: string;
}

export interface ContractValidationResult {
  hasBreakingChanges: boolean;
  breakingChanges: BreakingChange[];
  warnings: Array<{
    type: string;
    description: string;
    location: string;
  }>;
  recommendations: string[];
  safeToMerge: boolean;
  confidence: number; // How confident we are in this assessment
}

// Risk Assessment Types (Phase 2.1.4)
export interface RiskAssessment {
  overall_risk: 'low' | 'medium' | 'high';
  risk_factors: {
    complexity: number; // 0.0 to 1.0
    novelty: number; // How new/unusual is this request
    scope: number; // How many systems affected
    breaking_change_likelihood: number;
    estimated_failure_rate: number;
  };
  recommended_proposer: 'primary' | 'fallback' | 'parallel';
  requires_human_approval: boolean;
  auto_approval_eligible: boolean;
}

// Decision Logging Types (Phase 2.1.5)
export interface Decision {
  id: string;
  work_order_id?: string;
  decision_type: 'work_order_approval' | 'contract_validation' | 'risk_assessment' | 'proposer_selection';
  decision_data: {
    input: any;
    output: any;
    reasoning: string;
    confidence: number;
    alternatives_considered?: any[];
  };
  approved: boolean;
  approved_by?: string; // 'system' for auto-approval, user ID for manual
  human_override?: {
    original_decision: any;
    override_reason: string;
    override_by: string;
    override_at: string;
  };
  created_at: string;
  metadata?: {
    [key: string]: any;
  };
}

// Progressive Trust Types (Phase 2.1.6)
export interface TrustMetrics {
  pattern_hash: string; // Hash of the work order pattern
  success_count: number;
  failure_count: number;
  success_rate: number;
  avg_execution_time: number;
  avg_cost: number;
  last_success_at?: string;
  last_failure_at?: string;
  trust_level: 'untrusted' | 'learning' | 'trusted' | 'highly_trusted';
  auto_approval_threshold: number; // Success rate needed for auto-approval
}

export interface TrustDecision {
  eligible_for_auto_approval: boolean;
  trust_level: TrustMetrics['trust_level'];
  success_rate: number;
  confidence: number;
  reasoning: string;
  required_threshold: number;
  recommendation: 'auto_approve' | 'human_review' | 'enhanced_monitoring';
}

// Proposer Selection Types
export interface ProposerRecommendation {
  recommended_proposer_id: string;
  reasoning: string;
  confidence: number;
  fallback_proposer_id?: string;
  parallel_execution_recommended: boolean;
  cost_analysis: {
    estimated_primary_cost: number;
    estimated_fallback_cost: number;
    cost_savings_percentage?: number;
  };
}

// API Response Types for Mission Control Integration
export interface LLMServiceStatus {
  anthropic: {
    available: boolean;
    rate_limit_remaining: number;
    last_request_time?: string;
    error?: string;
  };
  openai: {
    available: boolean;
    rate_limit_remaining: number;
    last_request_time?: string;
    error?: string;
  };
  total_requests_today: number;
  total_cost_today: number;
  budget_remaining: number;
}

// Error Types
export interface LLMServiceError {
  code: string;
  message: string;
  provider?: LLMProvider;
  retryable: boolean;
  retry_after?: number; // seconds
  details?: {
    [key: string]: any;
  };
}

// Audit Trail Types
export interface LLMInteractionLog {
  id: string;
  request_type: string;
  provider: LLMProvider;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  execution_time: number;
  success: boolean;
  error?: string;
  user_id?: string;
  work_order_id?: string;
  created_at: string;
  metadata: {
    request_hash: string; // For deduplication
    response_hash: string;
    [key: string]: any;
  };
}