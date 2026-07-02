import { getSession } from '@/lib/auth';
import { ok, unauthorized, forbidden } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const [
    byStatus,
    byCategory,
    byPriority,
    overdueCount,
    createdLast30,
    resolvedLast30,
    avgResolutionSample,
    unassignedCount,
  ] = await Promise.all([
    prisma.issue.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.issue.groupBy({ by: ['category'], _count: { _all: true } }),
    prisma.issue.groupBy({ by: ['priority'], _count: { _all: true } }),
    prisma.issue.count({
      where: {
        status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_VENDOR'] },
        dueDate: { lt: now, not: null },
      },
    }),
    prisma.issue.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.issue.count({ where: { status: { in: ['RESOLVED', 'CLOSED'] }, updatedAt: { gte: thirtyDaysAgo } } }),
    prisma.issue.findMany({
      where: { status: { in: ['RESOLVED', 'CLOSED'] } },
      select: { createdAt: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    }),
    prisma.issue.count({
      where: {
        assignedToId: null,
        status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
      },
    }),
  ]);

  let avgResolutionDays: number | null = null;
  if (avgResolutionSample.length > 0) {
    const totalMs = avgResolutionSample.reduce(
      (acc, i) => acc + (i.updatedAt.getTime() - i.createdAt.getTime()),
      0
    );
    avgResolutionDays = Math.round(totalMs / avgResolutionSample.length / 86_400_000);
  }

  return ok({
    summary: {
      overdueCount,
      unassignedCount,
      createdLast30Days: createdLast30,
      resolvedLast30Days: resolvedLast30,
      avgResolutionDays,
    },
    byStatus: byStatus.map((g) => ({ status: g.status, count: g._count._all })),
    byCategory: byCategory.map((g) => ({ category: g.category, count: g._count._all })),
    byPriority: byPriority.map((g) => ({ priority: g.priority, count: g._count._all })),
  });
}
