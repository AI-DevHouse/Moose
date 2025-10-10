/**
 * Centralized error escalation helper
 * Uses existing Client Manager API (v35-v37)
 * Phase 2B.3: Enhanced with failure classification and decision logging
 */

import { classifyError } from './failure-classifier';
import { logEscalationDecision } from './decision-logger';

export async function handleCriticalError(opts: {
  component: string;          // e.g., "ResultTracker", "Sentinel"
  operation: string;           // e.g., "writeOutcomeVectors", "callClientManager"
  error: Error;
  workOrderId?: string | null; // If related to Work Order
  severity: 'critical' | 'warning';
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { component, operation, error, workOrderId, severity, metadata } = opts;

  // Classify the error using our failure classification system
  const classification = classifyError(error, {
    component,
    operation,
    metadata
  });

  // ALWAYS log for debugging (now with classification)
  console.error(`[${component}] ${operation} failed (${classification.failure_class}):`, error, metadata);

  // If critical AND has work_order_id: escalate to Client Manager
  if (severity === 'critical' && workOrderId) {
    try {
      const response = await fetch('http://localhost:3000/api/client-manager/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_order_id: workOrderId,
          reason: `${component} failure: ${operation}`,
          failure_class: classification.failure_class,  // NEW: Include classification
          metadata: {
            error: error.message,
            stack: error.stack,
            failure_class: classification.failure_class,
            error_context: classification.error_context,
            ...metadata
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ErrorEscalation] Failed to escalate:', errorText);

        // Log failed escalation attempt
        await logEscalationDecision({
          work_order_id: workOrderId,
          component,
          operation,
          failure_class: classification.failure_class,
          severity,
          success: false
        }).catch(err => console.error('[ErrorEscalation] Failed to log decision:', err));
      } else {
        const result = await response.json();
        console.log(`[ErrorEscalation] Escalation created: ${result.escalation.id} (${classification.failure_class})`);

        // Log successful escalation decision
        await logEscalationDecision({
          work_order_id: workOrderId,
          component,
          operation,
          failure_class: classification.failure_class,
          severity,
          success: true
        }).catch(err => console.error('[ErrorEscalation] Failed to log decision:', err));
      }
    } catch (escalationError) {
      // Don't throw - escalation failure shouldn't crash the system
      console.error('[ErrorEscalation] Escalation itself failed:', escalationError);

      // Log the escalation failure
      await logEscalationDecision({
        work_order_id: workOrderId,
        component,
        operation,
        failure_class: classification.failure_class,
        severity,
        success: false
      }).catch(err => console.error('[ErrorEscalation] Failed to log decision:', err));
    }
  }

  // If critical but NO work_order_id: Log to system_alerts (future enhancement)
  // For now, console.error is sufficient for infrastructure errors
}
