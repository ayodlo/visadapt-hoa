import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { isAdmin } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';
import { voidPayment } from '@/lib/payments';

type Params = { params: Promise<{ residentId: string; paymentId: string }> };

const schema = z.object({
  reason: z.string().trim().max(500).optional(),
});

/**
 * Reverses a payment recorded in error.
 *
 * The payment row is kept and marked VOIDED — an auditor needs to see that money
 * was entered and undone, not an absence. The reversal itself is mechanical
 * because `PaymentAllocation` recorded exactly which charges the payment paid and
 * by how much; each is subtracted back and the charge's status recomputed.
 *
 * This is what the "reverse the payment first" refusals on charge edit and delete
 * were pointing at.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();
  // Same gate as posting a charge and recording a payment: it moves a balance.
  if (!isAdmin(session.role)) return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { residentId, paymentId } = await params;

  const resident = await prisma.user.findUnique({
    where: { id: residentId, role: 'RESIDENT' },
    select: { id: true, communityId: true },
  });
  if (!resident || resident.communityId !== communityId) return notFound('Resident');

  // Scoped by resident AND community: a payment id alone must not be enough to
  // reverse money in another association's ledger.
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, residentId, communityId },
    select: {
      id: true,
      amount: true,
      status: true,
      paymentMethod: true,
      confirmationNumber: true,
      stripeCheckoutSessionId: true,
    },
  });
  if (!payment) return notFound('Payment');

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  if (payment.status === 'VOIDED') return err('This payment has already been voided', 409);

  // A failed payment never moved money or touched a charge.
  if (payment.status === 'FAILED') {
    return err('This payment failed and was never applied, so there is nothing to reverse', 409);
  }

  const result = await voidPayment({
    paymentId: payment.id,
    voidedById: session.id,
    reason: parsed.data.reason,
  });

  if (result.outcome === 'already_voided') {
    return err('This payment has already been voided', 409);
  }

  if (result.outcome === 'no_allocations') {
    return err(
      'This payment predates allocation tracking, so there is no record of which charges it paid. Adjust the charges directly instead.',
      409
    );
  }

  await createAuditLog({
    userId: session.id,
    action: 'payment.void',
    entityType: 'Payment',
    entityId: payment.id,
    // The reversed breakdown. Allocation rows are deleted so the amountPaid cache
    // stays consistent, which makes this audit entry the surviving history of what
    // the payment had paid.
    metadata: {
      residentId,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      confirmationNumber: payment.confirmationNumber,
      reason: parsed.data.reason ?? null,
      amountReversed: result.amountReversed,
      reversals: result.reversals,
      wasStripePayment: Boolean(payment.stripeCheckoutSessionId),
    },
  });

  return ok({
    voided: true,
    paymentId: payment.id,
    amountReversed: result.amountReversed,
    chargesAffected: result.reversals.length,
    // Money taken through Stripe is not refunded by this — it only corrects our
    // ledger. The refund is a separate action in the Stripe dashboard.
    refundRequired: Boolean(payment.stripeCheckoutSessionId),
  });
}
