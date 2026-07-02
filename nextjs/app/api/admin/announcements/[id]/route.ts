import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

const schema = z.object({
  title: z.string().min(1).max(300).optional(),
  body: z.string().min(1).optional(),
  priority: z.enum(['NORMAL', 'IMPORTANT', 'EMERGENCY']).optional(),
  audience: z.enum(['ALL_RESIDENTS', 'BOARD_MEMBERS', 'SPECIFIC_LOCATION']).optional(),
  targetLocation: z.string().max(200).nullable().optional(),
  isPinned: z.boolean().optional(),
  publishAt: z.string().datetime({ offset: true }).optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const { id } = await params;
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) return notFound('Announcement');

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const { publishAt, expiresAt, ...rest } = parsed.data;

  const updated = await prisma.announcement.update({
    where: { id },
    data: {
      ...rest,
      ...(publishAt !== undefined ? { publishAt: new Date(publishAt) } : {}),
      ...('expiresAt' in parsed.data ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
    },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  });

  await createAuditLog({
    userId: session.id,
    action: 'announcement.update',
    entityType: 'Announcement',
    entityId: id,
    metadata: rest as object,
  });

  return ok({ announcement: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const { id } = await params;
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) return notFound('Announcement');

  await prisma.announcement.delete({ where: { id } });

  await createAuditLog({
    userId: session.id,
    action: 'announcement.delete',
    entityType: 'Announcement',
    entityId: id,
    metadata: { title: existing.title } as object,
  });

  return ok({ deleted: true });
}
