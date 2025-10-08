import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { configService } from '@/lib/config-services';

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
        .select('id, name, model, provider, complexity_threshold, cost_profile, active')
        .eq('active', true)
        .order('created_at');

      if (error) throw error;

      for (const config of configs || []) {
        this.proposers.set(config.name, {
          id: config.id,
          name: config.name,
          provider: config.provider as 'anthropic' | 'openai',
          endpoint: config.provider === 'anthropic' ? 'https://api.anthropic.com/v1/messages' : 'https://api.openai.com/v1/chat/completions',
          context_limit: config.provider === 'anthropic' ? 200000 : 128000,
          cost_profile: config.cost_profile as { input_cost_per_token: number; output_cost_per_token: number; currency?: string },
          strengths: [],
          complexity_threshold: config.complexity_threshold,
          success_patterns: undefined,
          notes: undefined,
          is_active: config.active
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

  // NOTE: Routing logic has been moved to Manager service (Phase 4.1)
  // All routing decisions now go through /api/manager
  // This method is DEPRECATED and kept only for backward compatibility
  async routeRequest(
    task_description: string,
    complexity_score: number,
    context_requirements: string[],
    hard_stop_required: boolean = false
  ): Promise<RoutingDecision> {
    throw new Error('DEPRECATED: routeRequest() has been replaced by Manager service. Use POST /api/manager instead.');
  }
}

export const proposerRegistry = new ProposerRegistry();