import { cookies } from 'next/headers';
import crypto from 'crypto';

export interface UserSession {
  role: 'admin';
  createdAt: number;
}

const COOKIE_NAME = 'lanchonete_admin_session';

// Fallback token secret for dev environments
const SESSION_SECRET = process.env.JWT_SECRET || 'dev-lanchonete-session-secret-key-123456789!';

function signToken(data: string): string {
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(data);
  return hmac.digest('hex');
}

function verifyToken(data: string, signature: string): boolean {
  try {
    const expected = signToken(data);
    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(signature);
    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  } catch {
    return false;
  }
}

export class LocalAuthService {
  async login(password: string): Promise<{ success: boolean; error?: string }> {
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (password !== adminPassword) {
      return { success: false, error: 'Senha incorreta' };
    }

    const timestamp = Date.now();
    const payload = `admin:${timestamp}`;
    const signature = signToken(payload);
    const token = `${payload}:${signature}`;

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/',
    });

    return { success: true };
  }

  async logout(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
  }

  async verifySession(): Promise<UserSession | null> {
    try {
      const cookieStore = await cookies();
      const cookie = cookieStore.get(COOKIE_NAME);
      if (!cookie || !cookie.value) return null;

      const parts = cookie.value.split(':');
      if (parts.length !== 3) return null;

      const [role, timestampStr, signature] = parts;
      if (role !== 'admin') return null;

      const timestamp = parseInt(timestampStr, 10);
      const payload = `${role}:${timestampStr}`;

      if (!verifyToken(payload, signature)) return null;

      // Session expires in 24 hours
      const now = Date.now();
      if (now - timestamp > 1000 * 60 * 60 * 24) return null;

      return { role: 'admin', createdAt: timestamp };
    } catch {
      return null;
    }
  }
}

export const authService = new LocalAuthService();
export type IAuthService = LocalAuthService;
