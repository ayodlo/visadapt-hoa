import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
});

/**
 * Everything the community editor needs in one call: the community itself, the
 * staff assigned to it, its residents, and its properties with their owners.
 *
 * Managing a community is SUPER_ADMIN-only, matching the list and create
 * endpoints — an ADMIN administers the community they are in, not the set of
 * communities.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'SUPER_ADMIN') return forbidden();

  const { id } = await params;
  const community = await prisma.community.findUnique({
    where: { id },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
  if (!community) return notFound('Community');

  const [staff, residents, properties] = await Promise.all([
    prisma.communityAssignment.findMany({
      where: { communityId: id },
      select: {
        id: true,
        createdAt: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
      orderBy: { user: { lastName: 'asc' } },
    }),
    prisma.user.findMany({
      where: { communityId: id, role: 'RESIDENT' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        _count: { select: { properties: true } },
      },
      orderBy: { lastName: 'asc' },
    }),
    prisma.property.findMany({
      where: { communityId: id },
      select: {
        id: true,
        streetAddress: true,
        unitNumber: true,
        city: true,
        state: true,
        zipCode: true,
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { streetAddress: 'asc' },
    }),
  ]);

  return ok({ community, staff, residents, properties });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'SUPER_ADMIN') return forbidden();

  const { id } = await params;
  const existing = await prisma.community.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!existing) return notFound('Community');

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const community = await prisma.community.update({
    where: { id },
    data: { name: parsed.data.name },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });

  await createAuditLog({
    userId: session.id,
    action: 'community.update',
    entityType: 'Community',
    entityId: id,
    metadata: { from: existing.name, to: community.name },
  });

  return ok(community);
}
