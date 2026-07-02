import { getSession } from '@/lib/auth';
import { ok, unauthorized, forbidden } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

  const [
    byStatus,
    byType,
    issuedLast30,
    resolvedLast30,
    pendingAppeals,
    appealsByStatus,
  ] = await Promise.all([
    prisma.violation.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.violation.groupBy({ by: ['violationType'], _count: { _all: true } }),
    prisma.violation.count({
      where: { status: { not: 'DRAFT' }, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.violation.count({
      where: { status: { in: ['RESOLVED', 'CLOSED'] }, updatedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.violationAppeal.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.violationAppeal.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  return ok({
    summary: {
      issuedLast30Days: issuedLast30,
      resolvedLast30Days: resolvedLast30,
      pendingAppeals,
    },
    byStatus: byStatus.map((g) => ({ status: g.status, count: g._count._all })),
    byType: byType.map((g) => ({ type: g.violationType, count: g._count._all })),
    appeals: {
      byStatus: appealsByStatus.map((g) => ({ status: g.status, count: g._count._all })),
    },
  });
}
