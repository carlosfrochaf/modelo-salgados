import { NextResponse } from 'next/server';
import { authService } from '@/services/auth';

export async function POST() {
  try {
    await authService.logout();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro na API de logout admin:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
