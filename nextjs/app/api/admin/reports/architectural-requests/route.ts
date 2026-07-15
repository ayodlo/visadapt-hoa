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

  const [byStatus, byType, submittedLast30, decidedLast30, avgDecisionSample] = await Promise.all([
    prisma.architecturalRequest.groupBy({ by: ['status'], where: { communityId }, _count: { _all: true } }),
    prisma.architecturalRequest.groupBy({ by: ['requestType'], where: { communityId }, _count: { _all: true } }),
    prisma.architecturalRequest.count({
      where: { communityId, createdAt: { gte: thirtyDaysAgo }, status: { not: 'DRAFT' } },
    }),
    prisma.architecturalRequest.count({
      where: { communityId, status: { in: ['APPROVED', 'DENIED'] }, updatedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.architecturalRequest.findMany({
      where: { communityId, status: { in: ['APPROVED', 'DENIED'] } },
      select: { createdAt: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    }),
  ]);

  let avgDecisionDays: number | null = null;
  if (avgDecisionSample.length > 0) {
    const totalMs = avgDecisionSample.reduce(
      (acc, r) => acc + (r.updatedAt.getTime() - r.createdAt.getTime()),
      0
    );
    avgDecisionDays = Math.round(totalMs / avgDecisionSample.length / 86_400_000);
  }

  return ok({
    summary: {
      submittedLast30Days: submittedLast30,
      decidedLast30Days: decidedLast30,
      avgDecisionDays,
    },
    byStatus: byStatus.map((g) => ({ status: g.status, count: g._count._all })),
    byType: byType.map((g) => ({ type: g.requestType, count: g._count._all })),
  });
}
