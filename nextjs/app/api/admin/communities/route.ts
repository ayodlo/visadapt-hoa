import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'SUPER_ADMIN') return forbidden();

  const communities = await prisma.community.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { users: true, communityAssignments: true, properties: true } },
    },
  });

  return ok(communities);
}

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'SUPER_ADMIN') return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const community = await prisma.community.create({ data: { name: parsed.data.name } });

  await createAuditLog({
    userId: session.id,
    action: 'community.create',
    entityType: 'Community',
    entityId: community.id,
  });

  return ok(community, 201);
}
