import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized } from '@/lib/api';

const schema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android']).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const { token, platform } = parsed.data;

  await prisma.pushToken.upsert({
    where: { token },
    create: { token, userId: session.id, platform },
    update: { userId: session.id, platform },
  });

  return ok({ success: true });
}
