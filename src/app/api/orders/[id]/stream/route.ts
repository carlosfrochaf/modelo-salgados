import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import orderEvents from '@/lib/orderEvents';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify that the order exists
  const orderExists = await prisma.order.findUnique({
    where: { id },
  });

  if (!orderExists) {
    return new Response('Pedido não encontrado', { status: 404 });
  }

  const encoder = new TextEncoder();

  const customReadableStream = new ReadableStream({
    start(controller) {
      // Periodic heartbeat to prevent proxy timeouts
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          cleanup();
        }
      }, 30000);

      // Event listener for updates on this specific order ID
      const onOrderUpdated = (order: any) => {
        if (order.id === id) {
          try {
            const message = `data: ${JSON.stringify({ status: order.status, order })}\n\n`;
            controller.enqueue(encoder.encode(message));
          } catch {
            cleanup();
          }
        }
      };

      orderEvents.on('orderUpdated', onOrderUpdated);

      const cleanup = () => {
        clearInterval(heartbeatInterval);
        orderEvents.off('orderUpdated', onOrderUpdated);
        try {
          controller.close();
        } catch {}
      };

      request.signal.addEventListener('abort', () => {
        cleanup();
      });
    },
    cancel() {
      // Closed by client browser
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
