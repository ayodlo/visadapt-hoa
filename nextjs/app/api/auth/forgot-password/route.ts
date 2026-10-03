import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import { ok, err } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { isDemoAccount } from '@/lib/demo';

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'forgot-password', 5, 15 * 60 * 1000);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err('Invalid email', 400);

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  // Demo logins are shared and their password is public; a reset would lock every
  // other visitor out. Same response either way so this reveals nothing.
  if (user && !isDemoAccount(user.id)) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } });
    await sendPasswordResetEmail(user.email, user.firstName, token).catch(() => {});
  }

  return ok({ message: 'If that email exists you will receive a reset link.' });
}
