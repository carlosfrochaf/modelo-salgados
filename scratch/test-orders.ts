import prisma from '../src/lib/prisma';

async function test() {
  try {
    const orders = await prisma.order.findMany({
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });
    console.log('--- PEDIDOS NO BANCO ---');
    console.log(JSON.stringify(orders, null, 2));
  } catch (err) {
    console.error('Erro ao consultar banco:', err);
  }
}

test();
