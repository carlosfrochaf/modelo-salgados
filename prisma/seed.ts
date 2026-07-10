import prisma from '../src/lib/prisma';

async function main() {
  console.log('Iniciando seed do banco de dados...');

  // Limpar dados existentes (em ordem reversa de dependência)
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});

  console.log('Banco de dados limpo.');

  // 1. Criar Categorias reais de acordo com o cardápio do Modelo Super Salgados
  const fritos = await prisma.category.create({
    data: { name: 'Salgados Fritos', icon: '🔥' },
  });

  const congelados = await prisma.category.create({
    data: { name: 'Salgados Congelados', icon: '❄️' },
  });

  const combosKits = await prisma.category.create({
    data: { name: 'Kits Modelo', icon: '📦' },
  });

  const kitsFesta = await prisma.category.create({
    data: { name: 'Kits Festa', icon: '🎉' },
  });

  console.log('Categorias criadas.');

  // 2. Criar Produtos Reais e Preços
  await prisma.product.createMany({
    data: [
      // Salgados Fritos
      {
        name: '25 Salgados Fritos',
        description: 'Porção com 25 mini salgados fritos na hora. Escolha até 1 sabor tradicional (ex: Coxinha de Frango, Risole de Carne, Bolinha de Mussarela).',
        price: 15.50,
        imageUrl: '/uploads/salgados_fritos.png',
        stockQuantity: 150,
        active: true,
        categoryId: fritos.id,
      },
      {
        name: '50 Salgados Fritos',
        description: 'Porção com 50 mini salgados fritos na hora. Escolha até 2 sabores tradicionais (ex: Coxinha, Risole de Milho com Catupiry, Bolinha de Mussarela, Kibe).',
        price: 31.50,
        imageUrl: '/uploads/salgados_fritos.png',
        stockQuantity: 120,
        active: true,
        categoryId: fritos.id,
      },
      {
        name: '75 Salgados Fritos',
        description: 'Porção com 75 mini salgados fritos na hora. Escolha até 3 sabores tradicionais (ex: Coxinha, Risole de Carne, Enrolado de Salsicha, Empadinha).',
        price: 46.50,
        imageUrl: '/uploads/salgados_fritos.png',
        stockQuantity: 100,
        active: true,
        categoryId: fritos.id,
      },
      {
        name: 'Cento Frito',
        description: 'Cento com 100 mini salgados fritos na hora. Escolha até 4 sabores tradicionais (ex: Coxinha de Frango, Risole de Carne, Bolinha Napolitana, Kibe).',
        price: 56.99,
        imageUrl: '/uploads/salgados_fritos.png',
        stockQuantity: 200,
        active: true,
        categoryId: fritos.id,
      },
      
      // Salgados Congelados
      {
        name: 'Salgados Congelados (Pacote 1kg)',
        description: 'Pacote de 1kg com aproximadamente 50 unidades congeladas dos sabores tradicionais (Coxinha, Risoles, Bolinhas, Kibe, Enrolado). Ideal para fritar em casa.',
        price: 28.90,
        imageUrl: '/uploads/salgados_congelados.png',
        stockQuantity: 80,
        active: true,
        categoryId: congelados.id,
      },

      // Kits Modelo
      {
        name: 'Kit Casal',
        description: '50 salgados p/ festa fritos (até 2 opções de sabores) + 1 Refrigerante de 1 Litro (Mate Couro).',
        price: 34.90,
        imageUrl: '/uploads/combo_salgados_refri.png',
        stockQuantity: 50,
        active: true,
        categoryId: combosKits.id,
      },
      {
        name: 'Kit Família',
        description: '100 salgados p/ festa fritos (até 4 opções de sabores) + 1 Refrigerante de 2 Litros (consulte os sabores disponíveis).',
        price: 64.90,
        imageUrl: '/uploads/combo_salgados_refri.png',
        stockQuantity: 40,
        active: true,
        categoryId: combosKits.id,
      },
      {
        name: 'Kit Super Família',
        description: '200 salgados p/ festa fritos (até 8 opções de sabores) + 2 Refrigerantes de 2 Litros (consulte os sabores disponíveis).',
        price: 124.90,
        imageUrl: '/uploads/combo_salgados_refri.png',
        stockQuantity: 30,
        active: true,
        categoryId: combosKits.id,
      },

      // Kits Festa
      {
        name: 'Kit Festa MINI (Até 7 pessoas)',
        description: '01 Bolo Vulcão delicioso + 50 salgados fritos (até 2 opções de sabores) + 25 docinhos tradicionais de festa + 1 Refrigerante de 2 Litros.',
        price: 98.99,
        imageUrl: '/uploads/kit_festa_completo.png',
        stockQuantity: 20,
        active: true,
        categoryId: kitsFesta.id,
      },
      {
        name: 'Kit Festa MÉDIO (Até 15 pessoas)',
        description: '01 Bolo decorado de 1kg + 125 salgados fritos (até 5 opções de sabores) + 60 docinhos de festa mistos + 1 Refrigerante de 2 Litros.',
        price: 210.90,
        imageUrl: '/uploads/kit_festa_completo.png',
        stockQuantity: 15,
        active: true,
        categoryId: kitsFesta.id,
      },
      {
        name: 'Kit Festa GRANDE (Até 30 pessoas)',
        description: '01 Bolo decorado de 2kg + 250 salgados fritos (até 10 opções de sabores) + 100 docinhos de festa mistos + 2 Refrigerantes de 2 Litros.',
        price: 389.90,
        imageUrl: '/uploads/kit_festa_completo.png',
        stockQuantity: 10,
        active: true,
        categoryId: kitsFesta.id,
      },
    ],
  });

  console.log('Produtos e preços atualizados no seed.');
  console.log('Seed finalizado!');
}

main()
  .catch((e) => {
    console.error('Erro durante o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
