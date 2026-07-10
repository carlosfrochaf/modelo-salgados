import { NextRequest } from 'next/server';
import { authService } from '@/services/auth';
import orderEvents from '@/lib/orderEvents';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify active session before establishing stream
  const session = await authService.verifySession();
  if (!session) {
    return new Response('Não autorizado', { status: 401 });
  }

  const encoder = new TextEncoder();

  const customReadableStream = new ReadableStream({
    start(controller) {
      // Heartbeat interval to prevent proxy or server connection timeouts (Vercel, Cloudflare, etc.)
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          cleanup();
        }
      }, 30000);

      // Event listeners
      const onOrderCreated = (order: any) => {
        try {
          const message = `data: ${JSON.stringify({ type: 'orderCreated', order })}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          cleanup();
        }
      };

      const onOrderUpdated = (order: any) => {
        try {
          const message = `data: ${JSON.stringify({ type: 'orderUpdated', order })}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          cleanup();
        }
      };

      // Register listeners
      orderEvents.on('orderCreated', onOrderCreated);
      orderEvents.on('orderUpdated', onOrderUpdated);

      const cleanup = () => {
        clearInterval(heartbeatInterval);
        orderEvents.off('orderCreated', onOrderCreated);
        orderEvents.off('orderUpdated', onOrderUpdated);
        try {
          controller.close();
        } catch {}
      };

      // Clean up when request is closed/aborted
      request.signal.addEventListener('abort', () => {
        cleanup();
      });
    },
    cancel() {
      // Triggered when client cancels connection explicitly
    }
  });

  return new Response(customReadableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
