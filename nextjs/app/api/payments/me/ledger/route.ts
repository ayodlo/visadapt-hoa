import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, unauthorized } from '@/lib/api';
import { chargeBalance } from '@/lib/charges';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const [charges, payments] = await Promise.all([
    prisma.charge.findMany({
      where: { residentId: session.id },
      orderBy: { dueDate: 'desc' },
    }),
    prisma.payment.findMany({
      where: { residentId: session.id },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const pendingCharges = charges.filter((c) => c.status === 'PENDING' || c.status === 'OVERDUE');
  // Balances are remainders: a charge with amountPaid > 0 owes amount - amountPaid.
  const totalBalance = pendingCharges.reduce((s, c) => s + chargeBalance(c), 0);
  const overdueAmount = charges
    .filter((c) => c.status === 'OVERDUE')
    .reduce((s, c) => s + chargeBalance(c), 0);
  const paidThisYear = payments
    .filter(
      (p) =>
        p.status === 'PAID' &&
        p.paidAt &&
        new Date(p.paidAt).getFullYear() === new Date().getFullYear()
    )
    .reduce((s, p) => s + p.amount, 0);

  const upcoming = charges
    .filter((c) => c.status === 'PENDING')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  return ok({
    charges,
    payments,
    summary: {
      totalBalance,
      overdueAmount,
      paidThisYear,
      nextDueDate: upcoming?.dueDate ?? null,
      nextDueAmount: upcoming ? chargeBalance(upcoming) : null,
    },
  });
}
