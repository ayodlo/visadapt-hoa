import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { signToken, setTokenCookie } from '@/lib/auth';
import { err } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'register', 10, 60 * 60 * 1000);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const { firstName, lastName, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return err('Email already in use', 409);

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { firstName, lastName, email, passwordHash, role: 'RESIDENT' },
  });

  const token = signToken({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  });

  const res = NextResponse.json(
    {
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
      token,
    },
    { status: 201 }
  );
  const cookieHeader = setTokenCookie(token);
  res.headers.set('Set-Cookie', cookieHeader['Set-Cookie']);
  return res;
}
