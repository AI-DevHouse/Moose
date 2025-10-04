// Capacity Manager - Enforces per-model concurrent execution limits

/**
 * Capacity limits per LLM model (prevents rate limit hits)
 *
 * Based on API tier limits:
 * - Claude Sonnet 4.5: 50 RPM, but complex tasks take time = limit 2 concurrent
 * - GPT-4o-mini: 500 RPM, faster responses = limit 4 concurrent
 *
 * These limits prevent:
 * - Rate limit 429 errors
 * - Token-per-minute (TPM) exhaustion
 * - Poor load balancing
 */
export const MODEL_CAPACITY_LIMITS = {
  'claude-sonnet-4-5': 2,    // Max 2 concurrent Claude executions
  'gpt-4o-mini': 4,           // Max 4 concurrent GPT executions
  'default': 3                 // Fallback for unknown models
} as const;

/**
 * Capacity Manager (Singleton)
 *
 * Tracks active executions per model and enforces capacity limits
 */
export class CapacityManager {
  private static instance: CapacityManager;

  // Track active executions per model
  // Map<model_name, Set<work_order_id>>
  private activeExecutions: Map<string, Set<string>> = new Map();

  private constructor() {
    // Initialize capacity tracking for known models
    Object.keys(MODEL_CAPACITY_LIMITS).forEach(model => {
      this.activeExecutions.set(model, new Set());
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): CapacityManager {
    if (!CapacityManager.instance) {
      CapacityManager.instance = new CapacityManager();
    }
    return CapacityManager.instance;
  }

  /**
   * Check if model has available capacity
   *
   * @param modelName - LLM model name (e.g., "claude-sonnet-4-5")
   * @returns True if can execute now, false if at capacity
   */
  public hasCapacity(modelName: string): boolean {
    const activeCount = this.getActiveCount(modelName);
    const limit = this.getCapacityLimit(modelName);

    return activeCount < limit;
  }

  /**
   * Reserve capacity for a work order execution
   *
   * @param modelName - LLM model name
   * @param workOrderId - Work order ID to reserve
   * @returns True if reserved, false if at capacity
   */
  public reserveCapacity(modelName: string, workOrderId: string): boolean {
    if (!this.hasCapacity(modelName)) {
      return false;
    }

    // Get or create Set for this model
    if (!this.activeExecutions.has(modelName)) {
      this.activeExecutions.set(modelName, new Set());
    }

    const activeSet = this.activeExecutions.get(modelName)!;
    activeSet.add(workOrderId);

    console.log(`[CapacityManager] Reserved capacity for ${modelName}: ${activeSet.size}/${this.getCapacityLimit(modelName)} (WO ${workOrderId})`);

    return true;
  }

  /**
   * Release capacity after work order completes
   *
   * @param modelName - LLM model name
   * @param workOrderId - Work order ID to release
   */
  public releaseCapacity(modelName: string, workOrderId: string): void {
    const activeSet = this.activeExecutions.get(modelName);
    if (activeSet) {
      activeSet.delete(workOrderId);
      console.log(`[CapacityManager] Released capacity for ${modelName}: ${activeSet.size}/${this.getCapacityLimit(modelName)} (WO ${workOrderId})`);
    }
  }

  /**
   * Get current active execution count for a model
   *
   * @param modelName - LLM model name
   * @returns Count of active executions
   */
  public getActiveCount(modelName: string): number {
    const activeSet = this.activeExecutions.get(modelName);
    return activeSet ? activeSet.size : 0;
  }

  /**
   * Get capacity limit for a model
   *
   * @param modelName - LLM model name
   * @returns Max concurrent executions allowed
   */
  public getCapacityLimit(modelName: string): number {
    // Normalize model name (handle variations)
    const normalizedModel = this.normalizeModelName(modelName);

    return MODEL_CAPACITY_LIMITS[normalizedModel as keyof typeof MODEL_CAPACITY_LIMITS] ||
           MODEL_CAPACITY_LIMITS.default;
  }

  /**
   * Get capacity status for all models
   *
   * @returns Object with model capacity status
   */
  public getCapacityStatus(): Record<string, { active: number; limit: number; available: number }> {
    const status: Record<string, { active: number; limit: number; available: number }> = {};

    // Include all known models
    Object.keys(MODEL_CAPACITY_LIMITS).forEach(model => {
      const active = this.getActiveCount(model);
      const limit = this.getCapacityLimit(model);
      status[model] = {
        active,
        limit,
        available: limit - active
      };
    });

    return status;
  }

  /**
   * Wait for capacity to become available
   *
   * Blocks until model has capacity, or timeout reached
   *
   * @param modelName - LLM model name
   * @param timeoutMs - Max wait time in milliseconds (default 60000 = 1 min)
   * @returns True if capacity available, false if timeout
   */
  public async waitForCapacity(modelName: string, timeoutMs: number = 60000): Promise<boolean> {
    const startTime = Date.now();

    while (!this.hasCapacity(modelName)) {
      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        console.warn(`[CapacityManager] Timeout waiting for ${modelName} capacity after ${timeoutMs}ms`);
        return false;
      }

      // Wait 5 seconds and check again
      console.log(`[CapacityManager] Waiting for ${modelName} capacity (${this.getActiveCount(modelName)}/${this.getCapacityLimit(modelName)} active)...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return true;
  }

  /**
   * Normalize model name to match capacity limit keys
   *
   * Handles variations:
   * - "claude-sonnet-4-5-20250929" → "claude-sonnet-4-5"
   * - "gpt-4o-mini" → "gpt-4o-mini"
   *
   * @param modelName - Raw model name
   * @returns Normalized model name
   */
  private normalizeModelName(modelName: string): string {
    if (modelName.startsWith('claude-sonnet-4')) {
      return 'claude-sonnet-4-5';
    }
    if (modelName.startsWith('gpt-4o-mini')) {
      return 'gpt-4o-mini';
    }
    return modelName;
  }

  /**
   * Reset capacity manager (for testing)
   */
  public reset(): void {
    this.activeExecutions.clear();
    Object.keys(MODEL_CAPACITY_LIMITS).forEach(model => {
      this.activeExecutions.set(model, new Set());
    });
  }
}
