import { getSession } from '@/lib/auth';
import { ok, unauthorized, forbidden } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

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
    prisma.charge.aggregate({ _sum: { amount: true }, _count: { _all: true } }),
    prisma.charge.aggregate({ _sum: { amount: true }, _count: { _all: true }, where: { status: 'PENDING' } }),
    prisma.charge.aggregate({ _sum: { amount: true }, _count: { _all: true }, where: { status: 'OVERDUE' } }),
    prisma.charge.aggregate({ _sum: { amount: true }, _count: { _all: true }, where: { status: 'PAID' } }),
    prisma.payment.aggregate({ _sum: { amount: true }, _count: { _all: true }, where: { status: 'PAID' } }),
    prisma.charge
      .groupBy({ by: ['residentId'], where: { status: 'OVERDUE' } })
      .then((rows) => rows.map((r) => r.residentId)),
    prisma.payment.findMany({
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
    prisma.charge.groupBy({ by: ['status'], _sum: { amount: true }, _count: { _all: true } }),
  ]);

  return ok({
    summary: {
      totalBilledCents: totalChargesAgg._sum.amount ?? 0,
      totalPendingCents: pendingChargesAgg._sum.amount ?? 0,
      totalOverdueCents: overdueChargesAgg._sum.amount ?? 0,
      totalPaidCents: paidChargesAgg._sum.amount ?? 0,
      totalCollectedCents: totalPaymentsAgg._sum.amount ?? 0,
      outstandingCents: (pendingChargesAgg._sum.amount ?? 0) + (overdueChargesAgg._sum.amount ?? 0),
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
