import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

type Params = { params: Promise<{ id: string; propertyId: string }> };

const SELECT = {
  id: true,
  streetAddress: true,
  unitNumber: true,
  city: true,
  state: true,
  zipCode: true,
  owner: { select: { id: true, firstName: true, lastName: true } },
};

const updateSchema = z.object({
  streetAddress: z.string().trim().min(1).max(200).optional(),
  unitNumber: z.string().trim().max(50).optional().nullable(),
  city: z.string().trim().min(1).max(100).optional(),
  state: z.string().trim().min(2).max(50).optional(),
  zipCode: z.string().trim().min(3).max(20).optional(),
  /** Hand the property to a different resident — how a move-out/move-in is recorded. */
  ownerId: z.string().min(1).optional(),
});

async function load(communityId: string, propertyId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, communityId: true, ownerId: true, streetAddress: true },
  });
  return property && property.communityId === communityId ? property : null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'SUPER_ADMIN') return forbidden();

  const { id, propertyId } = await params;
  const existing = await load(id, propertyId);
  if (!existing) return notFound('Property');

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  // A transfer is the move-out/move-in case: the property stays with the
  // community and the incoming resident takes it over. The incoming owner must
  // already be a resident here, so a handover cannot pull a unit out of its
  // community. `communityId` is deliberately not updatable — a house does not
  // move to another association.
  if (parsed.data.ownerId && parsed.data.ownerId !== existing.ownerId) {
    const owner = await prisma.user.findUnique({
      where: { id: parsed.data.ownerId },
      select: { id: true, role: true, communityId: true },
    });
    if (!owner || owner.role !== 'RESIDENT' || owner.communityId !== id) {
      return err('The new owner must be a resident of this community', 400);
    }
  }

  const property = await prisma.property.update({
    where: { id: propertyId },
    data: {
      ...parsed.data,
      ...(parsed.data.unitNumber !== undefined ? { unitNumber: parsed.data.unitNumber || null } : {}),
    },
    select: SELECT,
  });

  await createAuditLog({
    userId: session.id,
    action: parsed.data.ownerId && parsed.data.ownerId !== existing.ownerId
      ? 'community.property_transfer'
      : 'community.property_update',
    entityType: 'Property',
    entityId: propertyId,
    metadata: {
      communityId: id,
      ...(parsed.data.ownerId && parsed.data.ownerId !== existing.ownerId
        ? { fromOwner: existing.ownerId, toOwner: parsed.data.ownerId }
        : {}),
    },
  });

  return ok({ property });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'SUPER_ADMIN') return forbidden();

  const { id, propertyId } = await params;
  const existing = await load(id, propertyId);
  if (!existing) return notFound('Property');

  // Records point at a property with a nullable propertyId and no cascade, so
  // deleting one with history attached would fail on the foreign key. Refuse
  // clearly instead, and say what is holding it.
  const [charges, issues, violations, requests, maintenance, payments] = await Promise.all([
    prisma.charge.count({ where: { propertyId } }),
    prisma.issue.count({ where: { propertyId } }),
    prisma.violation.count({ where: { propertyId } }),
    prisma.architecturalRequest.count({ where: { propertyId } }),
    prisma.maintenanceRequest.count({ where: { propertyId } }),
    prisma.payment.count({ where: { propertyId } }),
  ]);
  const attached = charges + issues + violations + requests + maintenance + payments;
  if (attached > 0) {
    return err(
      `This property has ${attached} linked record${attached === 1 ? '' : 's'} (charges, issues, violations, requests or payments) and cannot be deleted. Transfer it to the new owner instead.`,
      409
    );
  }

  await prisma.property.delete({ where: { id: propertyId } });

  await createAuditLog({
    userId: session.id,
    action: 'community.property_delete',
    entityType: 'Property',
    entityId: propertyId,
    metadata: { communityId: id, streetAddress: existing.streetAddress },
  });

  return ok({ deleted: true });
}
