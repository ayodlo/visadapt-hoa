import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, err, unauthorized, forbidden } from '@/lib/api';

const schema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { id: true, firstName: true, lastName: true } } },
  });
  return ok(announcements);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const announcement = await prisma.announcement.create({
    data: { ...parsed.data, authorId: session.id },
    include: { author: { select: { id: true, firstName: true, lastName: true } } },
  });
  return ok(announcement, 201);
}
