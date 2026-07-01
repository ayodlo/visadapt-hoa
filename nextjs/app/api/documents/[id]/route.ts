import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

const CATEGORIES = ['CC_AND_RS', 'RULES_AND_REGS', 'MEETING_MINUTES', 'FINANCIALS', 'INSURANCE', 'COMMUNITY_FORMS', 'MAINTENANCE', 'OTHER'] as const;

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  category: z.enum(CATEGORIES).optional(),
  fileUrl: z.string().min(1).optional(),
  fileName: z.string().min(1).optional(),
});

const INCLUDE = { uploadedBy: { select: { id: true, firstName: true, lastName: true } } };

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id }, include: INCLUDE });
  if (!doc) return notFound('Document');

  return ok(doc);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'ADMIN') return forbidden();

  const { id } = await params;
  const existing = await prisma.document.findUnique({ where: { id } });
  if (!existing) return notFound('Document');

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const doc = await prisma.document.update({
    where: { id },
    data: parsed.data,
    include: INCLUDE,
  });

  await createAuditLog({ userId: session.id, action: 'document.update', entityType: 'Document', entityId: id });

  return ok(doc);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'ADMIN') return forbidden();

  const { id } = await params;
  const existing = await prisma.document.findUnique({ where: { id } });
  if (!existing) return notFound('Document');

  await prisma.document.delete({ where: { id } });
  await createAuditLog({ userId: session.id, action: 'document.delete', entityType: 'Document', entityId: id });

  return ok({ deleted: true });
}
