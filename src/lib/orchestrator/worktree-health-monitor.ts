// Worktree Pool Health Monitor - Periodic health checks and metrics emission

import { WorktreePoolManager } from './worktree-pool';

export interface WorktreeHealthMetrics {
  timestamp: Date;
  pool_status: {
    total: number;
    available: number;
    leased: number;
    waiters: number;
    utilization_percent: number;
  };
  lease_durations: {
    min_minutes: number;
    max_minutes: number;
    avg_minutes: number;
  };
  alerts: Array<{
    severity: 'warning' | 'critical';
    message: string;
    work_order_id?: string;
  }>;
}

interface LeasedWorktreeInfo {
  work_order_id: string;
  leased_at: Date;
  duration_minutes: number;
}

/**
 * WorktreeHealthMonitor
 *
 * Monitors worktree pool health and emits structured metrics.
 *
 * Features:
 * - 60s health check loop
 * - Structured metrics: worktree.pool.available, worktree.lease.duration
 * - Alerts if worktrees stuck (leased >20min) or pool exhausted >5min
 *
 * Usage:
 *   const monitor = new WorktreeHealthMonitor();
 *   monitor.start();
 *   // ... later ...
 *   monitor.stop();
 */
export class WorktreeHealthMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private poolExhaustedSince: Date | null = null;
  private readonly checkIntervalMs: number;
  private readonly stuckThresholdMinutes: number = 20;
  private readonly exhaustedThresholdMinutes: number = 5;

  constructor(checkIntervalMs: number = 60000) {
    this.checkIntervalMs = checkIntervalMs;
  }

  /**
   * Start health monitoring loop
   */
  start(): void {
    if (this.intervalId) {
      console.log('[WorktreeHealthMonitor] Already running');
      return;
    }

    console.log(`[WorktreeHealthMonitor] Starting health checks every ${this.checkIntervalMs / 1000}s`);

    // Run initial check immediately
    this.performHealthCheck();

    // Set up interval
    this.intervalId = setInterval(() => {
      this.performHealthCheck();
    }, this.checkIntervalMs);
  }

  /**
   * Stop health monitoring loop
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.poolExhaustedSince = null;
      console.log('[WorktreeHealthMonitor] Stopped');
    }
  }

  /**
   * Perform a health check and emit metrics
   */
  private performHealthCheck(): void {
    const poolManager = WorktreePoolManager.getInstance();

    if (!poolManager.isEnabled()) {
      return;
    }

    try {
      const metrics = this.collectMetrics(poolManager);
      this.emitMetrics(metrics);
      this.checkAlerts(metrics);
    } catch (error: any) {
      console.error('[WorktreeHealthMonitor] Health check failed:', error.message);
    }
  }

  /**
   * Collect metrics from pool manager
   */
  private collectMetrics(poolManager: WorktreePoolManager): WorktreeHealthMetrics {
    const status = poolManager.getStatus();
    const now = new Date();

    // Calculate lease durations
    const leasedInfo: LeasedWorktreeInfo[] = [];
    Array.from(status.leasedWorktrees.entries()).forEach(([workOrderId, handle]) => {
      if (handle.leased_at) {
        const durationMs = now.getTime() - handle.leased_at.getTime();
        const durationMinutes = durationMs / 60000;
        leasedInfo.push({
          work_order_id: workOrderId,
          leased_at: handle.leased_at,
          duration_minutes: durationMinutes
        });
      }
    });

    // Calculate lease duration stats
    const durations = leasedInfo.map(i => i.duration_minutes);
    const leaseDurations = {
      min_minutes: durations.length > 0 ? Math.min(...durations) : 0,
      max_minutes: durations.length > 0 ? Math.max(...durations) : 0,
      avg_minutes: durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : 0
    };

    // Calculate utilization
    const utilizationPercent = status.total > 0
      ? (status.leased / status.total) * 100
      : 0;

    // Check for alerts
    const alerts: Array<{ severity: 'warning' | 'critical'; message: string; work_order_id?: string }> = [];

    // Alert: Worktrees stuck (leased >20min)
    for (const info of leasedInfo) {
      if (info.duration_minutes > this.stuckThresholdMinutes) {
        alerts.push({
          severity: 'warning',
          message: `Worktree leased for ${info.duration_minutes.toFixed(1)} minutes (threshold: ${this.stuckThresholdMinutes} min)`,
          work_order_id: info.work_order_id
        });
      }
    }

    // Alert: Pool exhausted
    if (status.available === 0 && status.total > 0) {
      if (!this.poolExhaustedSince) {
        this.poolExhaustedSince = now;
      }

      const exhaustedMinutes = (now.getTime() - this.poolExhaustedSince.getTime()) / 60000;
      if (exhaustedMinutes > this.exhaustedThresholdMinutes) {
        alerts.push({
          severity: 'critical',
          message: `Pool exhausted for ${exhaustedMinutes.toFixed(1)} minutes (threshold: ${this.exhaustedThresholdMinutes} min)`,
        });
      }
    } else {
      // Pool has availability - reset exhausted timer
      this.poolExhaustedSince = null;
    }

    return {
      timestamp: now,
      pool_status: {
        total: status.total,
        available: status.available,
        leased: status.leased,
        waiters: status.waiters,
        utilization_percent: utilizationPercent
      },
      lease_durations: leaseDurations,
      alerts
    };
  }

  /**
   * Emit structured metrics
   *
   * Format compatible with observability platforms (Datadog, Prometheus, etc.)
   */
  private emitMetrics(metrics: WorktreeHealthMetrics): void {
    // Emit pool metrics
    console.log('[WorktreeHealthMetrics]', JSON.stringify({
      timestamp: metrics.timestamp.toISOString(),
      metric: 'worktree.pool.total',
      value: metrics.pool_status.total,
      unit: 'count'
    }));

    console.log('[WorktreeHealthMetrics]', JSON.stringify({
      timestamp: metrics.timestamp.toISOString(),
      metric: 'worktree.pool.available',
      value: metrics.pool_status.available,
      unit: 'count'
    }));

    console.log('[WorktreeHealthMetrics]', JSON.stringify({
      timestamp: metrics.timestamp.toISOString(),
      metric: 'worktree.pool.leased',
      value: metrics.pool_status.leased,
      unit: 'count'
    }));

    console.log('[WorktreeHealthMetrics]', JSON.stringify({
      timestamp: metrics.timestamp.toISOString(),
      metric: 'worktree.pool.waiters',
      value: metrics.pool_status.waiters,
      unit: 'count'
    }));

    console.log('[WorktreeHealthMetrics]', JSON.stringify({
      timestamp: metrics.timestamp.toISOString(),
      metric: 'worktree.pool.utilization_percent',
      value: metrics.pool_status.utilization_percent.toFixed(2),
      unit: 'percent'
    }));

    // Emit lease duration metrics
    if (metrics.pool_status.leased > 0) {
      console.log('[WorktreeHealthMetrics]', JSON.stringify({
        timestamp: metrics.timestamp.toISOString(),
        metric: 'worktree.lease.duration.min',
        value: metrics.lease_durations.min_minutes.toFixed(2),
        unit: 'minutes'
      }));

      console.log('[WorktreeHealthMetrics]', JSON.stringify({
        timestamp: metrics.timestamp.toISOString(),
        metric: 'worktree.lease.duration.max',
        value: metrics.lease_durations.max_minutes.toFixed(2),
        unit: 'minutes'
      }));

      console.log('[WorktreeHealthMetrics]', JSON.stringify({
        timestamp: metrics.timestamp.toISOString(),
        metric: 'worktree.lease.duration.avg',
        value: metrics.lease_durations.avg_minutes.toFixed(2),
        unit: 'minutes'
      }));
    }
  }

  /**
   * Check and log alerts
   */
  private checkAlerts(metrics: WorktreeHealthMetrics): void {
    for (const alert of metrics.alerts) {
      if (alert.severity === 'critical') {
        console.error('[WorktreeHealthAlert] CRITICAL:', alert.message, alert.work_order_id ? `(WO: ${alert.work_order_id})` : '');
      } else {
        console.warn('[WorktreeHealthAlert] WARNING:', alert.message, alert.work_order_id ? `(WO: ${alert.work_order_id})` : '');
      }
    }
  }

  /**
   * Check if monitoring is active
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }
}

// Export singleton instance for convenience
export const worktreeHealthMonitor = new WorktreeHealthMonitor();
