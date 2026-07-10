import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import orderEvents from '@/lib/orderEvents';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerName, customerPhone, deliveryType, deliveryAddress, deliveryFee: bodyDeliveryFee, items, observations } = body as {
      customerName: string;
      customerPhone: string;
      deliveryType: 'ENTREGA' | 'RETIRADA';
      deliveryAddress?: string;
      deliveryFee?: number;
      items: Array<{ productId: string; quantity: number; selectedFlavors?: string }>;
      observations?: string;
    };

    if (!customerName || !customerPhone || !deliveryType || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Dados do pedido inválidos. Certifique-se de preencher nome, telefone e itens.' },
        { status: 400 }
      );
    }

    if (deliveryType === 'ENTREGA' && !deliveryAddress?.trim()) {
      return NextResponse.json(
        { error: 'O endereço de entrega é obrigatório para entrega em casa.' },
        { status: 400 }
      );
    }

    const deliveryFee = deliveryType === 'ENTREGA' ? (bodyDeliveryFee ?? 5.00) : 0.00;

    // Execute database transaction to check stock and decrement atomic quantities safely
    const result = await prisma.$transaction(async (tx) => {
      let itemsTotal = 0;
      const orderItemsToCreate = [];

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new Error(`Produto não encontrado.`);
        }

        if (!product.active) {
          throw new Error(`O produto "${product.name}" está temporariamente indisponível.`);
        }

        if (product.stockQuantity < item.quantity) {
          throw new Error(`Estoque insuficiente para o produto "${product.name}". Temos apenas ${product.stockQuantity} unidades.`);
        }

        const itemTotal = product.price * item.quantity;
        itemsTotal += itemTotal;

        orderItemsToCreate.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice: product.price,
          selectedFlavors: item.selectedFlavors || null,
        });

        // Decrement stock atomatically
        await tx.product.update({
          where: { id: product.id },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
          },
        });
      }

      const orderTotal = itemsTotal + deliveryFee;

      // Create the order with its relations
      const order = await tx.order.create({
        data: {
          customerName,
          customerPhone,
          deliveryType,
          deliveryAddress: deliveryType === 'ENTREGA' ? deliveryAddress : null,
          deliveryFee,
          status: 'NOVO',
          total: orderTotal,
          observations: observations || null,
          items: {
            create: orderItemsToCreate,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      return order;
    });

    // Notify active SSE connections
    orderEvents.emit('orderCreated', result);

    return NextResponse.json({ success: true, order: result });
  } catch (error: any) {
    console.error('Erro ao processar pedido:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar o seu pedido.' },
      { status: 400 }
    );
  }
}
