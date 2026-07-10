'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ClipboardList, 
  Flame, 
  Truck, 
  ShoppingBag, 
  CheckCircle, 
  ChevronLeft,
  XCircle,
  Clock
} from 'lucide-react';
import styles from './PedidoTracking.module.css';

interface Product {
  id: string;
  name: string;
  price: number;
}

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  product: Product;
  selectedFlavors?: string | null;
}

interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  deliveryType: string;
  deliveryAddress: string | null;
  deliveryFee: number;
  status: string;
  total: number;
  createdAt: string;
  items: OrderItem[];
  observations: string | null;
}

interface PedidoTrackingProps {
  initialOrder: Order;
}

export default function PedidoTracking({ initialOrder }: PedidoTrackingProps) {
  const [order, setOrder] = useState<Order>(initialOrder);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Establish Server-Sent Events (SSE) connection to track this specific order
    const eventSource = new EventSource(`/api/orders/${initialOrder.id}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.order) {
          setOrder(data.order);
        }
      } catch (err) {
        console.error('Erro ao decodificar atualização do pedido:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn('Erro na conexão SSE de rastreamento:', err);
      // EventSource handles automatic reconnect
    };

    return () => {
      eventSource.close();
    };
  }, [initialOrder.id]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getStatusIndex = (status: string) => {
    switch (status) {
      case 'NOVO': return 0;
      case 'PREPARO': return 1;
      case 'PRONTO': return 2;
      case 'ENTREGUE': return 3;
      default: return -1;
    }
  };

  const currentStep = getStatusIndex(order.status);
  const isCancelled = order.status === 'CANCELADO';
  const isDelivery = order.deliveryType === 'ENTREGA';

  // Define steps
  const steps = [
    {
      title: 'Pedido Recebido',
      desc: 'Seu pedido foi registrado e está na fila da cozinha.',
      icon: <ClipboardList size={22} />,
    },
    {
      title: 'Na Cozinha',
      desc: 'Seus salgados e doces estão sendo preparados na hora.',
      icon: <Flame size={22} />,
    },
    {
      title: isDelivery ? 'Saiu para Entrega' : 'Pronto para Retirada',
      desc: isDelivery 
        ? 'O entregador já coletou seu pedido e está a caminho!' 
        : 'Seu pedido já está embalado e aguardando você no balcão.',
      icon: isDelivery ? <Truck size={22} /> : <ShoppingBag size={22} />,
    },
    {
      title: 'Entregue',
      desc: 'Pedido finalizado. Aproveite seus salgados Modelo!',
      icon: <CheckCircle size={22} />,
    },
  ];

  if (!mounted) {
    return (
      <div className={styles.container}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Clock className="animate-spin" size={24} style={{ color: 'var(--primary)', margin: '0 auto 16px auto' }} />
          <p>Carregando rastreamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Acompanhar Pedido</h1>
        <Link href="/" className={styles.backBtn}>
          <ChevronLeft size={16} /> Ver Cardápio
        </Link>
      </div>

      {/* Rastreamento Stepper */}
      {isCancelled ? (
        <div className={styles.cancelledCard}>
          <XCircle size={48} style={{ color: 'var(--danger)' }} />
          <h2 className={styles.cancelledTitle}>Pedido Cancelado</h2>
          <p style={{ color: 'var(--secondary)', fontSize: '0.95rem' }}>
            Desculpe-nos, mas este pedido foi cancelado pelo estabelecimento. 
            Entre em contato ou faça um novo pedido no cardápio.
          </p>
        </div>
      ) : (
        <div className={styles.stepper}>
          {steps.map((step, idx) => {
            const isActive = idx === currentStep;
            const isCompleted = idx < currentStep;
            
            let stepClass = '';
            if (isActive) stepClass = styles.stepActive;
            else if (isCompleted) stepClass = styles.stepCompleted;

            return (
              <div key={idx} className={`${styles.stepRow} ${stepClass}`}>
                <div className={styles.stepIconContainer}>
                  {step.icon}
                </div>
                <div className={styles.stepLine} />
                <div className={styles.stepContent}>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepDesc}>{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resumo do Pedido */}
      <div className={styles.detailsCard}>
        <h2 className={styles.detailsTitle}>Detalhes do Pedido</h2>
        
        <div className={styles.detailsRow}>
          <span className={styles.detailsLabel}>Cliente</span>
          <span className={styles.detailsValue}>{order.customerName}</span>
        </div>

        <div className={styles.detailsRow}>
          <span className={styles.detailsLabel}>Telefone</span>
          <span className={styles.detailsValue}>{order.customerPhone}</span>
        </div>

        <div className={styles.detailsRow}>
          <span className={styles.detailsLabel}>Serviço</span>
          <span className={styles.detailsValue}>
            {isDelivery ? '🏍️ Entrega em Casa' : '🛍️ Retirada na Loja'}
          </span>
        </div>

        {isDelivery && order.deliveryAddress && (
          <div className={styles.detailsRow} style={{ flexDirection: 'column', gap: '4px' }}>
            <span className={styles.detailsLabel}>Endereço de Entrega</span>
            <span className={styles.detailsValue} style={{ fontSize: '0.88rem', fontWeight: 'normal', color: 'var(--secondary)' }}>
              {order.deliveryAddress}
            </span>
          </div>
        )}

        {order.observations && (
          <div className={styles.detailsRow} style={{ flexDirection: 'column', gap: '4px' }}>
            <span className={styles.detailsLabel}>Observações</span>
            <span className={styles.detailsValue} style={{ fontSize: '0.88rem', fontWeight: 'normal', color: 'var(--accent)' }}>
              {order.observations}
            </span>
          </div>
        )}

        <div className={styles.detailsRow}>
          <span className={styles.detailsLabel}>Código do Pedido</span>
          <span className={styles.detailsValue} style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--muted)' }}>
            {order.id}
          </span>
        </div>

        <div className={styles.itemsList}>
          {order.items.map((item) => (
            <div key={item.id} style={{ display: 'flex', flexDirection: 'column', padding: '6px 0', borderBottom: '1px dashed rgba(255, 255, 255, 0.05)' }}>
              <div className={styles.itemRow} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                <span className={styles.itemName} style={{ color: 'var(--foreground)' }}>
                  {item.quantity}x {item.product?.name || 'Item do Cardápio'}
                </span>
                <span className={styles.itemQtyPrice} style={{ color: 'var(--secondary)' }}>
                  {formatCurrency(item.unitPrice * item.quantity)}
                </span>
              </div>
              {item.selectedFlavors && (
                <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '2px', paddingLeft: '14px' }}>
                  🍕 <strong>Sabores:</strong> {item.selectedFlavors}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className={styles.divider} />

        {isDelivery && (
          <div className={styles.detailsRow}>
            <span className={styles.detailsLabel}>Taxa de Entrega</span>
            <span className={styles.detailsValue}>{formatCurrency(order.deliveryFee)}</span>
          </div>
        )}

        <div className={styles.totalRow}>
          <span>Total do Pedido</span>
          <span className={styles.totalValue}>{formatCurrency(order.total)}</span>
        </div>
      </div>
    </div>
  );
}
