// Complexity Analyzer - Phase 2.2.4
// Modular complexity detection with performance-based enhancement foundation

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface ComplexityFactors {
  codeComplexity: number;
  contextRequirements: number;
  securityImplications: number;
  architecturalImpact: number;
  reasoningDepth: number;
  memoryPressure: number;      // NEW - Phase 2.2.4
  coordinationComplexity: number; // NEW - Phase 2.2.4
}

export interface ComplexityWeights {
  codeComplexity: number;
  contextRequirements: number;
  securityImplications: number;
  architecturalImpact: number;
  reasoningDepth: number;
  memoryPressure: number;
  coordinationComplexity: number;
}

export interface ComplexityAnalysis {
  score: number;
  factors: ComplexityFactors;
  weights: ComplexityWeights;
  reasoning: string;
  metadata: {
    estimated_tokens: number;
    estimated_files_touched: number;
    risk_indicators: string[];
    confidence: number;
  };
}

export interface AnalyzerRequest {
  task_description: string;
  context: string[];
  security_context?: 'high' | 'medium' | 'low';
  expected_output_type: 'code' | 'analysis' | 'planning' | 'refactoring';
  priority?: 'high' | 'medium' | 'low';
}

export class ComplexityAnalyzer {
  private static instance: ComplexityAnalyzer;
  
  // Default weights - Phase 2.2.3 baseline
  private weights: ComplexityWeights = {
    codeComplexity: 0.20,
    contextRequirements: 0.10,
    securityImplications: 0.20,
    architecturalImpact: 0.20,
    reasoningDepth: 0.10,
    memoryPressure: 0.10,        // NEW
    coordinationComplexity: 0.10  // NEW
  };

  // Context window limits for memory pressure calculation
  private readonly CONTEXT_LIMITS = {
    'claude-sonnet-4': 200000,
    'gpt-4o-mini': 128000
  };

  private readonly USABLE_CONTEXT_RATIO = 0.80; // 20% safety margin

  static getInstance(): ComplexityAnalyzer {
    if (!ComplexityAnalyzer.instance) {
      ComplexityAnalyzer.instance = new ComplexityAnalyzer();
    }
    return ComplexityAnalyzer.instance;
  }

  async analyze(request: AnalyzerRequest): Promise<ComplexityAnalysis> {
    const factors = await this.calculateFactors(request);
    const score = this.calculateWeightedScore(factors);
    const reasoning = this.generateReasoning(factors, score);
    const metadata = this.generateMetadata(request, factors);

    return {
      score,
      factors,
      weights: { ...this.weights },
      reasoning,
      metadata
    };
  }

  private async calculateFactors(request: AnalyzerRequest): Promise<ComplexityFactors> {
    const { task_description, context, security_context, expected_output_type } = request;

    return {
      codeComplexity: this.assessCodeComplexity(task_description),
      contextRequirements: this.assessContextRequirements(context),
      securityImplications: this.assessSecurityImplications(security_context, task_description),
      architecturalImpact: this.assessArchitecturalImpact(task_description, expected_output_type),
      reasoningDepth: this.assessReasoningDepth(task_description, expected_output_type),
      memoryPressure: this.assessMemoryPressure(task_description, context),
      coordinationComplexity: this.assessCoordinationComplexity(task_description)
    };
  }

  private calculateWeightedScore(factors: ComplexityFactors): number {
    return (
      factors.codeComplexity * this.weights.codeComplexity +
      factors.contextRequirements * this.weights.contextRequirements +
      factors.securityImplications * this.weights.securityImplications +
      factors.architecturalImpact * this.weights.architecturalImpact +
      factors.reasoningDepth * this.weights.reasoningDepth +
      factors.memoryPressure * this.weights.memoryPressure +
      factors.coordinationComplexity * this.weights.coordinationComplexity
    );
  }

  // ========== FACTOR ASSESSMENT METHODS ==========

  private assessCodeComplexity(description: string): number {
    const complexityIndicators = [
      { pattern: /\b(refactor|architecture|design pattern|algorithm|optimization)\b/i, weight: 0.18 },
      { pattern: /\b(async|concurrent|parallel|threading|performance)\b/i, weight: 0.18 },
      { pattern: /\b(integration|api|database|schema|migration)\b/i, weight: 0.15 },
      { pattern: /\b(complex|sophisticated|advanced|enterprise)\b/i, weight: 0.12 },
      { pattern: /\b(multi-step|workflow|orchestration|pipeline)\b/i, weight: 0.15 }
    ];

    let score = 0.1; // baseline
    complexityIndicators.forEach(({ pattern, weight }) => {
      if (pattern.test(description)) score += weight;
    });

    return Math.min(score, 1.0);
  }

  private assessContextRequirements(context: string[]): number {
    const contextSize = context.join(' ').length;
    
    // Normalized scale based on token estimation (4 chars ≈ 1 token)
    const estimatedTokens = contextSize / 4;
    
    if (estimatedTokens > 40000) return 0.9;
    if (estimatedTokens > 20000) return 0.7;
    if (estimatedTokens > 10000) return 0.5;
    if (estimatedTokens > 2000) return 0.3;
    return 0.1;
  }

  private assessSecurityImplications(security_context: string | undefined, description: string): number {
    if (security_context === 'high') return 0.9;
    if (security_context === 'medium') return 0.6;
    
    const securityKeywords = [
      { pattern: /\b(auth|authentication|authorization|permission|rbac|oauth)\b/i, weight: 0.3 },
      { pattern: /\b(security|encryption|decrypt|crypto|secret|key)\b/i, weight: 0.3 },
      { pattern: /\b(validate|sanitize|escape|injection|xss|csrf)\b/i, weight: 0.2 },
      { pattern: /\b(vulnerability|exploit|attack|breach)\b/i, weight: 0.4 }
    ];

    let score = 0.2; // baseline
    securityKeywords.forEach(({ pattern, weight }) => {
      if (pattern.test(description)) score += weight;
    });

    return Math.min(score, 1.0);
  }

  private assessArchitecturalImpact(description: string, outputType: string): number {
    const architecturalKeywords = [
      { pattern: /\b(architecture|system|infrastructure|scalability)\b/i, weight: 0.3 },
      { pattern: /\b(service|microservice|module|component|package)\b/i, weight: 0.2 },
      { pattern: /\b(migration|upgrade|breaking change|deprecate)\b/i, weight: 0.3 },
      { pattern: /\b(cross-cutting|integration|dependency|coupling)\b/i, weight: 0.2 }
    ];

    let score = 0.2; // baseline
    architecturalKeywords.forEach(({ pattern, weight }) => {
      if (pattern.test(description)) score += weight;
    });

    // Boost for planning/analysis tasks
    if (outputType === 'planning' && score > 0.3) score += 0.2;
    if (outputType === 'analysis' && score > 0.3) score += 0.1;

    return Math.min(score, 1.0);
  }

  private assessReasoningDepth(description: string, outputType: string): number {
    const reasoningKeywords = [
      { pattern: /\b(analyze|evaluate|compare|assess|determine)\b/i, weight: 0.2 },
      { pattern: /\b(strategy|approach|decision|trade-off|consider)\b/i, weight: 0.2 },
      { pattern: /\b(optimize|improve|enhance|refine)\b/i, weight: 0.15 },
      { pattern: /\b(multiple|various|several|different)\b/i, weight: 0.1 }
    ];

    let score = 0.3; // baseline
    reasoningKeywords.forEach(({ pattern, weight }) => {
      if (pattern.test(description)) score += weight;
    });

    // Output type adjustments
    if (outputType === 'analysis') score += 0.2;
    if (outputType === 'planning') score += 0.15;

    return Math.min(score, 1.0);
  }

  // ========== NEW PHASE 2.2.4 FACTORS ==========

  private assessMemoryPressure(description: string, context: string[]): number {
    // Estimate total tokens needed
    const descriptionTokens = description.length / 4;
    const contextTokens = context.join(' ').length / 4;
    
    // Estimate output tokens based on task type
    const outputMultipliers = {
      simple: 500,
      moderate: 2000,
      complex: 4000
    };
    
    const isComplex = /\b(refactor|architecture|migration|multiple files)\b/i.test(description);
    const isModerate = /\b(implement|create|build|add)\b/i.test(description);
    const estimatedOutput = isComplex ? outputMultipliers.complex : 
                           isModerate ? outputMultipliers.moderate : 
                           outputMultipliers.simple;

    // Total estimated tokens
    const totalEstimatedTokens = descriptionTokens + contextTokens + estimatedOutput;

    // Calculate pressure against typical model (use mid-range)
    const usableContext = this.CONTEXT_LIMITS['gpt-4o-mini'] * this.USABLE_CONTEXT_RATIO;
    const pressure = totalEstimatedTokens / usableContext;

    // Normalize to [0, 1] with ceiling at 2x context (clamp at 1.0)
    return Math.min(pressure, 1.0);
  }

  private assessCoordinationComplexity(description: string): number {
    // Estimate files/modules/services touched
    const fileIndicators = [
      { pattern: /\b(\d+)\s+(files?|modules?|components?|services?)\b/i, multiplier: 1 },
      { pattern: /\b(multiple|several|various)\s+(files?|modules?|components?)\b/i, multiplier: 3 },
      { pattern: /\b(across|throughout|spanning)\b/i, multiplier: 4 },
      { pattern: /\b(entire|whole|all)\s+(codebase|system|application)\b/i, multiplier: 10 }
    ];

    let estimatedFiles = 1; // baseline single file

    for (const { pattern, multiplier } of fileIndicators) {
      const match = description.match(pattern);
      if (match) {
        if (match[1] && !isNaN(parseInt(match[1]))) {
          estimatedFiles = Math.max(estimatedFiles, parseInt(match[1]));
        } else {
          estimatedFiles = Math.max(estimatedFiles, multiplier);
        }
      }
    }

    // Normalize: 1 file = 0.1, 5 files = 0.5, 10+ files = 1.0
    const normalized = Math.min(estimatedFiles / 10, 1.0);
    return Math.max(normalized, 0.1);
  }

  // ========== METADATA & REASONING ==========

  private generateMetadata(request: AnalyzerRequest, factors: ComplexityFactors): ComplexityAnalysis['metadata'] {
    const estimatedTokens = Math.round(
      (request.task_description.length + request.context.join(' ').length) / 4
    );

    const estimatedFiles = Math.round(factors.coordinationComplexity * 10);

    const riskIndicators: string[] = [];
    if (factors.securityImplications > 0.6) riskIndicators.push('security');
    if (factors.architecturalImpact > 0.6) riskIndicators.push('architecture');
    if (factors.memoryPressure > 0.7) riskIndicators.push('memory_pressure');
    if (factors.coordinationComplexity > 0.7) riskIndicators.push('high_coordination');

    // Calculate confidence based on indicator strength
    const avgFactor = (
      factors.codeComplexity + factors.contextRequirements + 
      factors.securityImplications + factors.architecturalImpact + 
      factors.reasoningDepth + factors.memoryPressure + 
      factors.coordinationComplexity
    ) / 7;

    const confidence = avgFactor > 0.3 ? 0.85 : 0.70; // Higher confidence when clear signals

    return {
      estimated_tokens: estimatedTokens,
      estimated_files_touched: estimatedFiles,
      risk_indicators: riskIndicators,
      confidence
    };
  }

  private generateReasoning(factors: ComplexityFactors, score: number): string {
    const highFactors = Object.entries(factors)
      .filter(([_, value]) => value > 0.6)
      .map(([key, _]) => key)
      .map(key => key.replace(/([A-Z])/g, ' $1').toLowerCase().trim());

    const mediumFactors = Object.entries(factors)
      .filter(([_, value]) => value > 0.4 && value <= 0.6)
      .map(([key, _]) => key)
      .map(key => key.replace(/([A-Z])/g, ' $1').toLowerCase().trim());

    if (score > 0.7) {
      return `High complexity (${score.toFixed(2)}) due to: ${highFactors.join(', ')}. Requires Claude Sonnet 4 for reasoning depth and context handling.`;
    } else if (score > 0.4) {
      const factorList = [...highFactors, ...mediumFactors].slice(0, 3).join(', ');
      return `Medium complexity (${score.toFixed(2)}). Elevated factors: ${factorList || 'moderate requirements'}. Consider task-specific routing.`;
    } else {
      return `Low complexity (${score.toFixed(2)}). Suitable for gpt-4o-mini optimization. ${mediumFactors.length > 0 ? 'Some ' + mediumFactors[0] + ' present.' : ''}`;
    }
  }

  // ========== PERFORMANCE-BASED TUNING (Foundation for future ML) ==========

  async getRoutingAccuracyByComplexity(): Promise<{
    complexity_bands: Array<{
      min: number;
      max: number;
      total_requests: number;
      correct_routes: number;
      accuracy: number;
      avg_cost: number;
    }>;
  }> {
    // Query cost_tracking table for routing performance data
    const { data: performanceData, error } = await supabase
      .from('cost_tracking')
      .select('metadata')
      .eq('service_name', 'enhanced_proposer_service')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error || !performanceData) {
      return { complexity_bands: [] };
    }

    // Group by complexity bands
    const bands = [
      { min: 0, max: 0.3, requests: [], costs: [] },
      { min: 0.3, max: 0.5, requests: [], costs: [] },
      { min: 0.5, max: 0.7, requests: [], costs: [] },
      { min: 0.7, max: 1.0, requests: [], costs: [] }
    ];

    performanceData.forEach(record => {
      const metadata = record.metadata as any;
      const complexity = metadata?.complexity_score || 0;
      const proposer = metadata?.proposer_used;
      const fallback = metadata?.fallback_used || false;

      const band = bands.find(b => complexity >= b.min && complexity < b.max);
      if (band) {
        band.requests.push({
          complexity,
          proposer,
          fallback,
          correct: this.wasRoutingCorrect(complexity, proposer, fallback)
        });
        band.costs.push(metadata?.execution_time_ms || 0);
      }
    });

    return {
      complexity_bands: bands.map(band => ({
        min: band.min,
        max: band.max,
        total_requests: band.requests.length,
        correct_routes: band.requests.filter(r => r.correct).length,
        accuracy: band.requests.length > 0 
          ? band.requests.filter(r => r.correct).length / band.requests.length 
          : 0,
        avg_cost: band.costs.length > 0
          ? band.costs.reduce((a, b) => a + b, 0) / band.costs.length
          : 0
      }))
    };
  }

  private wasRoutingCorrect(complexity: number, proposer: string, fallback: boolean): boolean {
    // Simple heuristic: low complexity should use gpt-4o-mini, high should use claude-sonnet-4
    if (complexity < 0.3 && proposer === 'gpt-4o-mini' && !fallback) return true;
    if (complexity >= 0.3 && proposer === 'claude-sonnet-4') return true;
    return false;
  }

  // ========== WEIGHT ADJUSTMENT (Manual for Phase 2.2.4, automated later) ==========

  updateWeights(newWeights: Partial<ComplexityWeights>): void {
    this.weights = { ...this.weights, ...newWeights };
    
    // Validate weights sum to 1.0
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.01) {
      throw new Error(`Weights must sum to 1.0, got ${sum.toFixed(3)}`);
    }
  }

  getWeights(): ComplexityWeights {
    return { ...this.weights };
  }
}

export const complexityAnalyzer = ComplexityAnalyzer.getInstance();