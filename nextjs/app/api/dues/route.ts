import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { ok, err, unauthorized, forbidden } from '@/lib/api';

const schema = z.object({
  userId: z.string().min(1),
  label: z.string().min(1),
  amountCents: z.number().int().positive(),
  dueDate: z.string().datetime(),
  notes: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const where = session.role === 'RESIDENT' ? { userId: session.id, communityId } : { communityId };
  const records = await prisma.duesRecord.findMany({
    where,
    orderBy: { dueDate: 'desc' },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  return ok(records);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const record = await prisma.duesRecord.create({
    data: { ...parsed.data, communityId },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  return ok(record, 201);
}
