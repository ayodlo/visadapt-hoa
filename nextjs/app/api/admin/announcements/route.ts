import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';
import { sendPushToUsers } from '@/lib/push';

const schema = z.object({
  title: z.string().min(1).max(300),
  body: z.string().min(1),
  priority: z.enum(['NORMAL', 'IMPORTANT', 'EMERGENCY']).default('NORMAL'),
  audience: z.enum(['ALL_RESIDENTS', 'BOARD_MEMBERS', 'SPECIFIC_LOCATION']).default('ALL_RESIDENTS'),
  targetLocation: z.string().max(200).nullable().optional(),
  isPinned: z.boolean().default(false),
  publishAt: z.string().datetime({ offset: true }).optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const { searchParams } = req.nextUrl;
  const search = searchParams.get('search')?.trim() ?? '';
  const priority = searchParams.get('priority') ?? '';
  const audience = searchParams.get('audience') ?? '';
  const status = searchParams.get('status') ?? 'all'; // all | active | scheduled | expired | pinned
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = 20;
  const now = new Date();

  const where = {
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { body: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(priority ? { priority: priority as never } : {}),
    ...(audience ? { audience: audience as never } : {}),
    ...(status === 'active'
      ? { publishAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
      : status === 'scheduled'
      ? { publishAt: { gt: now } }
      : status === 'expired'
      ? { expiresAt: { lte: now } }
      : status === 'pinned'
      ? { isPinned: true }
      : {}),
  };

  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { publishAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        _count: { select: { reads: true } },
      },
    }),
    prisma.announcement.count({ where }),
  ]);

  return ok({ announcements, total, totalPages: Math.ceil(total / limit), page });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const { publishAt, expiresAt, ...rest } = parsed.data;

  const announcement = await prisma.announcement.create({
    data: {
      ...rest,
      createdById: session.id,
      publishAt: publishAt ? new Date(publishAt) : new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  });

  await createAuditLog({
    userId: session.id,
    action: 'announcement.create',
    entityType: 'Announcement',
    entityId: announcement.id,
    metadata: { title: announcement.title, priority: announcement.priority, audience: announcement.audience },
  });

  const recipientRole = announcement.audience === 'BOARD_MEMBERS' ? 'BOARD_MEMBER' : 'RESIDENT';
  const recipients = await prisma.user.findMany({
    where: { role: recipientRole, id: { not: session.id } },
    select: { id: true },
  });
  await sendPushToUsers(recipients.map((r) => r.id), {
    title: 'New Announcement',
    body: announcement.title,
    data: { type: 'announcement', id: announcement.id },
  });

  return ok({ announcement }, 201);
}
