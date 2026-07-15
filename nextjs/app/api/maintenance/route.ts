import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { ok, err, unauthorized } from '@/lib/api';

const schema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const requests = await prisma.maintenanceRequest.findMany({
    where: { communityId },
    orderBy: { createdAt: 'desc' },
    include: { submittedBy: { select: { id: true, firstName: true, lastName: true } } },
  });
  return ok(requests);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const request = await prisma.maintenanceRequest.create({
    data: { ...parsed.data, submittedById: session.id, communityId },
    include: { submittedBy: { select: { id: true, firstName: true, lastName: true } } },
  });
  return ok(request, 201);
}
