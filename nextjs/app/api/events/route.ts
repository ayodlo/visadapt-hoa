import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, err, unauthorized, forbidden } from '@/lib/api';

const schema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const events = await prisma.event.findMany({
    orderBy: { startAt: 'asc' },
    include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
  });
  return ok(events);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const event = await prisma.event.create({
    data: { ...parsed.data, createdById: session.id },
    include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
  });
  return ok(event, 201);
}
