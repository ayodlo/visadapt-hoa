import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, unauthorized, forbidden, notFound } from '@/lib/api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const isAdmin = session.role === 'ADMIN' || session.role === 'BOARD_MEMBER';

  const violation = await prisma.violation.findUnique({
    where: { id },
    include: {
      resident: { select: { id: true, firstName: true, lastName: true, email: true } },
      property: { select: { streetAddress: true, unitNumber: true, city: true, state: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      comments: {
        where: isAdmin ? {} : { isInternal: false },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { firstName: true, lastName: true, role: true } } },
      },
      activities: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { firstName: true, lastName: true, role: true } } },
      },
      appeal: {
        include: {
          submittedBy: { select: { firstName: true, lastName: true } },
          reviewedBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!violation) return notFound('Violation');
  if (session.role === 'RESIDENT') {
    if (violation.residentId !== session.id) return forbidden();
    if (violation.status === 'DRAFT') return notFound('Violation');
  }

  return ok({ violation });
}
