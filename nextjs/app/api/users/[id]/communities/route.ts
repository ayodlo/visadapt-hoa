import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

const schema = z.object({
  communityIds: z.array(z.string().min(1)).min(1, 'At least one community is required'),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  // Assigning more than one community to staff is an engineer-only (SUPER_ADMIN) action.
  if (session.role !== 'SUPER_ADMIN') return forbidden();

  const { id } = await params;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return notFound('User');
  if (existing.role !== 'ADMIN' && existing.role !== 'BOARD_MEMBER') {
    return err('Only ADMIN and BOARD_MEMBER users can be assigned to multiple communities', 400);
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const { communityIds } = parsed.data;
  const found = await prisma.community.findMany({ where: { id: { in: communityIds } }, select: { id: true } });
  if (found.length !== communityIds.length) return err('One or more communities not found', 400);

  await prisma.$transaction([
    prisma.communityAssignment.deleteMany({ where: { userId: id } }),
    prisma.communityAssignment.createMany({
      data: communityIds.map((communityId) => ({ userId: id, communityId, assignedById: session.id })),
    }),
  ]);

  await createAuditLog({
    userId: session.id,
    action: 'user.communities_update',
    entityType: 'User',
    entityId: id,
    metadata: { communityIds },
  });

  const assignments = await prisma.communityAssignment.findMany({
    where: { userId: id },
    select: { communityId: true, community: { select: { name: true } } },
  });

  return ok({ assignments });
}
