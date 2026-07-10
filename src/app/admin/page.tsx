import { authService } from '@/services/auth';
import prisma from '@/lib/prisma';
import AdminDashboard from './AdminDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await authService.verifySession();
  const isLoggedIn = !!session;

  // Pre-fetch data if logged in
  let initialProducts: any[] = [];
  let initialCategories: any[] = [];
  let initialOrders: any[] = [];

  if (isLoggedIn) {
    try {
      initialProducts = await prisma.product.findMany({
        include: { category: true },
        orderBy: { name: 'asc' },
      });
      initialCategories = await prisma.category.findMany({
        orderBy: { name: 'asc' },
      });
      initialOrders = await prisma.order.findMany({
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      console.error('Erro ao pre-carregar dados no painel admin:', error);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
      <AdminDashboard
        isLoggedIn={isLoggedIn}
        initialProducts={initialProducts}
        initialCategories={initialCategories}
        initialOrders={initialOrders}
      />
    </main>
  );
}
