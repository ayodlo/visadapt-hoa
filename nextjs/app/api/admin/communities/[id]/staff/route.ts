import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  userIds: z.array(z.string().min(1)),
});

/**
 * Replace the set of staff assigned to this community.
 *
 * The mirror of `PUT /api/users/[id]/communities`, which sets the communities
 * for one user; this sets the users for one community. Both write the same
 * `CommunityAssignment` rows, so either side can be used.
 *
 * Sending the whole set rather than add/remove deltas keeps the result
 * independent of what the browser last saw — two admins editing at once cannot
 * produce a half-applied assignment list.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'SUPER_ADMIN') return forbidden();

  const { id } = await params;
  const community = await prisma.community.findUnique({ where: { id }, select: { id: true } });
  if (!community) return notFound('Community');

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const { userIds } = parsed.data;

  if (userIds.length > 0) {
    // Only staff hold assignments — a RESIDENT belongs to a community through
    // User.communityId instead, and mixing the two would give them a second,
    // conflicting membership.
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, role: true },
    });
    if (users.length !== userIds.length) return err('One or more users not found', 400);

    const nonStaff = users.filter((u) => u.role !== 'ADMIN' && u.role !== 'BOARD_MEMBER');
    if (nonStaff.length > 0) {
      return err('Only ADMIN and BOARD_MEMBER users can be assigned to a community', 400);
    }
  }

  await prisma.$transaction([
    prisma.communityAssignment.deleteMany({ where: { communityId: id } }),
    ...(userIds.length > 0
      ? [
          prisma.communityAssignment.createMany({
            data: userIds.map((userId) => ({ userId, communityId: id, assignedById: session.id })),
          }),
        ]
      : []),
  ]);

  await createAuditLog({
    userId: session.id,
    action: 'community.staff_update',
    entityType: 'Community',
    entityId: id,
    metadata: { userIds },
  });

  const staff = await prisma.communityAssignment.findMany({
    where: { communityId: id },
    select: {
      id: true,
      createdAt: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    },
    orderBy: { user: { lastName: 'asc' } },
  });

  return ok({ staff });
}
