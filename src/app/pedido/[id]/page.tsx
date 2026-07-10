import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import PedidoTracking from './PedidoTracking';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PedidoPage({ params }: PageProps) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order) {
    notFound();
  }

  // Convert date and relations to simple types that match PedidoTracking's expected Order interface
  const serializedOrder = {
    id: order.id,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryType: order.deliveryType,
    deliveryAddress: order.deliveryAddress,
    deliveryFee: order.deliveryFee,
    status: order.status,
    total: order.total,
    createdAt: order.createdAt.toISOString(),
    observations: order.observations,
    items: order.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      product: {
        id: item.product.id,
        name: item.product.name,
        price: item.product.price,
      },
    })),
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '20px 0' }}>
      <PedidoTracking initialOrder={serializedOrder} />
    </main>
  );
}
