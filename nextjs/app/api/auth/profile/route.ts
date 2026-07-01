import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession, signToken, setTokenCookie } from '@/lib/auth';
import { ok, err, unauthorized } from '@/lib/api';

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const updated = await prisma.user.update({
    where: { id: session.id },
    data: parsed.data,
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  const token = signToken(updated);
  const res = NextResponse.json({ user: updated });
  res.headers.set('Set-Cookie', setTokenCookie(token)['Set-Cookie']);
  return res;
}
