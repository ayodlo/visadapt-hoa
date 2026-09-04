import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  userId: z.string().min(1),
});

/**
 * Move a resident INTO this community.
 *
 * There is no "remove from community" counterpart on purpose. `User.communityId`
 * is nullable in the schema, but a resident with no community is locked out of
 * the app entirely — `getActiveCommunityId` returns null and every route answers
 * "No community selected". So membership is only ever moved from one community
 * to another, never cleared, and a resident always has somewhere to sign in to.
 *
 * A resident who still owns property here is refused: the property would be left
 * with an owner outside its own community, which `/api/properties` treats as not
 * found. Transfer the property to whoever is replacing them first — the house
 * stays with the community, the person moves.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'SUPER_ADMIN') return forbidden();

  const { id } = await params;
  const community = await prisma.community.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!community) return notFound('Community');

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const user = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, role: true, communityId: true, firstName: true, lastName: true },
  });
  if (!user) return notFound('User');
  if (user.role !== 'RESIDENT') {
    return err('Only residents belong to a community directly. Assign staff under Staff instead.', 400);
  }
  if (user.communityId === id) return err('That resident is already in this community', 400);

  if (user.communityId) {
    const owned = await prisma.property.count({
      where: { ownerId: user.id, communityId: user.communityId },
    });
    if (owned > 0) {
      return err(
        `${user.firstName} ${user.lastName} still owns ${owned} propert${owned === 1 ? 'y' : 'ies'} in their current community. Transfer ownership to their replacement first.`,
        409
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { communityId: id },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  await createAuditLog({
    userId: session.id,
    action: 'community.resident_move',
    entityType: 'User',
    entityId: user.id,
    metadata: { from: user.communityId, to: id },
  });

  return ok({ resident: { ...updated, _count: { properties: 0 } } }, 201);
}
