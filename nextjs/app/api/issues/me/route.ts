import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, unauthorized } from '@/lib/api';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const issues = await prisma.issue.findMany({
    where: { residentId: session.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      category: true,
      title: true,
      location: true,
      priority: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      assignedTo: { select: { firstName: true, lastName: true } },
      vendor: { select: { name: true } },
      _count: { select: { comments: { where: { isInternal: false } } } },
    },
  });

  return ok({ issues });
}
