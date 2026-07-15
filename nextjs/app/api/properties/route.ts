import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { isStaff } from '@/lib/roles';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isStaff(session.role)) return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { searchParams } = req.nextUrl;
  const ownerId = searchParams.get('userId');
  if (!ownerId) return err('userId is required', 400);

  const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { communityId: true } });
  if (!owner || owner.communityId !== communityId) return notFound('Resident');

  const properties = await prisma.property.findMany({
    where: { ownerId, communityId },
    orderBy: { streetAddress: 'asc' },
  });
  return ok(properties);
}

const createSchema = z.object({
  ownerId: z.string().min(1),
  streetAddress: z.string().min(1),
  unitNumber: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  zipCode: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isStaff(session.role)) return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const owner = await prisma.user.findUnique({ where: { id: parsed.data.ownerId }, select: { communityId: true, role: true } });
  if (!owner || owner.communityId !== communityId || owner.role !== 'RESIDENT') return notFound('Resident');

  const property = await prisma.property.create({ data: { ...parsed.data, communityId } });
  return ok(property, 201);
}
