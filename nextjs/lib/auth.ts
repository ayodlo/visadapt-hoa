import jwt from 'jsonwebtoken';
import { cookies, headers } from 'next/headers';
import { prisma } from './prisma';
import type { UserRole } from './roles';

const SECRET = process.env.JWT_SECRET!;
const COOKIE = 'token';

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  // RESIDENT's fixed home community. Null for ADMIN/BOARD_MEMBER (who use
  // CommunityAssignment + the active_community cookie instead) and for
  // SUPER_ADMIN (unrestricted). See lib/community.ts.
  communityId: string | null;
}

export function signToken(payload: SessionUser): string {
  return jwt.sign(payload, SECRET, {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): SessionUser | null {
  try {
    return jwt.verify(token, SECRET) as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  let token = cookieStore.get(COOKIE)?.value;

  if (!token) {
    const headerStore = await headers();
    const authHeader = headerStore.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice('Bearer '.length).trim();
    }
  }

  if (!token) return null;
  return verifyToken(token);
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  return session;
}

export async function requireRole(
  roles: SessionUser['role'][]
): Promise<SessionUser> {
  const session = await requireSession();
  if (!roles.includes(session.role)) throw new Error('Forbidden');
  return session;
}

export function setTokenCookie(token: string): Record<string, string> {
  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = 7 * 24 * 60 * 60;
  return {
    'Set-Cookie': `${COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${isProd ? '; Secure' : ''}`,
  };
}

export function clearTokenCookie(): Record<string, string> {
  return {
    'Set-Cookie': `${COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`,
  };
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
