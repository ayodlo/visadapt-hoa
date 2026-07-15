import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { isStaff } from '@/lib/roles';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';

const updateSchema = z.object({
  streetAddress: z.string().min(1).optional(),
  unitNumber: z.string().optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  zipCode: z.string().min(1).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isStaff(session.role)) return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { id } = await params;
  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing || existing.communityId !== communityId) return notFound('Property');

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const updated = await prisma.property.update({ where: { id }, data: parsed.data });
  return ok(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isStaff(session.role)) return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { id } = await params;
  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing || existing.communityId !== communityId) return notFound('Property');

  await prisma.property.delete({ where: { id } });
  return ok({ deleted: true });
}
