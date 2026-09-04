import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

type Params = { params: Promise<{ id: string }> };

const SELECT = {
  id: true,
  streetAddress: true,
  unitNumber: true,
  city: true,
  state: true,
  zipCode: true,
  owner: { select: { id: true, firstName: true, lastName: true } },
};

const createSchema = z.object({
  streetAddress: z.string().trim().min(1, 'Street address is required').max(200),
  unitNumber: z.string().trim().max(50).optional().nullable(),
  city: z.string().trim().min(1, 'City is required').max(100),
  state: z.string().trim().min(2, 'State is required').max(50),
  zipCode: z.string().trim().min(3, 'ZIP code is required').max(20),
  ownerId: z.string().min(1, 'An owner is required'),
});

/**
 * Properties scoped to a named community rather than the caller's active one.
 *
 * `/api/properties` resolves the community from the session, so a SUPER_ADMIN
 * editing community X while switched to community Y would be told the property
 * does not exist. Administering a community has to address it explicitly.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'SUPER_ADMIN') return forbidden();

  const { id } = await params;
  const community = await prisma.community.findUnique({ where: { id }, select: { id: true } });
  if (!community) return notFound('Community');

  const properties = await prisma.property.findMany({
    where: { communityId: id },
    select: SELECT,
    orderBy: { streetAddress: 'asc' },
  });

  return ok({ properties });
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'SUPER_ADMIN') return forbidden();

  const { id } = await params;
  const community = await prisma.community.findUnique({ where: { id }, select: { id: true } });
  if (!community) return notFound('Community');

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  // The owner must be a resident of THIS community: a property whose owner sits
  // elsewhere is invisible to /api/properties, which checks both.
  const owner = await prisma.user.findUnique({
    where: { id: parsed.data.ownerId },
    select: { id: true, role: true, communityId: true },
  });
  if (!owner || owner.role !== 'RESIDENT' || owner.communityId !== id) {
    return err('The owner must be a resident of this community', 400);
  }

  const property = await prisma.property.create({
    data: {
      ...parsed.data,
      unitNumber: parsed.data.unitNumber || null,
      communityId: id,
    },
    select: SELECT,
  });

  await createAuditLog({
    userId: session.id,
    action: 'community.property_create',
    entityType: 'Property',
    entityId: property.id,
    metadata: { communityId: id },
  });

  return ok({ property }, 201);
}
