'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ClipboardList, 
  Utensils, 
  Tags, 
  LogOut, 
  Lock, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  Loader2,
  PackageCheck
} from 'lucide-react';
import styles from './AdminDashboard.module.css';

// Types directly matching our database models
interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  stockQuantity: number;
  active: boolean;
  categoryId: string;
  category?: Category;
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
  status: string; // 'NOVO' | 'PREPARO' | 'PRONTO' | 'ENTREGUE' | 'CANCELADO'
  total: number;
  createdAt: string;
  items: OrderItem[];
  observations: string | null;
}

// Helper para tocar som de notificação (campainha de sino sintetizada) via Web Audio API
const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Nota 1 (Ding)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // Nota 2 (Dong)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(440, now + 0.12); // A4
    gain2.gain.setValueAtTime(0.08, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch (e) {
    console.warn('Erro ao reproduzir som de notificação:', e);
  }
};

// Helper para exibir notificação desktop do sistema
const showDesktopNotification = (order: any) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    const serviceType = order.deliveryType === 'ENTREGA' ? 'Entrega 🏍️' : 'Retirada 🛍️';
    
    new Notification('🔔 Novo Pedido Recebido!', {
      body: `Cliente: ${order.customerName}\nTipo: ${serviceType}\nTotal: R$ ${order.total.toFixed(2)}`,
      tag: order.id,
      requireInteraction: true
    });
  }
};

interface AdminDashboardProps {
  isLoggedIn: boolean;
  initialProducts: Product[];
  initialCategories: Category[];
  initialOrders: Order[];
}

export default function AdminDashboard({
  isLoggedIn: initialIsLoggedIn,
  initialProducts,
  initialCategories,
  initialOrders,
}: AdminDashboardProps) {
  const router = useRouter();
  
  // Dashboard Auth and State
  const [isLoggedIn, setIsLoggedIn] = useState(initialIsLoggedIn);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'categories'>('orders');

  // DB States
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  // Modal Product State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    stockQuantity: '',
    active: true,
    categoryId: '',
  });
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImageName, setProductImageName] = useState('');
  const [productModalError, setProductModalError] = useState('');
  const [productModalSaving, setProductModalSaving] = useState(false);

  // Modal Category State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    icon: '',
  });
  const [categoryModalError, setCategoryModalError] = useState('');
  const [categoryModalSaving, setCategoryModalSaving] = useState(false);

  // Action states for table/order rows
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Sync state if props change (when routing refreshes)
  useEffect(() => {
    setIsLoggedIn(initialIsLoggedIn);
    setProducts(initialProducts);
    setCategories(initialCategories);
    setOrders(initialOrders);
  }, [initialIsLoggedIn, initialProducts, initialCategories, initialOrders]);

  // Request desktop notification permission on login/mount
  useEffect(() => {
    if (isLoggedIn && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [isLoggedIn]);

  // Server-Sent Events (SSE) for Realtime Fila de Pedidos
  useEffect(() => {
    if (!isLoggedIn) return;

    // Connect to SSE stream
    const eventSource = new EventSource('/api/admin/orders/stream');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'orderCreated') {
          // Prepend new orders
          setOrders((prev) => [data.order, ...prev]);
          
          // Toca som de notificação e mostra push desktop
          playNotificationSound();
          showDesktopNotification(data.order);
        } else if (data.type === 'orderUpdated') {
          // Update order status in place
          setOrders((prev) =>
            prev.map((o) => (o.id === data.order.id ? data.order : o))
          );
        }
      } catch (err) {
        console.error('Erro ao ler dados do SSE:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn('Conexão SSE perdida ou reiniciada pelo servidor (reconectando automaticamente)...');
    };

    return () => {
      eventSource.close();
    };
  }, [isLoggedIn]);

  // Login Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoginLoading(true);
    setLoginError('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao realizar login.');
      }

      setIsLoggedIn(true);
      router.refresh(); // Refresh page to trigger server component prefetch
    } catch (err: any) {
      setLoginError(err.message || 'Senha incorreta.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      setIsLoggedIn(false);
      router.refresh();
    } catch (err) {
      console.error('Erro ao fazer logout:', err);
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Format date
  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' - ' + d.toLocaleDateString('pt-BR');
  };

  // Order Status update handler
  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    setActionLoadingId(orderId);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar status.');
      }

      // Update state locally
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar pedido.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Category Save Handler
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) return;

    setCategoryModalSaving(true);
    setCategoryModalError('');

    try {
      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryForm),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar categoria.');
      }

      setCategories((prev) => [...prev, data]);
      setIsCategoryModalOpen(false);
      setCategoryForm({ name: '', icon: '' });
    } catch (err: any) {
      setCategoryModalError(err.message);
    } finally {
      setCategoryModalSaving(false);
    }
  };

  // Category Delete Handler
  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta categoria?')) return;

    setActionLoadingId(id);
    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao excluir.');
      }

      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err.message || 'Erro de conexão.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Product Modal
  const openProductModal = (product: Product | null = null) => {
    setEditingProduct(product);
    setProductImageFile(null);
    setProductImageName('');
    setProductModalError('');
    
    if (product) {
      setProductForm({
        name: product.name,
        description: product.description || '',
        price: product.price.toString(),
        stockQuantity: product.stockQuantity.toString(),
        active: product.active,
        categoryId: product.categoryId,
      });
      setProductImageName(product.imageUrl ? 'Imagem existente cadastrada' : '');
    } else {
      setProductForm({
        name: '',
        description: '',
        price: '',
        stockQuantity: '0',
        active: true,
        categoryId: categories[0]?.id || '',
      });
    }
    setIsProductModalOpen(true);
  };

  // Product Image Select Handler
  const handleProductImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProductImageFile(file);
      setProductImageName(file.name);
    }
  };

  // Product Save Handler
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { name, price, categoryId, stockQuantity } = productForm;
    if (!name.trim() || !price || !categoryId) {
      setProductModalError('Preencha os campos obrigatórios.');
      return;
    }

    setProductModalSaving(true);
    setProductModalError('');

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', productForm.description);
      formData.append('price', price);
      formData.append('stockQuantity', stockQuantity);
      formData.append('active', productForm.active.toString());
      formData.append('categoryId', categoryId);
      
      if (productImageFile) {
        formData.append('image', productImageFile);
      }

      const url = editingProduct 
        ? `/api/admin/products/${editingProduct.id}` 
        : '/api/admin/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        body: formData, // Automatically sets correct multipart header
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar produto.');
      }

      if (editingProduct) {
        setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? data : p)));
      } else {
        setProducts((prev) => [...prev, data]);
      }

      setIsProductModalOpen(false);
    } catch (err: any) {
      setProductModalError(err.message || 'Erro ao conectar ao servidor.');
    } finally {
      setProductModalSaving(false);
    }
  };

  // Product Delete Handler
  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Excluir este produto? Caso ele tenha histórico de vendas, ele será desativado em vez de deletado.')) return;

    setActionLoadingId(id);
    try {
      const response = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao excluir.');
      }

      if (data.deactivated) {
        alert(data.message);
        setProducts((prev) => prev.map((p) => p.id === id ? { ...p, active: false } : p));
      } else {
        setProducts((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (err: any) {
      alert(err.message || 'Erro de conexão.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Login render
  if (!isLoggedIn) {
    return (
      <div className={styles.loginContainer}>
        <form onSubmit={handleLogin} className={styles.loginCard}>
          <h1 className={styles.loginTitle}>
            <Lock style={{ color: 'var(--primary)' }} />
            Acesso Restrito
          </h1>
          <p className={styles.loginSubtitle}>Painel do Administrador</p>
          
          <div className={styles.loginForm}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--secondary)' }}>
                Senha de Acesso
              </label>
              <input
                type="password"
                placeholder="Insira a senha do admin"
                className={styles.loginInput}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'var(--secondary-bg)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--foreground)',
                }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {loginError && (
              <div style={{ color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600 }}>
                ⚠️ {loginError}
              </div>
            )}

            <button type="submit" className={styles.loginBtn} disabled={loginLoading}>
              {loginLoading ? 'Carregando...' : 'Entrar no Painel'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Group orders for display and sort active orders oldest first (FIFO priority)
  const activeOrders = orders
    .filter((o) => o.status !== 'ENTREGUE' && o.status !== 'CANCELADO')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Sort past orders newest first (descending history)
  const pastOrders = orders
    .filter((o) => o.status === 'ENTREGUE' || o.status === 'CANCELADO')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className={styles.container}>
      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navBrand}>
          <PackageCheck style={{ color: 'var(--primary)' }} size={28} />
          <span>Modelo Admin</span>
        </div>

        <div className={styles.navTabs}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'orders' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <ClipboardList size={18} /> Pedidos
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'products' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <Utensils size={18} /> Produtos
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'categories' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            <Tags size={18} /> Categorias
          </button>
        </div>

        <button className={styles.logoutBtn} onClick={handleLogout}>
          <LogOut size={16} /> Sair
        </button>
      </nav>

      {/* ORDERS TAB */}
      {activeTab === 'orders' && (
        <div className={styles.ordersSection}>
          <div className={styles.tabHeader}>
            <h2 className={styles.tabTitle}>Fila de Pedidos (Tempo Real)</h2>
            <span style={{ color: 'var(--secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
              {activeOrders.length} pedidos em andamento
            </span>
          </div>

          {activeOrders.length === 0 ? (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '48px', textAlign: 'center', borderRadius: 'var(--radius-lg)', color: 'var(--secondary)' }}>
              📭 Nenhum pedido pendente no momento. 
              Novos pedidos feitos no cardápio aparecerão aqui automaticamente.
            </div>
          ) : (
            <div className={styles.ordersGrid}>
              {activeOrders.map((order, index) => {
                const isActionLoading = actionLoadingId === order.id;

                // Calculate elapsed wait time in minutes
                const minutesWaiting = Math.max(0, Math.floor((new Date().getTime() - new Date(order.createdAt).getTime()) / 60000));

                return (
                  <div key={order.id} className={styles.orderCard}>
                    <div className={styles.orderHeader}>
                      <span className={styles.orderNumber}>
                        📦 {order.customerName}
                      </span>
                      <span className={styles.orderTime}>{formatDate(order.createdAt)}</span>
                    </div>

                    <div className={styles.priorityBar}>
                      <span className={`${styles.priorityText} ${index === 0 ? styles.priorityUrgent : ''}`}>
                        {index === 0 ? '⚠️ 1º da Fila (Preparar)' : `${index + 1}º da Fila`}
                      </span>
                      <span className={styles.waitText}>
                        ⌛ {minutesWaiting === 0 ? 'Novo' : `Aguardando há ${minutesWaiting} min`}
                      </span>
                    </div>

                    <div className={styles.orderBody}>
                      <div className={styles.orderInfoLine}>
                        <strong>Serviço:</strong> {order.deliveryType === 'ENTREGA' ? '🏍️ Entrega em Casa' : '🛍️ Retirada na Loja'}
                      </div>
                      <div className={styles.orderInfoLine} style={{ marginTop: '2px' }}>
                        <strong>Telefone:</strong> {order.customerPhone}
                      </div>
                      {order.deliveryType === 'ENTREGA' && order.deliveryAddress && (
                        <div className={styles.orderInfoLine} style={{ marginTop: '4px' }}>
                          <strong>Endereço:</strong> {order.deliveryAddress}
                        </div>
                      )}

                      {order.observations && (
                        <div className={styles.orderInfoLine} style={{ marginTop: '6px', padding: '6px', background: 'rgba(249, 115, 22, 0.1)', borderLeft: '2px solid var(--primary)', borderRadius: '4px' }}>
                          <strong>Obs:</strong> {order.observations}
                        </div>
                      )}

                      <div className={styles.orderItemsList}>
                        {order.items.map((item) => (
                          <div key={item.id} className={styles.orderItemBlock}>
                            <div className={styles.orderItemRow}>
                              <span className={styles.orderItemName}>
                                {item.quantity}x {item.product?.name || 'Item Excluído'}
                              </span>
                              <span className={styles.orderItemQtyPrice}>
                                {formatCurrency(item.unitPrice * item.quantity)}
                              </span>
                            </div>
                            {item.selectedFlavors && (
                              <div className={styles.orderItemFlavors}>
                                🍕 <strong>Sabores:</strong> {item.selectedFlavors}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={styles.orderFooter}>
                      <div className={styles.orderTotalRow}>
                        <span>Total:</span>
                        <span style={{ color: 'var(--accent)' }}>{formatCurrency(order.total)}</span>
                      </div>
                      {order.deliveryFee > 0 && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--secondary)', textAlign: 'right', marginTop: '-8px' }}>
                          (Inclui taxa de {formatCurrency(order.deliveryFee)})
                        </span>
                      )}

                      <div className={styles.orderActions}>
                        {order.status === 'NOVO' && (
                          <button
                            className={`${styles.orderBtn} ${styles.orderBtnPrimary}`}
                            onClick={() => handleUpdateOrderStatus(order.id, 'PREPARO')}
                            disabled={isActionLoading}
                          >
                            {isActionLoading ? '...' : 'Iniciar Preparo 🍳'}
                          </button>
                        )}

                        {order.status === 'PREPARO' && (
                          <button
                            className={`${styles.orderBtn} ${styles.orderBtnPrimary}`}
                            style={{ background: 'var(--success)' }}
                            onClick={() => handleUpdateOrderStatus(order.id, 'PRONTO')}
                            disabled={isActionLoading}
                          >
                            {isActionLoading ? '...' : 'Pronto para Servir ✅'}
                          </button>
                        )}

                        {order.status === 'PRONTO' && (
                          <button
                            className={`${styles.orderBtn} ${styles.orderBtnPrimary}`}
                            style={{ background: 'var(--secondary)' }}
                            onClick={() => handleUpdateOrderStatus(order.id, 'ENTREGUE')}
                            disabled={isActionLoading}
                          >
                            {isActionLoading ? '...' : 'Entregar/Finalizar 🏁'}
                          </button>
                        )}

                        <button
                          className={`${styles.orderBtn} ${styles.orderBtnDanger}`}
                          onClick={() => {
                            if (confirm('Cancelar este pedido?')) {
                              handleUpdateOrderStatus(order.id, 'CANCELADO');
                            }
                          }}
                          disabled={isActionLoading}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Historical orders */}
          {pastOrders.length > 0 && (
            <div style={{ marginTop: '40px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '16px', color: 'var(--secondary)' }}>
                Histórico Recente (Entregues/Cancelados)
              </h3>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Serviço / Endereço</th>
                      <th>Hora</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastOrders.slice(0, 10).map((order) => (
                      <tr key={order.id} className={styles.tableRow}>
                        <td style={{ fontWeight: 600 }}>
                          {order.customerName}
                          <div style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--muted)', marginTop: '2px' }}>
                            Tel: {order.customerPhone}
                          </div>
                          {order.observations && (
                            <div style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--accent)', marginTop: '4px' }}>
                              Obs: {order.observations}
                            </div>
                          )}
                        </td>
                        <td>{order.deliveryType === 'ENTREGA' ? `Entrega: ${order.deliveryAddress || ''}` : 'Retirada na Loja'}</td>
                        <td>{formatDate(order.createdAt)}</td>
                        <td style={{ color: 'var(--accent)', fontWeight: 700 }}>{formatCurrency(order.total)}</td>
                        <td>
                          <span className={`${styles.statusBadge} ${order.status === 'ENTREGUE' ? styles.statusBadgeDelivered : styles.statusBadgeDanger}`}>
                            {order.status === 'ENTREGUE' ? 'ENTREGUE' : 'CANCELADO'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PRODUCTS TAB */}
      {activeTab === 'products' && (
        <div>
          <div className={styles.tabHeader}>
            <h2 className={styles.tabTitle}>Gerenciamento de Produtos</h2>
            <button className={styles.actionBtn} onClick={() => openProductModal(null)}>
              <Plus size={16} /> Adicionar Produto
            </button>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Foto</th>
                  <th>Nome</th>
                  <th>Categoria</th>
                  <th>Preço</th>
                  <th>Estoque</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--secondary)' }}>
                      Nenhum produto cadastrado.
                    </td>
                  </tr>
                ) : (
                  products.map((product) => {
                    const isActionLoading = actionLoadingId === product.id;

                    return (
                      <tr key={product.id} className={styles.tableRow}>
                        <td>
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className={styles.cellImage} />
                          ) : (
                            <div className={styles.cellImage} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              🍔
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{product.name}</div>
                          <div className={styles.cellTextMuted}>{product.description}</div>
                        </td>
                        <td>{product.category?.name || 'Sem categoria'}</td>
                        <td style={{ fontWeight: 700 }}>{formatCurrency(product.price)}</td>
                        <td>
                          <span style={{ color: product.stockQuantity <= 5 ? 'var(--danger)' : 'inherit', fontWeight: product.stockQuantity <= 5 ? 700 : 'normal' }}>
                            {product.stockQuantity} un
                          </span>
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${product.active ? styles.statusBadgeReady : styles.statusBadgeDelivered}`}>
                            {product.active ? 'ATIVO' : 'INATIVO'}
                          </span>
                        </td>
                        <td>
                          <div className={styles.tableActionBtns}>
                            <button className={styles.iconActionBtn} onClick={() => openProductModal(product)} aria-label="Editar">
                              <Edit2 size={16} />
                            </button>
                            <button 
                              className={`${styles.iconActionBtn} ${styles.iconActionBtnDanger}`} 
                              onClick={() => handleDeleteProduct(product.id)}
                              disabled={isActionLoading}
                              aria-label="Deletar"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CATEGORIES TAB */}
      {activeTab === 'categories' && (
        <div>
          <div className={styles.tabHeader}>
            <h2 className={styles.tabTitle}>Gerenciamento de Categorias</h2>
            <button className={styles.actionBtn} onClick={() => setIsCategoryModalOpen(true)}>
              <Plus size={16} /> Adicionar Categoria
            </button>
          </div>

          <div className={styles.tableContainer} style={{ maxWidth: '600px' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Ícone</th>
                  <th>Nome</th>
                  <th style={{ width: '120px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--secondary)' }}>
                      Nenhuma categoria cadastrada.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => {
                    const isActionLoading = actionLoadingId === cat.id;

                    return (
                      <tr key={cat.id} className={styles.tableRow}>
                        <td style={{ fontSize: '1.5rem', textAlign: 'center' }}>{cat.icon || '📌'}</td>
                        <td style={{ fontWeight: 600 }}>{cat.name}</td>
                        <td>
                          <button 
                            className={`${styles.iconActionBtn} ${styles.iconActionBtnDanger}`}
                            onClick={() => handleDeleteCategory(cat.id)}
                            disabled={isActionLoading}
                            aria-label="Deletar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRODUCT EDITOR MODAL */}
      {isProductModalOpen && (
        <div className={styles.modalOverlay}>
          <form onSubmit={handleSaveProduct} className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </h3>
              <button type="button" className={styles.closeBtn} onClick={() => setIsProductModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nome do Produto *</label>
                <input
                  type="text"
                  placeholder="Ex: X-Salada Master"
                  className={styles.formInput}
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Descrição</label>
                <textarea
                  placeholder="Descrição dos ingredientes..."
                  className={styles.formInput}
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Preço (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="22.90"
                    className={styles.formInput}
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Estoque Inicial *</label>
                  <input
                    type="number"
                    placeholder="20"
                    className={styles.formInput}
                    value={productForm.stockQuantity}
                    onChange={(e) => setProductForm({ ...productForm, stockQuantity: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Categoria *</label>
                  <select
                    className={styles.formInput}
                    style={{ background: 'var(--secondary-bg)' }}
                    value={productForm.categoryId}
                    onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup} style={{ justifyContent: 'center' }}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkboxInput}
                      checked={productForm.active}
                      onChange={(e) => setProductForm({ ...productForm, active: e.target.checked })}
                    />
                    Produto Ativo no Cardápio
                  </label>
                </div>
              </div>

              <div className={styles.fileInputWrapper}>
                <label className={styles.formLabel}>Foto do Produto</label>
                <label className={styles.fileInputBtn}>
                  📷 Escolher Foto
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleProductImageChange}
                  />
                </label>
                {productImageName && (
                  <span className={styles.fileSelectedText}>{productImageName}</span>
                )}
              </div>

              {productModalError && (
                <div style={{ color: 'var(--danger)', fontSize: '0.88rem', fontWeight: 600 }}>
                  ⚠️ {productModalError}
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className={styles.orderBtn} style={{ background: 'transparent', color: 'var(--foreground)' }} onClick={() => setIsProductModalOpen(false)}>
                Cancelar
              </button>
              <button type="submit" className={styles.actionBtn} style={{ padding: '8px 16px' }} disabled={productModalSaving}>
                {productModalSaving ? <Loader2 className="animate-spin" size={16} /> : 'Salvar Produto'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CATEGORY ADD MODAL */}
      {isCategoryModalOpen && (
        <div className={styles.modalOverlay}>
          <form onSubmit={handleSaveCategory} className={styles.modal} style={{ maxWidth: '400px' }}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Nova Categoria</h3>
              <button type="button" className={styles.closeBtn} onClick={() => setIsCategoryModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nome da Categoria *</label>
                <input
                  type="text"
                  placeholder="Ex: Hambúrgueres, Bebidas"
                  className={styles.formInput}
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Emoji do Ícone (Ex: 🍔, 🥤)</label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="Ex: 🍔"
                  className={styles.formInput}
                  value={categoryForm.icon}
                  onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                />
              </div>

              {categoryModalError && (
                <div style={{ color: 'var(--danger)', fontSize: '0.88rem', fontWeight: 600 }}>
                  ⚠️ {categoryModalError}
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className={styles.orderBtn} style={{ background: 'transparent', color: 'var(--foreground)' }} onClick={() => setIsCategoryModalOpen(false)}>
                Cancelar
              </button>
              <button type="submit" className={styles.actionBtn} style={{ padding: '8px 16px' }} disabled={categoryModalSaving}>
                {categoryModalSaving ? 'Salvando...' : 'Salvar Categoria'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
