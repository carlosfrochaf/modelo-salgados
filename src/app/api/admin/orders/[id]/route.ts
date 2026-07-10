import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authService } from '@/services/auth';
import orderEvents from '@/lib/orderEvents';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authService.verifySession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const { status } = await request.json();

    if (!status) {
      return NextResponse.json({ error: 'Status é obrigatório' }, { status: 400 });
    }

    // Validate status type
    const validStatuses = ['NOVO', 'PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
    }

    // Update order status in database
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Emit event to update all active SSE connections
    orderEvents.emit('orderUpdated', updatedOrder);

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error('Erro ao atualizar status do pedido:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
