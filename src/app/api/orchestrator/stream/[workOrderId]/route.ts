export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// src/app/api/orchestrator/stream/[workOrderId]/route.ts
import { NextRequest } from 'next/server';
import { executionEvents, ExecutionEvent } from '@/lib/event-emitter';

export async function GET(
  request: NextRequest,
  { params }: { params: { workOrderId: string } }
) {
  const { workOrderId } = params;

  console.log(`[SSE] Client connected for work order: ${workOrderId}`);

  // Create a TransformStream for SSE
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<any>;

  const stream = new ReadableStream({
    start(c) {
      controller = c;

      // Send initial connection message
      const initialMessage = `data: ${JSON.stringify({
        type: 'connected',
        message: 'Connected to progress stream',
        progress: 0
      })}\n\n`;
      controller.enqueue(encoder.encode(initialMessage));

      // Register event listener
      const eventHandler = (event: ExecutionEvent) => {
        console.log(`[SSE] Sending event to client:`, event.type);

        const data = `data: ${JSON.stringify(event)}\n\n`;

        try {
          controller.enqueue(encoder.encode(data));

          // Close stream on completion or failure
          if (event.type === 'completed' || event.type === 'failed') {
            console.log(`[SSE] Closing stream for ${workOrderId}`);
            setTimeout(() => {
              try {
                controller.close();
              } catch (e) {
                // Stream may already be closed
              }
            }, 500);
          }
        } catch (error: any) {
          console.error('[SSE] Error sending event:', error.message);
        }
      };

      executionEvents.on(workOrderId, eventHandler);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        console.log(`[SSE] Client disconnected for ${workOrderId}`);
        executionEvents.off(workOrderId, eventHandler);
      });
    },

    cancel() {
      console.log(`[SSE] Stream cancelled for ${workOrderId}`);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering in nginx
    }
  });
}
