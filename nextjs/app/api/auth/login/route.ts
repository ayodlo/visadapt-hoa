import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { signToken, setTokenCookie } from '@/lib/auth';
import { err } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'login', 20, 15 * 60 * 1000);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err('Invalid request', 400);

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return err('Invalid email or password', 401);

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return err('Invalid email or password', 401);

  const token = signToken({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    communityId: user.communityId,
  });

  const res = NextResponse.json({
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, communityId: user.communityId },
    token,
  });
  const cookieHeader = setTokenCookie(token);
  res.headers.set('Set-Cookie', cookieHeader['Set-Cookie']);
  return res;
}
