import { prisma } from './prisma';

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function getAdminDashboard() {
  const now = new Date();
  const ms = monthStart();

  const [
    totalResidents,
    openIssues,
    overdueIssues,
    issuesByCategory,
    issuesByStatus,
    recentlyResolvedIssues,
    openArchRequests,
    openViolations,
    pendingAppeals,
    unpaidChargesAgg,
    delinquentResidents,
    recentAnnouncements,
    recentActivity,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'RESIDENT' } }),

    prisma.issue.count({
      where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_VENDOR'] } },
    }),

    prisma.issue.count({
      where: {
        status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_VENDOR'] },
        dueDate: { lt: now, not: null },
      },
    }),

    prisma.issue.groupBy({
      by: ['category'],
      _count: { _all: true },
      where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_VENDOR'] } },
      orderBy: { _count: { category: 'desc' } },
    }),

    prisma.issue.groupBy({
      by: ['status'],
      _count: { _all: true },
      orderBy: { _count: { status: 'desc' } },
    }),

    prisma.issue.findMany({
      where: { status: { in: ['RESOLVED', 'CLOSED'] }, updatedAt: { gte: ms } },
      select: { createdAt: true, updatedAt: true },
      take: 200,
    }),

    prisma.architecturalRequest.count({
      where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION'] } },
    }),

    prisma.violation.count({
      where: { status: { in: ['NOTICE_SENT', 'RESIDENT_RESPONDED', 'UNDER_REVIEW', 'ESCALATED'] } },
    }),

    prisma.violationAppeal.count({
      where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
    }),

    prisma.charge.aggregate({
      _sum: { amount: true },
      where: { status: { in: ['PENDING', 'OVERDUE'] } },
    }),

    prisma.charge
      .groupBy({ by: ['residentId'], where: { status: 'OVERDUE' } })
      .then((rows) => rows.length),

    prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, createdAt: true },
    }),

    prisma.issueActivity.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        action: true,
        details: true,
        createdAt: true,
        actor: { select: { firstName: true, lastName: true } },
        issue: { select: { id: true, title: true } },
      },
    }),
  ]);

  let avgResolutionDays: number | null = null;
  if (recentlyResolvedIssues.length > 0) {
    const totalMs = recentlyResolvedIssues.reduce(
      (acc, i) => acc + (i.updatedAt.getTime() - i.createdAt.getTime()),
      0
    );
    avgResolutionDays = Math.round(totalMs / recentlyResolvedIssues.length / 86_400_000);
  }

  return {
    totalResidents,
    unpaidBalanceCents: unpaidChargesAgg._sum.amount ?? 0,
    delinquentAccounts: delinquentResidents,
    openIssues,
    overdueIssues,
    issuesByCategory: issuesByCategory.map((g) => ({ category: g.category, count: g._count._all })),
    issuesByStatus: issuesByStatus.map((g) => ({ status: g.status, count: g._count._all })),
    avgResolutionDays,
    openArchRequests,
    openViolations,
    pendingAppeals,
    recentAnnouncements: recentAnnouncements.map((a) => ({
      id: a.id,
      title: a.title,
      date: a.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    })),
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      action: a.action,
      details: a.details,
      createdAt: a.createdAt.toISOString(),
      actorName: a.actor ? `${a.actor.firstName} ${a.actor.lastName}` : null,
      issueId: a.issue.id,
      issueTitle: a.issue.title,
    })),
  };
}

export type AdminDashboard = Awaited<ReturnType<typeof getAdminDashboard>>;

export async function getBoardDashboard() {
  const ms = monthStart();

  const [
    archRequestsNeedingReview,
    escalatedViolations,
    pendingAppeals,
    openIssues,
    resolvedThisMonth,
    totalBilledAgg,
    totalPaidAgg,
    delinquentResidents,
    recentAnnouncements,
  ] = await Promise.all([
    prisma.architecturalRequest.count({
      where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
    }),

    prisma.violation.count({ where: { status: 'ESCALATED' } }),

    prisma.violationAppeal.count({
      where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
    }),

    prisma.issue.count({
      where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_VENDOR'] } },
    }),

    prisma.issue.count({
      where: { status: { in: ['RESOLVED', 'CLOSED'] }, updatedAt: { gte: ms } },
    }),

    prisma.charge.aggregate({ _sum: { amount: true } }),

    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'PAID' },
    }),

    prisma.charge
      .groupBy({ by: ['residentId'], where: { status: 'OVERDUE' } })
      .then((rows) => rows.length),

    prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, createdAt: true },
    }),
  ]);

  return {
    financialSummary: {
      totalBilledCents: totalBilledAgg._sum.amount ?? 0,
      totalPaidCents: totalPaidAgg._sum.amount ?? 0,
      outstandingCents: (totalBilledAgg._sum.amount ?? 0) - (totalPaidAgg._sum.amount ?? 0),
      delinquentAccounts: delinquentResidents,
    },
    archRequestsNeedingReview,
    violationsNeedingReview: escalatedViolations,
    pendingAppeals,
    decisionQueueCount: archRequestsNeedingReview + escalatedViolations + pendingAppeals,
    openIssues,
    resolvedThisMonth,
    recentAnnouncements: recentAnnouncements.map((a) => ({
      id: a.id,
      title: a.title,
      date: a.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    })),
  };
}

export type BoardDashboard = Awaited<ReturnType<typeof getBoardDashboard>>;

export async function getResidentDashboard(userId: string) {
  const now = new Date();

  const [
    pendingCharges,
    nextCharge,
    openIssues,
    openArchRequests,
    activeViolations,
    recentAnnouncements,
  ] = await Promise.all([
    prisma.charge.findMany({
      where: { residentId: userId, status: { in: ['PENDING', 'OVERDUE'] } },
      select: { amount: true },
    }),

    prisma.charge.findFirst({
      where: { residentId: userId, status: 'PENDING', dueDate: { gte: now } },
      orderBy: { dueDate: 'asc' },
      select: { dueDate: true, amount: true, description: true },
    }),

    prisma.issue.count({
      where: {
        residentId: userId,
        status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_VENDOR'] },
      },
    }),

    prisma.architecturalRequest.count({
      where: {
        residentId: userId,
        status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION'] },
      },
    }),

    prisma.violation.findMany({
      where: {
        residentId: userId,
        status: { in: ['NOTICE_SENT', 'RESIDENT_RESPONDED', 'UNDER_REVIEW', 'ESCALATED'] },
      },
      select: { id: true, violationType: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),

    prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, title: true, createdAt: true },
    }),
  ]);

  const balanceCents = pendingCharges.reduce((sum, c) => sum + c.amount, 0);

  return {
    balanceCents,
    nextDueDateLabel: nextCharge?.dueDate
      ? nextCharge.dueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : null,
    nextDueAmountCents: nextCharge?.amount ?? null,
    openIssues,
    openArchRequests,
    activeViolations: activeViolations.map((v) => ({
      id: v.id,
      violationType: v.violationType,
      status: v.status,
      date: v.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    })),
    recentAnnouncements: recentAnnouncements.map((a) => ({
      id: a.id,
      title: a.title,
      date: a.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    })),
  };
}

export type ResidentDashboard = Awaited<ReturnType<typeof getResidentDashboard>>;

export function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
