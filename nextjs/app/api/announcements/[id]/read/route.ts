import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, notFound } from '@/lib/api';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { id } = await params;
  const exists = await prisma.announcement.findUnique({ where: { id }, select: { id: true, communityId: true } });
  if (!exists || exists.communityId !== communityId) return notFound('Announcement');

  await prisma.announcementRead.upsert({
    where: { announcementId_userId: { announcementId: id, userId: session.id } },
    update: {},
    create: { announcementId: id, userId: session.id },
  });

  return ok({ read: true });
}
