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
    input_cost_per_1k_tokens: number;
    output_cost_per_1k_tokens: number;
    currency: string;
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

    let selectedProposer = activeProposers[0];
    let reason = 'Default selection';

    for (const proposer of activeProposers) {
      if (complexity_score >= proposer.complexity_threshold) {
        selectedProposer = proposer;
        reason = `Complexity score ${complexity_score} matches threshold ${proposer.complexity_threshold}`;
        break;
      }
    }

    return {
      selected_proposer: selectedProposer.name,
      reason,
      confidence: 0.8,
      fallback_proposer: activeProposers.find(p => p.name !== selectedProposer.name)?.name,
      routing_metadata: {
        complexity_score,
        available_proposers: activeProposers.length,
        selection_timestamp: new Date().toISOString()
      }
    };
  }
}

export const proposerRegistry = new ProposerRegistry();