import { createClient } from '@supabase/supabase-js';

// Type definitions matching your schema
export interface BudgetLimits {
  daily_soft_cap: number;
  daily_hard_cap: number;
  emergency_kill: number;
  monthly_target: number;
  monthly_hard_cap: number;
}

export interface RoutingConfig {
  enable_hard_stops: boolean;
  enable_parallel_mode: boolean;
}

export interface SystemConfig {
  key: string;
  value: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// Cache with 5-minute TTL
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class ConfigService {
  private supabase;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  private isCacheValid<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > this.CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  private invalidateCache(key: string): void {
    this.cache.delete(key);
  }

  async getBudgetLimits(): Promise<BudgetLimits> {
    const cached = this.isCacheValid<BudgetLimits>('budget_limits');
    if (cached) return cached;

    const { data, error } = await this.supabase
      .from('system_config')
      .select('value')
      .eq('key', 'budget_limits')
      .single();

    if (error) {
      throw new Error(`Failed to fetch budget limits: ${error.message}`);
    }

    const limits = JSON.parse(data.value) as BudgetLimits;
    this.setCache('budget_limits', limits);
    return limits;
  }

  async updateBudgetLimits(
    limits: BudgetLimits,
    updated_by: string
  ): Promise<void> {
    // Validation
    if (limits.daily_soft_cap >= limits.daily_hard_cap) {
      throw new Error('daily_soft_cap must be less than daily_hard_cap');
    }
    if (limits.daily_hard_cap >= limits.emergency_kill) {
      throw new Error('daily_hard_cap must be less than emergency_kill');
    }
    if (limits.monthly_target >= limits.monthly_hard_cap) {
      throw new Error('monthly_target must be less than monthly_hard_cap');
    }
    if (limits.daily_hard_cap * 30 > limits.monthly_hard_cap) {
      console.warn('Warning: daily_hard_cap * 30 exceeds monthly_hard_cap');
    }

    const { error } = await this.supabase
      .from('system_config')
      .update({
        value: JSON.stringify(limits),
        updated_at: new Date().toISOString()
      })
      .eq('key', 'budget_limits');

    if (error) {
      throw new Error(`Failed to update budget limits: ${error.message}`);
    }

    this.invalidateCache('budget_limits');
  }

  async getRoutingConfig(): Promise<RoutingConfig> {
    const cached = this.isCacheValid<RoutingConfig>('routing_config');
    if (cached) return cached;

    const { data, error } = await this.supabase
      .from('system_config')
      .select('value')
      .eq('key', 'routing_config')
      .single();

    if (error) {
      throw new Error(`Failed to fetch routing config: ${error.message}`);
    }

    const config = JSON.parse(data.value) as RoutingConfig;
    this.setCache('routing_config', config);
    return config;
  }

  async updateRoutingConfig(
    config: RoutingConfig,
    updated_by: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('system_config')
      .update({
        value: JSON.stringify(config),
        updated_at: new Date().toISOString()
      })
      .eq('key', 'routing_config');

    if (error) {
      throw new Error(`Failed to update routing config: ${error.message}`);
    }

    this.invalidateCache('routing_config');
  }

  async getConfig<T>(config_key: string): Promise<T> {
    const cached = this.isCacheValid<T>(config_key);
    if (cached) return cached;

    const { data, error} = await this.supabase
      .from('system_config')
      .select('value')
      .eq('key', config_key)
      .single();

    if (error) {
      throw new Error(`Failed to fetch config '${config_key}': ${error.message}`);
    }

    const value = JSON.parse(data.value) as T;
    this.setCache(config_key, value);
    return value;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton instance
export const configService = new ConfigService();