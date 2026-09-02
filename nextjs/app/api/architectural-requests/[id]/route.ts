import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  // Architectural requests are staff-only; residents no longer track them here.
  if (session.role === 'RESIDENT') return forbidden();

  const { id } = await params;
  const request = await prisma.architecturalRequest.findUnique({
    where: { id },
    include: {
      resident: { select: { id: true, firstName: true, lastName: true, email: true } },
      property: { select: { streetAddress: true, unitNumber: true, city: true, state: true } },
      comments: {
        where: {},
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { firstName: true, lastName: true, role: true } } },
      },
      activities: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { firstName: true, lastName: true, role: true } } },
      },
      attachments: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!request) return notFound('Architectural request');
  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);
  if (request.communityId !== communityId) return notFound('Architectural request');

  return ok({ request });
}

/**
 * Resident edit / withdraw — closed.
 *
 * Only residents could ever call this (editing their own draft or withdrawing
 * it). With architectural requests now staff-only, it is closed to every role.
 * Staff status changes go through /api/admin and /api/board instead.
 */
export async function PATCH() {
  const session = await getSession();
  if (!session) return unauthorized();
  return forbidden();
}
