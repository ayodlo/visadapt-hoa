import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, unauthorized, forbidden, notFound } from '@/lib/api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const issue = await prisma.issue.findUnique({
    where: { id },
    include: {
      resident: { select: { id: true, firstName: true, lastName: true, email: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
      vendor: { select: { id: true, name: true, contactName: true, phone: true } },
      comments: {
        where: session.role === 'RESIDENT' ? { isInternal: false } : {},
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { firstName: true, lastName: true, role: true } } },
      },
      activities: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { firstName: true, lastName: true, role: true } } },
      },
    },
  });

  if (!issue) return notFound('Issue');
  if (session.role === 'RESIDENT' && issue.residentId !== session.id) return forbidden();

  return ok({ issue });
}
