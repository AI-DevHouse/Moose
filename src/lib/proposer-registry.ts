import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface ProposerConfig {
  id: string;
  name: string;
  provider: 'anthropic' | 'openai';
  endpoint: string;
  context_limit: number;
  cost_profile: {
    input_cost_per_token: number;
    output_cost_per_token: number;
    currency?: string;
  };
  strengths: string[];
  complexity_threshold: number;
  success_patterns?: Record<string, any>;
  notes?: string;
  is_active: boolean;
}

export interface RoutingDecision {
  selected_proposer: string;
  reason: string;
  confidence: number;
  fallback_proposer?: string;
  routing_metadata: Record<string, any>;
}

export class ProposerRegistry {
  private proposers: Map<string, ProposerConfig> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const { data: configs, error } = await supabase
        .from('proposer_configs')
        .select('*')
        .eq('is_active', true)
        .order('created_at');

      if (error) throw error;

      for (const config of configs || []) {
        this.proposers.set(config.name, {
          id: config.id,
          name: config.name,
          provider: config.provider,
          endpoint: config.endpoint,
          context_limit: config.context_limit,
          cost_profile: config.cost_profile,
          strengths: config.strengths,
          complexity_threshold: config.complexity_threshold,
          success_patterns: config.success_patterns,
          notes: config.notes,
          is_active: config.is_active
        });
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize ProposerRegistry:', error);
      throw new Error('Registry initialization failed');
    }
  }

  async registerProposer(config: ProposerConfig): Promise<void> {
    try {
      const { error } = await supabase
        .from('proposer_configs')
        .upsert({
          id: config.id,
          name: config.name,
          provider: config.provider,
          endpoint: config.endpoint,
          context_limit: config.context_limit,
          cost_profile: config.cost_profile,
          strengths: config.strengths,
          complexity_threshold: config.complexity_threshold,
          success_patterns: config.success_patterns,
          notes: config.notes,
          is_active: config.is_active
        });

      if (error) throw error;
      
      this.proposers.set(config.name, config);
    } catch (error) {
      console.error('Failed to register proposer:', error);
      throw new Error('Proposer registration failed');
    }
  }

  getProposer(name: string): ProposerConfig | null {
    return this.proposers.get(name) || null;
  }

  listActiveProposers(): ProposerConfig[] {
    return Array.from(this.proposers.values()).filter(p => p.is_active);
  }

  async routeRequest(
    task_description: string,
    complexity_score: number,
    context_requirements: string[]
  ): Promise<RoutingDecision> {
    if (!this.initialized) {
      await this.initialize();
    }

    const activeProposers = this.listActiveProposers();
    
    if (activeProposers.length === 0) {
      throw new Error('No active proposers available');
    }

    // Step 1: Filter candidates that can handle this complexity (max_complexity ceiling)
    const candidates = activeProposers.filter(proposer => {
      // Treat complexity_threshold as max_complexity ceiling
      return complexity_score <= proposer.complexity_threshold;
    });

    let selectedProposer: ProposerConfig;
    let reason: string;

    if (candidates.length === 0) {
      // No proposer can handle this complexity - use highest capability
      selectedProposer = activeProposers.reduce((max, proposer) => 
        proposer.complexity_threshold > max.complexity_threshold ? proposer : max
      );
      reason = `Complexity ${complexity_score} exceeds all thresholds - using highest capability: ${selectedProposer.name}`;
    } else if (candidates.length === 1) {
      // Only one candidate
      selectedProposer = candidates[0];
      reason = `Single candidate for complexity ${complexity_score}: ${selectedProposer.name}`;
    } else {
      // Step 2: Among candidates, select by lowest cost (simplified - all per-token now)
      selectedProposer = candidates.reduce((cheapest, candidate) => {
        const cheapestCost = cheapest.cost_profile.input_cost_per_token;
        const candidateCost = candidate.cost_profile.input_cost_per_token;
        return candidateCost < cheapestCost ? candidate : cheapest;
      });
      reason = `Complexity ${complexity_score} - selected cheapest among ${candidates.length} candidates: ${selectedProposer.name}`;
    }

    console.log('🎯 FINAL ROUTING FIX: Max-Complexity + Cost Selection:', {
      complexity_score,
      all_proposers: activeProposers.map(p => ({ 
        name: p.name, 
        max_complexity: p.complexity_threshold,
        can_handle: complexity_score <= p.complexity_threshold
      })),
      candidates: candidates.map(p => p.name),
      selected: selectedProposer.name,
      reason,
      routing_strategy: 'max_complexity_ceiling_with_cost_optimization'
    });

    return {
      selected_proposer: selectedProposer.name,
      reason,
      confidence: 0.95,
      fallback_proposer: activeProposers.find(p => p.name !== selectedProposer.name)?.name,
      routing_metadata: {
        complexity_score,
        available_proposers: activeProposers.length,
        candidates_count: candidates.length,
        selection_timestamp: new Date().toISOString(),
        routing_strategy: 'max_complexity_ceiling_with_cost_optimization'
      }
    };
  }
}

export const proposerRegistry = new ProposerRegistry();