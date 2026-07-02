import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, unauthorized, forbidden } from '@/lib/api';

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'RESIDENT') return forbidden();

  const violations = await prisma.violation.findMany({
    where: {
      residentId: session.id,
      status: { not: 'DRAFT' },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      property: { select: { streetAddress: true, unitNumber: true } },
      appeal: { select: { id: true, status: true } },
      _count: { select: { comments: { where: { isInternal: false } } } },
    },
  });

  return ok({ violations });
}
