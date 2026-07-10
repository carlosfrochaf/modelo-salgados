import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authService } from '@/services/auth';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authService.verifySession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
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

    // Find existing product to get current imageUrl
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 444 });
    }

    let imageUrl = existingProduct.imageUrl;

    // Process new image upload if provided
    if (image && typeof image === 'object' && image.size > 0) {
      const bytes = await image.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const ext = path.extname(image.name) || '.jpg';
      const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      const filePath = path.join(uploadDir, filename);

      await writeFile(filePath, buffer);
      imageUrl = `/uploads/${filename}`;

      // Optional: Delete old image from disk if it was a local upload
      if (existingProduct.imageUrl && existingProduct.imageUrl.startsWith('/uploads/')) {
        try {
          const oldFilePath = path.join(process.cwd(), 'public', existingProduct.imageUrl);
          await unlink(oldFilePath);
        } catch (err) {
          console.warn('Erro ao deletar imagem antiga:', err);
        }
      }
    }

    const product = await prisma.product.update({
      where: { id },
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
    console.error('Erro ao atualizar produto:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authService.verifySession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    // Check if product is in order items
    const orderItemsCount = await prisma.orderItem.count({
      where: { productId: id },
    });

    if (orderItemsCount > 0) {
      // Rather than deleting, we deactivate the product to preserve integrity
      await prisma.product.update({
        where: { id },
        data: { active: false },
      });
      return NextResponse.json({ 
        success: true, 
        deactivated: true,
        message: 'O produto está associado a pedidos existentes e foi desativado em vez de excluído.' 
      });
    }

    // Find product to check image
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (product) {
      // Delete local image if exists
      if (product.imageUrl && product.imageUrl.startsWith('/uploads/')) {
        try {
          const filePath = path.join(process.cwd(), 'public', product.imageUrl);
          await unlink(filePath);
        } catch (err) {
          console.warn('Erro ao deletar imagem:', err);
        }
      }

      await prisma.product.delete({
        where: { id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar produto:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
