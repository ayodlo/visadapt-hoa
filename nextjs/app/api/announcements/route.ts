import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { isAdmin } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { ok, unauthorized } from '@/lib/api';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = req.nextUrl;
  const priority = searchParams.get('priority') ?? '';

  const now = new Date();

  // Audience filter: residents cannot see BOARD_MEMBERS-only announcements
  const audienceFilter =
    isAdmin(session.role)
      ? {}
      : session.role === 'BOARD_MEMBER'
      ? { audience: { in: ['ALL_RESIDENTS', 'BOARD_MEMBERS', 'SPECIFIC_LOCATION'] as never[] } }
      : { audience: { in: ['ALL_RESIDENTS', 'SPECIFIC_LOCATION'] as never[] } };

  const where = {
    ...audienceFilter,
    publishAt: { lte: now },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    ...(priority ? { priority: priority as never } : {}),
  };

  const announcements = await prisma.announcement.findMany({
    where,
    orderBy: [{ isPinned: 'desc' }, { publishAt: 'desc' }],
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      reads: {
        where: { userId: session.id },
        select: { id: true },
      },
    },
  });

  const result = announcements.map((a) => ({
    ...a,
    isRead: a.reads.length > 0,
    reads: undefined,
  }));

  return ok({ announcements: result });
}
