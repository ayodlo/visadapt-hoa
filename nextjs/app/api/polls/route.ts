import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { ok, err, unauthorized, forbidden } from '@/lib/api';

const schema = z.object({
  question: z.string().min(1),
  description: z.string().optional(),
  closesAt: z.string().datetime().optional(),
  options: z.array(z.string().min(1)).min(2),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const polls = await prisma.poll.findMany({
    where: { communityId },
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      options: { include: { _count: { select: { votes: true } } } },
      _count: { select: { votes: true } },
    },
  });
  return ok(polls);
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

  const { options, ...rest } = parsed.data;
  const poll = await prisma.poll.create({
    data: {
      ...rest,
      createdById: session.id,
      communityId,
      options: { create: options.map((text) => ({ text })) },
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      options: { include: { _count: { select: { votes: true } } } },
      _count: { select: { votes: true } },
    },
  });
  return ok(poll, 201);
}
