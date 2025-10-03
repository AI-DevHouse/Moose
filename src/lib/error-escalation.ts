/**
 * Centralized error escalation helper
 * Uses existing Client Manager API (v35-v37)
 */

export async function handleCriticalError(opts: {
  component: string;          // e.g., "ResultTracker", "Sentinel"
  operation: string;           // e.g., "writeOutcomeVectors", "callClientManager"
  error: Error;
  workOrderId?: string | null; // If related to Work Order
  severity: 'critical' | 'warning';
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { component, operation, error, workOrderId, severity, metadata } = opts;

  // ALWAYS log for debugging
  console.error(`[${component}] ${operation} failed:`, error, metadata);

  // If critical AND has work_order_id: escalate to Client Manager
  if (severity === 'critical' && workOrderId) {
    try {
      const response = await fetch('http://localhost:3000/api/client-manager/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_order_id: workOrderId,
          reason: `${component} failure: ${operation}`,
          metadata: {
            error: error.message,
            stack: error.stack,
            ...metadata
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ErrorEscalation] Failed to escalate:', errorText);
      } else {
        const result = await response.json();
        console.log(`[ErrorEscalation] Escalation created: ${result.escalation.id}`);
      }
    } catch (escalationError) {
      // Don't throw - escalation failure shouldn't crash the system
      console.error('[ErrorEscalation] Escalation itself failed:', escalationError);
    }
  }

  // If critical but NO work_order_id: Log to system_alerts (future enhancement)
  // For now, console.error is sufficient for infrastructure errors
}
