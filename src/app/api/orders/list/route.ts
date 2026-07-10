import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ids } = body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ orders: [] });
    }

    const orders = await prisma.order.findMany({
      where: {
        id: { in: ids },
      },
      select: {
        id: true,
        customerName: true,
        status: true,
        total: true,
        createdAt: true,
        deliveryType: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error('Erro ao listar pedidos do cliente:', error);
    return NextResponse.json(
      { error: 'Erro ao listar seus pedidos recentes.' },
      { status: 500 }
    );
  }
}
