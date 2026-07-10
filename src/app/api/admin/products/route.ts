import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authService } from '@/services/auth';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const session = await authService.verifySession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const products = await prisma.product.findMany({
      include: {
        category: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error('Erro ao listar produtos no admin:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await authService.verifySession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string | null;
    const priceStr = formData.get('price') as string;
    const stockQuantityStr = formData.get('stockQuantity') as string;
    const activeStr = formData.get('active') as string;
    const categoryId = formData.get('categoryId') as string;
    const image = formData.get('image') as File | null;

    if (!name || !priceStr || !categoryId) {
      return NextResponse.json({ error: 'Dados obrigatórios ausentes.' }, { status: 400 });
    }

    const price = parseFloat(priceStr);
    const stockQuantity = parseInt(stockQuantityStr || '0', 10);
    const active = activeStr === 'true';

    let imageUrl: string | null = null;

    // Process file upload if an image exists
    if (image && typeof image === 'object' && image.size > 0) {
      const bytes = await image.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const ext = path.extname(image.name) || '.jpg';
      const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      const filePath = path.join(uploadDir, filename);

      await writeFile(filePath, buffer);
      imageUrl = `/uploads/${filename}`;
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price,
        stockQuantity,
        active,
        categoryId,
        imageUrl,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
