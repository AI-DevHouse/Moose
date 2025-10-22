import { createSupabaseServiceClient } from './supabase';
import type { Database } from '@/types/supabase';
import { configService } from '@/lib/config-services';

// Lazy initialization of Supabase client to ensure env vars are loaded
function getSupabase() {
  return createSupabaseServiceClient();
}

export interface ProposerConfig {
  id: string;
  name: string;
  model: string; // Actual model identifier (e.g., 'claude-sonnet-4-5-20250929', 'gpt-4o-mini')
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
  active: boolean;
  created_at?: string;
  updated_at?: string;
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
      const supabase = getSupabase();
      const { data: configs, error } = await supabase
        .from('proposer_configs')
        .select('id, name, model, provider, complexity_threshold, cost_profile, active, created_at, updated_at')
        .eq('active', true)
        .order('created_at');

      if (error) throw error;

      for (const config of configs || []) {
        // Parse cost_profile if it's a stringified JSON
        const costProfile = typeof config.cost_profile === 'string'
          ? JSON.parse(config.cost_profile)
          : config.cost_profile;

        // Parse complexity_threshold if it's a string
        const complexityThreshold = typeof config.complexity_threshold === 'string'
          ? parseFloat(config.complexity_threshold)
          : config.complexity_threshold;

        this.proposers.set(config.name, {
          id: config.id,
          name: config.name,
          model: config.model,
          provider: config.provider as 'anthropic' | 'openai',
          endpoint: config.provider === 'anthropic' ? 'https://api.anthropic.com/v1/messages' : 'https://api.openai.com/v1/chat/completions',
          context_limit: config.provider === 'anthropic' ? 200000 : 128000,
          cost_profile: costProfile as { input_cost_per_token: number; output_cost_per_token: number; currency?: string },
          strengths: [],
          complexity_threshold: complexityThreshold,
          success_patterns: undefined,
          notes: undefined,
          active: config.active ?? true,
          created_at: config.created_at ?? undefined,
          updated_at: config.updated_at ?? undefined
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
      const supabase = getSupabase();
      const { error } = await supabase
        .from('proposer_configs')
        .upsert({
          id: config.id,
          name: config.name,
          provider: config.provider,
          model: config.name,
          cost_profile: {
            ...config.cost_profile,
            endpoint: config.endpoint,
            context_limit: config.context_limit,
            strengths: config.strengths,
            success_patterns: config.success_patterns,
            notes: config.notes
          } as any,
          complexity_threshold: config.complexity_threshold,
          active: config.active,
          created_at: config.created_at ?? new Date().toISOString(),
          updated_at: config.updated_at ?? new Date().toISOString()
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
    return Array.from(this.proposers.values()).filter(p => p.active);
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