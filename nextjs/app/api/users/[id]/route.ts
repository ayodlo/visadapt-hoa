import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { isAdmin } from '@/lib/roles';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';

const schema = z.object({
  role: z.enum(['ADMIN', 'BOARD_MEMBER', 'RESIDENT']).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isAdmin(session.role)) return forbidden();

  const { id } = await params;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return notFound('User');
  // SUPER_ADMIN accounts are engineer-managed only; regular ADMINs cannot touch them.
  if (existing.role === 'SUPER_ADMIN' && session.role !== 'SUPER_ADMIN') return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const updated = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true },
  });
  return ok(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isAdmin(session.role)) return forbidden();

  const { id } = await params;
  if (id === session.id) return err('Cannot delete your own account', 400);

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return notFound('User');
  if (existing.role === 'SUPER_ADMIN' && session.role !== 'SUPER_ADMIN') return forbidden();

  await prisma.user.delete({ where: { id } });
  return ok({ deleted: true });
}
