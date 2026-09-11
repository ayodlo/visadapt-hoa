import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { chargeBalance, outstandingBalance, type ApplicableCharge } from '@/lib/charges';
import { isAdmin } from '@/lib/roles';
import { createAuditLog } from '@/lib/audit';
import { recordManualPayment } from '@/lib/payments';
import { MANUAL_PAYMENT_METHODS } from '@/lib/payment-methods';
import { z } from 'zod';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ residentId: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { residentId } = await params;
  const resident = await prisma.user.findUnique({
    where: { id: residentId, role: 'RESIDENT' },
    select: { id: true, firstName: true, lastName: true, email: true, communityId: true },
  });
  if (!resident || resident.communityId !== communityId) return notFound('Resident');

  const [charges, payments] = await Promise.all([
    prisma.charge.findMany({ where: { residentId }, orderBy: { dueDate: 'desc' } }),
    prisma.payment.findMany({ where: { residentId }, orderBy: { createdAt: 'desc' } }),
  ]);

  const balance = charges.filter((c) => c.status === 'PENDING' || c.status === 'OVERDUE').reduce((s, c) => s + chargeBalance(c), 0);
  const overdueAmount = charges.filter((c) => c.status === 'OVERDUE').reduce((s, c) => s + chargeBalance(c), 0);

  return ok({ resident, charges, payments, summary: { balance, overdueAmount } });
}

const recordSchema = z.object({
  /** Cents. */
  amount: z.number().int().positive('Amount must be greater than zero'),
  paymentMethod: z.enum(MANUAL_PAYMENT_METHODS),
});

/**
 * Records a payment the association received outside Stripe — a cheque, cash, or a
 * wire straight to its bank.
 *
 * Card payments are NOT recordable here. They go through Checkout, where the
 * webhook is the only thing that may declare money received; hand-entering one
 * would recreate the hole that deleting /api/payments/me/pay closed.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ residentId: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  // Same gate as posting a charge: this moves someone's balance.
  if (!isAdmin(session.role)) return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { residentId } = await params;
  const resident = await prisma.user.findUnique({
    where: { id: residentId, role: 'RESIDENT' },
    select: { id: true, communityId: true },
  });
  if (!resident || resident.communityId !== communityId) return notFound('Resident');

  const body = await req.json().catch(() => null);
  const parsed = recordSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const { amount, paymentMethod } = parsed.data;

  // Refuse an overpayment rather than parking a credit: there is no credit-balance
  // concept anywhere in this schema, so the money would apply to nothing and the
  // ledger would quietly disagree with the bank.
  const openCharges = await prisma.charge.findMany({
    where: { residentId, communityId, status: { in: ['PENDING', 'OVERDUE'] } },
    select: { id: true, amount: true, amountPaid: true, status: true, dueDate: true },
  });
  const balance = outstandingBalance(openCharges as ApplicableCharge[]);

  if (balance === 0) return err('This resident has no outstanding balance', 400);
  if (amount > balance) {
    return err(`Amount exceeds the outstanding balance of $${(balance / 100).toFixed(2)}`, 400);
  }

  const result = await recordManualPayment({
    residentId,
    communityId,
    amount,
    paymentMethod,
    recordedById: session.id,
  });

  await createAuditLog({
    userId: session.id,
    action: 'payment.record_manual',
    entityType: 'Payment',
    entityId: result.paymentId,
    metadata: {
      residentId,
      amount,
      paymentMethod,
      confirmationNumber: result.confirmationNumber,
      chargesSettled: result.chargesSettled,
      balanceBefore: balance,
    },
  });

  return ok(
    {
      payment: {
        id: result.paymentId,
        confirmationNumber: result.confirmationNumber,
        amount,
        paymentMethod,
      },
      chargesSettled: result.chargesSettled,
      amountApplied: result.amountApplied,
    },
    201
  );
}
