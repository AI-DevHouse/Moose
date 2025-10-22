// Orchestrator Service - Main coordinator for Work Order execution

import { handleCriticalError } from '@/lib/error-escalation';
import type { OrchestratorStatus, ExecutionResult, WorkOrder, WorktreeHandle } from './types';
import { pollPendingWorkOrders, getWorkOrder } from './work-order-poller';
import { getRoutingDecision } from './manager-coordinator';
import { generateCode } from './proposer-executor';
import { executeAider, rollbackAider } from './aider-executor';
import { pushBranchAndCreatePR, rollbackPR } from './github-integration';
import { trackSuccessfulExecution, trackFailedExecution } from './result-tracker';
import { CapacityManager } from './capacity-manager';
import { executionEvents } from '@/lib/event-emitter';
import { validateWorkOrderAcceptance } from '@/lib/acceptance-validator';
import { projectService } from '@/lib/project-service';
import { createSupabaseServiceClient } from '@/lib/supabase';
import { WorktreePoolManager } from './worktree-pool';

/**
 * Orchestrator Service (Singleton)
 *
 * Coordinates the entire Work Order execution pipeline:
 * 1. Poll for pending approved Work Orders
 * 2. Get routing decision from Manager
 * 3. Generate code via Proposer
 * 4. Apply code via Aider
 * 5. Create PR on GitHub
 * 6. Validate acceptance (Phase 4) - 5-dimension quality scoring
 * 7. Track results in database
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
  public async startPolling(intervalMs: number = 10000): Promise<void> {
    if (this.pollingInterval) {
      console.log('[Orchestrator] Polling already started');
      return;
    }

    this.pollingIntervalMs = intervalMs;

    console.log(`[Orchestrator] Starting polling with interval ${intervalMs}ms`);

    // Initialize worktree pool if enabled
    const worktreePool = WorktreePoolManager.getInstance();
    if (worktreePool.isEnabled()) {
      try {
        // Get the target project (assume first active project for now)
        const projects = await projectService.listProjects('active');
        const targetProject = projects.find(p => p.name === 'multi-llm-discussion-v1');

        if (targetProject) {
          const poolSize = parseInt(process.env.WORKTREE_POOL_SIZE || '15', 10);
          console.log(`[Orchestrator] Initializing worktree pool with ${poolSize} worktrees...`);
          await worktreePool.initialize(targetProject, poolSize);
          console.log('[Orchestrator] Worktree pool initialized successfully');
        } else {
          console.warn('[Orchestrator] Target project not found, worktree pool disabled');
        }
      } catch (error: any) {
        console.error('[Orchestrator] Failed to initialize worktree pool:', error.message);
        console.warn('[Orchestrator] Continuing without worktree pool (shared directory mode)');
      }
    } else {
      console.log('[Orchestrator] Worktree pool disabled (WORKTREE_POOL_ENABLED=false)');
    }

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
  public async stopPolling(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('[Orchestrator] Polling stopped');

      // Cleanup worktree pool
      const worktreePool = WorktreePoolManager.getInstance();
      if (worktreePool.isEnabled()) {
        try {
          console.log('[Orchestrator] Cleaning up worktree pool...');
          await worktreePool.cleanup();
          console.log('[Orchestrator] Worktree pool cleanup complete');
        } catch (error: any) {
          console.error('[Orchestrator] Failed to cleanup worktree pool:', error.message);
        }
      }
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
      // Default 15 to allow 10 Claude + 5 GPT concurrent (model limits handle actual throttling)
      const maxConcurrent = parseInt(process.env.ORCHESTRATOR_MAX_CONCURRENT_EXECUTIONS || '15', 10);

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
    const worktreePool = WorktreePoolManager.getInstance();
    let modelName: string | null = null;
    let worktreeHandle: WorktreeHandle | null = null;

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

      // Update status to 'in_progress' in database
      const supabase = createSupabaseServiceClient();
      await supabase
        .from('work_orders')
        .update({ status: 'in_progress' })
        .eq('id', workOrderId);

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

      // 4. Lease worktree (if pool enabled)
      if (worktreePool.isEnabled()) {
        console.log(`[Orchestrator] Leasing worktree for WO ${workOrderId}`);
        try {
          worktreeHandle = await worktreePool.leaseWorktree(workOrderId);
          console.log(`[Orchestrator] Leased ${worktreeHandle.id} for WO ${workOrderId}`);
        } catch (error: any) {
          console.error(`[Orchestrator] Failed to lease worktree: ${error.message}`);
          throw error;
        }
      }

      // 5. Apply code via Aider
      console.log(`[Orchestrator] Step 3/5: Applying code via Aider for WO ${workOrderId}`);
      executionEvents.emit(workOrderId, {
        type: 'progress',
        message: `Executing with Aider...`,
        progress: 60
      });
      let aiderResult;
      try {
        aiderResult = await executeAider(
          wo,
          proposerResponse,
          routingDecision.selected_proposer,
          worktreeHandle?.path  // Pass worktree path if available
        );

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

      // 6. Create PR on GitHub
      console.log(`[Orchestrator] Step 4/6: Creating PR for WO ${workOrderId}`);
      executionEvents.emit(workOrderId, {
        type: 'progress',
        message: `Creating pull request...`,
        progress: 85
      });

      // Get working directory for potential rollback
      let workingDirectory = worktreeHandle?.path || process.cwd();
      if (!worktreeHandle && wo.project_id) {
        const project = await projectService.getProject(wo.project_id);
        if (project) {
          workingDirectory = project.local_path;
        }
      }

      let prResult;
      try {
        prResult = await pushBranchAndCreatePR(
          wo,
          aiderResult.branch_name,
          routingDecision,
          proposerResponse,
          worktreeHandle?.path  // Pass worktree path if available
        );
      } catch (error: any) {
        await trackFailedExecution(wo, error, 'github');
        // Rollback PR (will also rollback Aider branch)
        rollbackPR(aiderResult.branch_name, workingDirectory);
        throw error;
      }

      // 7. Run acceptance validation (Phase 4)
      console.log(`[Orchestrator] Step 5/6: Running acceptance validation for WO ${workOrderId}`);
      executionEvents.emit(workOrderId, {
        type: 'progress',
        message: `Validating work order quality...`,
        progress: 92
      });

      try {
        // Get project path (use worktree path if available, otherwise project.local_path)
        let projectPath: string;
        if (worktreeHandle?.path) {
          projectPath = worktreeHandle.path;
        } else {
          if (!wo.project_id) {
            throw new Error('Work order has no project_id and no worktree path for acceptance validation');
          }
          const project = await projectService.getProject(wo.project_id);
          if (!project) {
            throw new Error(`Project ${wo.project_id} not found for acceptance validation`);
          }
          projectPath = project.local_path;
        }

        // Run acceptance validation
        const acceptance = await validateWorkOrderAcceptance(
          workOrderId,
          prResult.pr_url,
          projectPath
        );

        // Store acceptance result and update status
        const supabase = createSupabaseServiceClient();
        const newStatus = acceptance.acceptance_score >= 7 ? 'completed' : 'needs_review';

        await supabase.from('work_orders').update({
          acceptance_result: acceptance,
          status: newStatus
        }).eq('id', workOrderId);

        console.log(
          `[Orchestrator] Acceptance validation complete: ${acceptance.acceptance_score.toFixed(1)}/10 ` +
          `(status: ${newStatus})`
        );

        executionEvents.emit(workOrderId, {
          type: 'progress',
          message: `Acceptance score: ${acceptance.acceptance_score.toFixed(1)}/10`,
          progress: 95
        });
      } catch (error: any) {
        console.warn(`[Orchestrator] Acceptance validation failed (non-fatal): ${error.message}`);
        // Continue - acceptance validation failure is not fatal
      }

      // 8. Track successful execution
      console.log(`[Orchestrator] Step 6/6: Tracking results for WO ${workOrderId}`);
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

      // Release worktree
      if (worktreeHandle) {
        try {
          console.log(`[Orchestrator] Releasing ${worktreeHandle.id} from WO ${workOrderId}`);
          await worktreePool.releaseWorktree(worktreeHandle);
        } catch (error: any) {
          console.error(`[Orchestrator] Failed to release worktree: ${error.message}`);
          // Non-fatal - continue
        }
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
