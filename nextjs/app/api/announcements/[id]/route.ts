import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { isAdmin } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { id } = await params;
  const a = await prisma.announcement.findUnique({
    where: { id },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      reads: {
        where: { userId: session.id },
        select: { id: true },
      },
    },
  });

  if (!a || a.communityId !== communityId) return notFound('Announcement');

  // Residents cannot see BOARD_MEMBERS-only announcements
  if (session.role === 'RESIDENT' && a.audience === 'BOARD_MEMBERS') return forbidden();

  const now = new Date();
  // Admins can view all; residents/board cannot see unpublished or expired
  if (!isAdmin(session.role)) {
    if (a.publishAt > now) return notFound('Announcement');
    if (a.expiresAt && a.expiresAt < now) return notFound('Announcement');
  }

  return ok({ announcement: { ...a, isRead: a.reads.length > 0, reads: undefined } });
}
