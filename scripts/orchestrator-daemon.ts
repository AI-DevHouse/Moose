#!/usr/bin/env ts-node
/**
 * Orchestrator Daemon - Standalone Polling Service
 *
 * Runs the orchestrator independently of Next.js server.
 * Polls Supabase for pending work orders and executes them locally.
 *
 * Usage:
 *   npm run orchestrator
 *   npm run orchestrator -- --interval 5000
 *
 * Environment Variables:
 *   ORCHESTRATOR_POLLING_INTERVAL_MS - Polling interval (default: 10000)
 *   ORCHESTRATOR_MAX_CONCURRENT_EXECUTIONS - Max concurrent work orders (default: 15)
 *   WORKTREE_POOL_ENABLED - Enable worktree pool (default: false)
 *   WORKTREE_POOL_SIZE - Number of worktrees in pool (default: 15)
 *   NEXT_PUBLIC_SUPABASE_URL - Supabase URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 */

// Environment variables are loaded via tsx --env-file=.env.local flag in npm script

import { OrchestratorService } from '../src/lib/orchestrator/orchestrator-service';
import { worktreeHealthMonitor } from '../src/lib/orchestrator/worktree-health-monitor';

// Validate required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPlease ensure .env.local is configured correctly.');
  process.exit(1);
}

// Parse CLI arguments
const args = process.argv.slice(2);
let pollingInterval = parseInt(
  process.env.ORCHESTRATOR_POLLING_INTERVAL_MS || '10000',
  10
);

// Check for --interval flag
const intervalIndex = args.indexOf('--interval');
if (intervalIndex >= 0 && args[intervalIndex + 1]) {
  pollingInterval = parseInt(args[intervalIndex + 1], 10);
}

// Get orchestrator instance
const orchestrator = OrchestratorService.getInstance();

console.log('🦌 Moose Mission Control - Orchestrator Daemon');
console.log('==============================================');
console.log(`Polling Interval: ${pollingInterval}ms`);
console.log(`Max Concurrent: ${process.env.ORCHESTRATOR_MAX_CONCURRENT_EXECUTIONS || 15}`);
console.log(`Worktree Pool: ${process.env.WORKTREE_POOL_ENABLED === 'true' ? 'Enabled' : 'Disabled'}`);
if (process.env.WORKTREE_POOL_ENABLED === 'true') {
  console.log(`Worktree Pool Size: ${process.env.WORKTREE_POOL_SIZE || 15}`);
}
console.log(`Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
console.log('==============================================\n');

// Start polling
orchestrator.startPolling(pollingInterval);

// Status monitoring every 30 seconds
setInterval(() => {
  const status = orchestrator.getStatus();
  console.log('\n--- Orchestrator Status ---');
  console.log(`Active: ${status.polling ? '✅' : '❌'}`);
  console.log(`Executing: ${status.executing_count} work orders`);
  console.log(`Last Poll: ${status.last_poll || 'Never'}`);
  console.log(`Total Executed: ${status.total_executed}`);
  console.log(`Total Failed: ${status.total_failed}`);

  if (status.executing_work_orders.length > 0) {
    console.log(`Currently Executing: ${status.executing_work_orders.join(', ')}`);
  }

  if (status.errors.length > 0) {
    console.log(`Recent Errors: ${status.errors.length}`);
    status.errors.slice(-3).forEach(err => {
      console.log(`  - ${err.timestamp}: ${err.message}`);
    });
  }
  console.log('---------------------------\n');
}, 30000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Received SIGINT, shutting down gracefully...');
  orchestrator.stopPolling();
  worktreeHealthMonitor.stop();
  console.log('✅ Orchestrator stopped');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Received SIGTERM, shutting down gracefully...');
  orchestrator.stopPolling();
  worktreeHealthMonitor.stop();
  console.log('✅ Orchestrator stopped');
  process.exit(0);
});

// Keep process alive
console.log('🚀 Orchestrator daemon started. Press Ctrl+C to stop.\n');
