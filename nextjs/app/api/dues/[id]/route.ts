import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';

const schema = z.object({
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'WAIVED']).optional(),
  paidAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const { id } = await params;
  const existing = await prisma.duesRecord.findUnique({ where: { id } });
  if (!existing) return notFound('Dues record');

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === 'PAID' && !parsed.data.paidAt) data.paidAt = new Date().toISOString();

  const updated = await prisma.duesRecord.update({
    where: { id },
    data,
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  return ok(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const { id } = await params;
  const existing = await prisma.duesRecord.findUnique({ where: { id } });
  if (!existing) return notFound('Dues record');

  await prisma.duesRecord.delete({ where: { id } });
  return ok({ deleted: true });
}
