import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, unauthorized, forbidden, notFound } from '@/lib/api';

type Params = { params: Promise<{ id: string }> };

/**
 * Who can be added to this community.
 *
 * `/api/users` only ever returns people already in the caller's active
 * community, so it cannot answer "which residents could move in from
 * elsewhere". Each candidate carries their current community and how many
 * properties they still own there, so the UI can show up front that a move will
 * be refused until the property is handed over.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'SUPER_ADMIN') return forbidden();

  const { id } = await params;
  const community = await prisma.community.findUnique({ where: { id }, select: { id: true } });
  if (!community) return notFound('Community');

  const [staff, residents] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'BOARD_MEMBER'] } },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    prisma.user.findMany({
      where: { role: 'RESIDENT', NOT: { communityId: id } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        community: { select: { id: true, name: true } },
        _count: { select: { properties: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
  ]);

  return ok({ staff, residents });
}
