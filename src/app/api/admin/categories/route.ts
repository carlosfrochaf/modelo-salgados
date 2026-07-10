import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authService } from '@/services/auth';

export async function GET() {
  try {
    const session = await authService.verifySession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Erro ao listar categorias no admin:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await authService.verifySession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { name, icon } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'O nome da categoria é obrigatório' }, { status: 400 });
    }

    const category = await prisma.category.create({
      data: {
        name,
        icon: icon || null,
      },
    });

    return NextResponse.json(category);
  } catch (error: any) {
    console.error('Erro ao criar categoria:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Já existe uma categoria com este nome.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
