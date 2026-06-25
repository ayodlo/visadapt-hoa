import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';

const schema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const existing = await prisma.maintenanceRequest.findUnique({ where: { id } });
  if (!existing) return notFound('Maintenance request');

  if (session.role === 'RESIDENT' && existing.submittedById !== session.id) return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const updated = await prisma.maintenanceRequest.update({
    where: { id },
    data: parsed.data,
    include: { submittedBy: { select: { id: true, firstName: true, lastName: true } } },
  });
  return ok(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const { id } = await params;
  const existing = await prisma.maintenanceRequest.findUnique({ where: { id } });
  if (!existing) return notFound('Maintenance request');

  await prisma.maintenanceRequest.delete({ where: { id } });
  return ok({ deleted: true });
}
