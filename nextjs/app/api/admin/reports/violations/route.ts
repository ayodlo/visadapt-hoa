import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { ok, err, unauthorized, forbidden } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

  const [
    byStatus,
    byType,
    issuedLast30,
    resolvedLast30,
    pendingAppeals,
    appealsByStatus,
  ] = await Promise.all([
    prisma.violation.groupBy({ by: ['status'], where: { communityId }, _count: { _all: true } }),
    prisma.violation.groupBy({ by: ['violationType'], where: { communityId }, _count: { _all: true } }),
    prisma.violation.count({
      where: { communityId, status: { not: 'DRAFT' }, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.violation.count({
      where: { communityId, status: { in: ['RESOLVED', 'CLOSED'] }, updatedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.violationAppeal.count({
      where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] }, violation: { communityId } },
    }),
    prisma.violationAppeal.groupBy({
      by: ['status'],
      where: { violation: { communityId } },
      _count: { _all: true },
    }),
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
