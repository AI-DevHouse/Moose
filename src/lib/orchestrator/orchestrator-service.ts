// Orchestrator Service - Main coordinator for Work Order execution

import { handleCriticalError } from '@/lib/error-escalation';
import type { OrchestratorStatus, ExecutionResult, WorkOrder } from './types';
import { pollPendingWorkOrders, getWorkOrder } from './work-order-poller';
import { getRoutingDecision } from './manager-coordinator';
import { generateCode } from './proposer-executor';
import { executeAider, rollbackAider } from './aider-executor';
import { pushBranchAndCreatePR, rollbackPR } from './github-integration';
import { trackSuccessfulExecution, trackFailedExecution } from './result-tracker';
import { CapacityManager } from './capacity-manager';
import { executionEvents } from '@/lib/event-emitter';

/**
 * Orchestrator Service (Singleton)
 *
 * Coordinates the entire Work Order execution pipeline:
 * 1. Poll for pending approved Work Orders
 * 2. Get routing decision from Manager
 * 3. Generate code via Proposer
 * 4. Apply code via Aider
 * 5. Create PR on GitHub
 * 6. Track results in database
 */
export class OrchestratorService {
  private static instance: OrchestratorService;

  private pollingInterval: NodeJS.Timeout | null = null;
  private pollingIntervalMs: number = 10000;
  private executingWorkOrders: Set<string> = new Set();
  private lastPoll: Date | null = null;
  private totalExecuted: number = 0;
  private totalFailed: number = 0;
  private errors: Array<{ message: string; timestamp: string; work_order_id?: string }> = [];

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): OrchestratorService {
    if (!OrchestratorService.instance) {
      OrchestratorService.instance = new OrchestratorService();
    }
    return OrchestratorService.instance;
  }

  /**
   * Start polling for pending Work Orders
   *
   * @param intervalMs - Polling interval in milliseconds (default 10000)
   */
  public startPolling(intervalMs: number = 10000): void {
    if (this.pollingInterval) {
      console.log('[Orchestrator] Polling already started');
      return;
    }

    this.pollingIntervalMs = intervalMs;

    console.log(`[Orchestrator] Starting polling with interval ${intervalMs}ms`);

    // Start polling immediately
    this.poll();

    // Set up interval
    this.pollingInterval = setInterval(() => {
      this.poll();
    }, intervalMs);
  }

  /**
   * Stop polling
   */
  public stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('[Orchestrator] Polling stopped');
    } else {
      console.log('[Orchestrator] Polling not active');
    }
  }

  /**
   * Poll for pending Work Orders and execute them
   */
  private async poll(): Promise<void> {
    this.lastPoll = new Date();

    try {
      const workOrders = await pollPendingWorkOrders();

      if (workOrders.length === 0) {
        console.log('[Orchestrator] No pending Work Orders');
        return;
      }

      console.log(`[Orchestrator] Found ${workOrders.length} pending Work Orders`);

      // Execute Work Orders (with concurrency limit)
      const maxConcurrent = parseInt(process.env.ORCHESTRATOR_MAX_CONCURRENT_EXECUTIONS || '3', 10);

      for (const wo of workOrders) {
        // Skip if already executing
        if (this.executingWorkOrders.has(wo.id)) {
          console.log(`[Orchestrator] WO ${wo.id} already executing, skipping`);
          continue;
        }

        // Wait if at max concurrent executions
        while (this.executingWorkOrders.size >= maxConcurrent) {
          console.log(`[Orchestrator] At max concurrent executions (${maxConcurrent}), waiting...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // Execute Work Order (non-blocking)
        this.executeWorkOrderAsync(wo.id);
      }
    } catch (error: any) {
      await handleCriticalError({
        component: 'Orchestrator',
        operation: 'poll',
        error: error,
        workOrderId: null,
        severity: 'critical',
        metadata: { lastPoll: this.lastPoll?.toISOString() }
      });
      this.addError(error.message);
    }
  }

  /**
   * Execute Work Order asynchronously (non-blocking)
   *
   * @param workOrderId - Work Order ID
   */
  private async executeWorkOrderAsync(workOrderId: string): Promise<void> {
    try {
      await this.executeWorkOrder(workOrderId);
    } catch (error: any) {
      await handleCriticalError({
        component: 'Orchestrator',
        operation: 'executeWorkOrderAsync',
        error: error,
        workOrderId: workOrderId,
        severity: 'critical',
        metadata: {}
      });
      this.addError(error.message, workOrderId);
    }
  }

  /**
   * Execute a single Work Order
   *
   * Full pipeline:
   * 1. Get routing decision from Manager
   * 2. Generate code via Proposer
   * 3. Apply code via Aider
   * 4. Create PR on GitHub
   * 5. Track results
   *
   * @param workOrderId - Work Order ID
   * @returns Execution result
   */
  public async executeWorkOrder(workOrderId: string): Promise<ExecutionResult> {
    const startTime = Date.now();
    const capacityManager = CapacityManager.getInstance();
    let modelName: string | null = null;

    // Mark as executing
    this.executingWorkOrders.add(workOrderId);

    console.log(`[Orchestrator] Starting execution for WO ${workOrderId}`);

    // Emit started event
    executionEvents.emit(workOrderId, {
      type: 'started',
      message: 'Starting work order execution...',
      progress: 0
    });

    try {
      // 1. Get Work Order
      const wo = await getWorkOrder(workOrderId);
      if (!wo) {
        throw new Error(`Work Order ${workOrderId} not found`);
      }

      executionEvents.emit(workOrderId, {
        type: 'progress',
        message: `Loaded work order: ${wo.title}`,
        progress: 10
      });

      // 2. Get routing decision from Manager
      console.log(`[Orchestrator] Step 1/5: Getting routing decision for WO ${workOrderId}`);
      let routingDecision;
      try {
        routingDecision = await getRoutingDecision(wo);
        modelName = routingDecision.selected_proposer;

        executionEvents.emit(workOrderId, {
          type: 'progress',
          message: `Selected model: ${modelName}`,
          progress: 20
        });

        // Reserve capacity for this model (uses 10min default timeout from capacity-manager)
        const capacityAvailable = await capacityManager.waitForCapacity(modelName);
        if (!capacityAvailable) {
          throw new Error(`Timeout waiting for ${modelName} capacity`);
        }

        const reserved = capacityManager.reserveCapacity(modelName, workOrderId);
        if (!reserved) {
          throw new Error(`Failed to reserve capacity for ${modelName}`);
        }
      } catch (error: any) {
        await trackFailedExecution(wo, error, 'routing');
        throw error;
      }

      // 3. Generate code via Proposer
      console.log(`[Orchestrator] Step 2/5: Generating code for WO ${workOrderId}`);
      executionEvents.emit(workOrderId, {
        type: 'progress',
        message: `Generating code solution...`,
        progress: 30
      });
      let proposerResponse;
      try {
        proposerResponse = await generateCode(wo);

        executionEvents.emit(workOrderId, {
          type: 'progress',
          message: `Code solution generated successfully`,
          progress: 50
        });
      } catch (error: any) {
        await trackFailedExecution(wo, error, 'proposer');
        throw error;
      }

      // 4. Apply code via Aider
      console.log(`[Orchestrator] Step 3/5: Applying code via Aider for WO ${workOrderId}`);
      executionEvents.emit(workOrderId, {
        type: 'progress',
        message: `Executing with Aider...`,
        progress: 60
      });
      let aiderResult;
      try {
        aiderResult = await executeAider(wo, proposerResponse, routingDecision.selected_proposer);

        executionEvents.emit(workOrderId, {
          type: 'progress',
          message: `Code applied successfully, branch: ${aiderResult.branch_name}`,
          progress: 80
        });
      } catch (error: any) {
        await trackFailedExecution(wo, error, 'aider');
        // Rollback Aider changes
        if (aiderResult && aiderResult.branch_name) {
          rollbackAider(aiderResult.branch_name);
        }
        throw error;
      }

      // 5. Create PR on GitHub
      console.log(`[Orchestrator] Step 4/5: Creating PR for WO ${workOrderId}`);
      executionEvents.emit(workOrderId, {
        type: 'progress',
        message: `Creating pull request...`,
        progress: 90
      });
      let prResult;
      try {
        prResult = await pushBranchAndCreatePR(wo, aiderResult.branch_name, routingDecision, proposerResponse);
      } catch (error: any) {
        await trackFailedExecution(wo, error, 'github');
        // Rollback PR (will also rollback Aider branch)
        rollbackPR(aiderResult.branch_name);
        throw error;
      }

      // 6. Track successful execution
      console.log(`[Orchestrator] Step 5/5: Tracking results for WO ${workOrderId}`);
      await trackSuccessfulExecution(wo, routingDecision, proposerResponse, aiderResult, prResult);

      const executionTime = Date.now() - startTime;
      this.totalExecuted++;

      console.log(`[Orchestrator] Successfully executed WO ${workOrderId} in ${executionTime}ms`);

      // Emit completed event
      executionEvents.emit(workOrderId, {
        type: 'completed',
        message: `✅ Work order completed! PR created: ${prResult.pr_url}`,
        progress: 100,
        metadata: {
          pr_url: prResult.pr_url,
          pr_number: prResult.pr_number,
          branch_name: prResult.branch_name,
          execution_time_ms: executionTime
        }
      });

      return {
        success: true,
        work_order_id: workOrderId,
        pr_url: prResult.pr_url,
        pr_number: prResult.pr_number,
        branch_name: prResult.branch_name,
        execution_time_ms: executionTime
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      this.totalFailed++;

      // Emit failed event
      executionEvents.emit(workOrderId, {
        type: 'failed',
        message: `❌ Execution failed: ${error.message}`,
        progress: 0,
        metadata: {
          stage: error.stage || 'unknown',
          error: error.message
        }
      });

      await handleCriticalError({
        component: 'Orchestrator',
        operation: 'executeWorkOrder',
        error: error,
        workOrderId: workOrderId,
        severity: 'critical',
        metadata: {
          executionTime,
          stage: error.stage || 'unknown'
        }
      });

      return {
        success: false,
        work_order_id: workOrderId,
        execution_time_ms: executionTime,
        error: {
          stage: error.stage || 'unknown',
          message: error.message
        }
      };
    } finally {
      // Remove from executing set
      this.executingWorkOrders.delete(workOrderId);

      // Release capacity
      if (modelName) {
        capacityManager.releaseCapacity(modelName, workOrderId);
      }
    }
  }

  /**
   * Get current Orchestrator status
   */
  public getStatus(): OrchestratorStatus {
    return {
      polling: this.pollingInterval !== null,
      interval_ms: this.pollingIntervalMs,
      executing_count: this.executingWorkOrders.size,
      executing_work_orders: Array.from(this.executingWorkOrders),
      last_poll: this.lastPoll ? this.lastPoll.toISOString() : null,
      total_executed: this.totalExecuted,
      total_failed: this.totalFailed,
      errors: this.errors.slice(-10) // Last 10 errors
    };
  }

  /**
   * Add error to error log
   */
  private addError(message: string, workOrderId?: string): void {
    this.errors.push({
      message,
      timestamp: new Date().toISOString(),
      work_order_id: workOrderId
    });

    // Keep only last 50 errors
    if (this.errors.length > 50) {
      this.errors = this.errors.slice(-50);
    }
  }
}

// Export singleton instance
export const orchestratorService = OrchestratorService.getInstance();
