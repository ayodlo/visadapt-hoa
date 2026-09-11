import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { ok, err, unauthorized, forbidden } from '@/lib/api';
import { prisma } from '@/lib/prisma';

/** What a charge bucket still owes once partial payments are netted off. */
function outstanding(agg: { _sum: { amount: number | null; amountPaid: number | null } }): number {
  return (agg._sum.amount ?? 0) - (agg._sum.amountPaid ?? 0);
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const [
    totalChargesAgg,
    pendingChargesAgg,
    overdueChargesAgg,
    paidChargesAgg,
    totalPaymentsAgg,
    delinquentResidentIds,
    recentPayments,
    chargesByStatus,
  ] = await Promise.all([
    prisma.charge.aggregate({ _sum: { amount: true }, _count: { _all: true }, where: { communityId } }),
    // amountPaid is summed too: an outstanding bucket must net off partial
    // payments, and sum(amount - amountPaid) === sum(amount) - sum(amountPaid).
    prisma.charge.aggregate({ _sum: { amount: true, amountPaid: true }, _count: { _all: true }, where: { communityId, status: 'PENDING' } }),
    prisma.charge.aggregate({ _sum: { amount: true, amountPaid: true }, _count: { _all: true }, where: { communityId, status: 'OVERDUE' } }),
    prisma.charge.aggregate({ _sum: { amount: true }, _count: { _all: true }, where: { communityId, status: 'PAID' } }),
    prisma.payment.aggregate({ _sum: { amount: true }, _count: { _all: true }, where: { communityId, status: 'PAID' } }),
    prisma.charge
      .groupBy({ by: ['residentId'], where: { communityId, status: 'OVERDUE' } })
      .then((rows) => rows.map((r) => r.residentId)),
    prisma.payment.findMany({
      where: { communityId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
        status: true,
        paidAt: true,
        createdAt: true,
        confirmationNumber: true,
        resident: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.charge.groupBy({ by: ['status'], where: { communityId }, _sum: { amount: true }, _count: { _all: true } }),
  ]);

  return ok({
    summary: {
      totalBilledCents: totalChargesAgg._sum.amount ?? 0,
      totalPendingCents: outstanding(pendingChargesAgg),
      totalOverdueCents: outstanding(overdueChargesAgg),
      totalPaidCents: paidChargesAgg._sum.amount ?? 0,
      totalCollectedCents: totalPaymentsAgg._sum.amount ?? 0,
      outstandingCents: outstanding(pendingChargesAgg) + outstanding(overdueChargesAgg),
      delinquentAccounts: delinquentResidentIds.length,
      totalCharges: totalChargesAgg._count._all,
      totalPayments: totalPaymentsAgg._count._all,
    },
    byStatus: chargesByStatus.map((g) => ({
      status: g.status,
      count: g._count._all,
      amountCents: g._sum.amount ?? 0,
    })),
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      status: p.status,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
      confirmationNumber: p.confirmationNumber,
      residentName: `${p.resident.firstName} ${p.resident.lastName}`,
      residentEmail: p.resident.email,
    })),
  });
}
