import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, unauthorized, forbidden } from '@/lib/api';

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'RESIDENT') return forbidden();

  const requests = await prisma.architecturalRequest.findMany({
    where: { residentId: session.id },
    orderBy: { createdAt: 'desc' },
    include: {
      property: { select: { streetAddress: true, unitNumber: true } },
      _count: { select: { comments: { where: { isInternal: false } } } },
    },
  });

  return ok({ requests });
}
