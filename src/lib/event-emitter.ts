// src/lib/event-emitter.ts
// Simple event bus for work order execution progress

export interface ExecutionEvent {
  type: 'started' | 'progress' | 'completed' | 'failed';
  message: string;
  progress: number;  // 0-100
  metadata?: any;
}

type EventCallback = (event: ExecutionEvent) => void;

/**
 * Singleton event emitter for work order execution events
 * Supports Server-Sent Events (SSE) for real-time progress updates
 */
class ExecutionEventEmitter {
  private static instance: ExecutionEventEmitter;
  private listeners: Map<string, EventCallback[]> = new Map();

  private constructor() {}

  static getInstance(): ExecutionEventEmitter {
    if (!ExecutionEventEmitter.instance) {
      ExecutionEventEmitter.instance = new ExecutionEventEmitter();
    }
    return ExecutionEventEmitter.instance;
  }

  /**
   * Register a listener for a specific work order
   */
  on(workOrderId: string, callback: EventCallback): void {
    if (!this.listeners.has(workOrderId)) {
      this.listeners.set(workOrderId, []);
    }
    this.listeners.get(workOrderId)!.push(callback);
  }

  /**
   * Remove a specific listener
   */
  off(workOrderId: string, callback: EventCallback): void {
    const callbacks = this.listeners.get(workOrderId);
    if (!callbacks) return;

    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }

    // Clean up empty arrays
    if (callbacks.length === 0) {
      this.listeners.delete(workOrderId);
    }
  }

  /**
   * Emit an event to all listeners for a work order
   */
  emit(workOrderId: string, event: ExecutionEvent): void {
    const callbacks = this.listeners.get(workOrderId);
    if (!callbacks || callbacks.length === 0) {
      console.log(`[EventEmitter] No listeners for ${workOrderId}, event:`, event.type);
      return;
    }

    console.log(`[EventEmitter] Emitting ${event.type} to ${callbacks.length} listeners for ${workOrderId}`);
    callbacks.forEach(cb => {
      try {
        cb(event);
      } catch (error: any) {
        console.error('[EventEmitter] Callback error:', error.message);
      }
    });

    // Auto-cleanup completed/failed events after short delay
    if (event.type === 'completed' || event.type === 'failed') {
      setTimeout(() => {
        this.removeAllListeners(workOrderId);
      }, 5000); // 5 second delay to allow final events to be sent
    }
  }

  /**
   * Remove all listeners for a work order
   */
  removeAllListeners(workOrderId: string): void {
    this.listeners.delete(workOrderId);
    console.log(`[EventEmitter] Removed all listeners for ${workOrderId}`);
  }

  /**
   * Get listener count for debugging
   */
  getListenerCount(workOrderId: string): number {
    return this.listeners.get(workOrderId)?.length || 0;
  }

  /**
   * Get all active work order IDs (for debugging)
   */
  getActiveWorkOrders(): string[] {
    return Array.from(this.listeners.keys());
  }
}

export const executionEvents = ExecutionEventEmitter.getInstance();
