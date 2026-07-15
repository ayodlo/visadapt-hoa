import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { isAdmin } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  // Roster includes every member's email — staff only.
  if (session.role === 'RESIDENT') return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const users = await prisma.user.findMany({
    where: {
      OR: [{ communityId }, { communityAssignments: { some: { communityId } } }],
    },
    orderBy: { lastName: 'asc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      createdAt: true,
      communityAssignments: { select: { communityId: true, community: { select: { name: true } } } },
    },
  });
  return ok(users);
}

const createSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  // SUPER_ADMIN is engineer-only and is never assignable here — see prisma/create-super-admin.ts.
  role: z.enum(['ADMIN', 'BOARD_MEMBER', 'RESIDENT']).default('RESIDENT'),
  // Only honored for SUPER_ADMIN callers assigning ADMIN/BOARD_MEMBER to more than one community.
  communityIds: z.array(z.string().min(1)).min(1).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isAdmin(session.role)) return forbidden();

  const activeCommunityId = await getActiveCommunityId(session);
  if (!activeCommunityId) return err('No community selected', 400);

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const { firstName, lastName, email, password, role, communityIds } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return err('Email already in use', 409);

  let targetCommunityIds = [activeCommunityId];
  if (session.role === 'SUPER_ADMIN' && role !== 'RESIDENT' && communityIds?.length) {
    const found = await prisma.community.findMany({ where: { id: { in: communityIds } }, select: { id: true } });
    if (found.length !== communityIds.length) return err('One or more communities not found', 400);
    targetCommunityIds = communityIds;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      passwordHash,
      role,
      ...(role === 'RESIDENT'
        ? { communityId: targetCommunityIds[0] }
        : { communityAssignments: { create: targetCommunityIds.map((id) => ({ communityId: id, assignedById: session.id })) } }),
    },
    select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true },
  });

  await createAuditLog({ userId: session.id, action: 'user.create', entityType: 'User', entityId: user.id, metadata: { role, communityIds: targetCommunityIds } });

  return ok(user, 201);
}
