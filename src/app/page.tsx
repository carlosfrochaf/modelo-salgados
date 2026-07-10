import prisma from '@/lib/prisma';
import MenuCardapio from './MenuCardapio';

export const dynamic = 'force-dynamic';

export default async function Home() {
  // Fetch categories and active products to pass to the client component
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
  });

  const products = await prisma.product.findMany({
    where: {
      active: true,
    },
    orderBy: { name: 'asc' },
  });

  const storeLatitude = process.env.STORE_LATITUDE ? parseFloat(process.env.STORE_LATITUDE) : -19.9320;
  const storeLongitude = process.env.STORE_LONGITUDE ? parseFloat(process.env.STORE_LONGITUDE) : -44.0530;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <MenuCardapio 
        initialCategories={categories} 
        initialProducts={products} 
        storeLatitude={storeLatitude}
        storeLongitude={storeLongitude}
      />
    </main>
  );
}
