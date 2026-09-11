import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import {
  applyPaymentToCharges,
  chargeStatusFor,
  outstandingBalance,
  type ApplicableCharge,
} from './charges';
import type { ManualPaymentMethod } from './payment-methods';

/**
 * Receipt/confirmation number shown to residents.
 *
 * Prefix is PH (Portal HOA). The previous generator emitted `CHQ-...`, a leftover
 * of the CommunityHQ name that the 2026-09-03 rename missed because it is an
 * abbreviation rather than the spelled-out brand. Existing rows keep their old
 * numbers — they are receipts that residents may already hold, so they are
 * historical records, not strings to rewrite.
 */
export function generateConfirmationNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `PH-${ts}-${rand}`;
}

export interface RecordStripePaymentInput {
  residentId: string;
  communityId: string;
  /** Cents actually captured. */
  amount: number;
  paymentMethod: string;
  /**
   * Present for portal payments (Checkout), absent for autopay, which charges
   * off-session and never creates a session. Exactly one of these two is the
   * idempotency key — see below.
   */
  checkoutSessionId?: string | null;
  paymentIntentId: string | null;
  /**
   * PAID settles charges immediately (card). PENDING records the attempt without
   * touching charges (ACH, which can still fail days later).
   */
  status: 'PAID' | 'PENDING';
}

export type RecordStripePaymentResult =
  | { outcome: 'recorded'; paymentId: string; chargesSettled: number; amountApplied: number }
  | { outcome: 'duplicate'; paymentId: string };

/**
 * Writes a Stripe payment and applies it to the resident's charges in one
 * transaction.
 *
 * Idempotent by whichever Stripe id identifies the attempt: the checkout session
 * for a portal payment, the payment intent for an off-session autopay charge.
 * Stripe's at-least-once webhook delivery means this WILL be called twice for the
 * same money. Both columns are `@unique`, so the index is the real guard — the
 * pre-check below is only the fast path, since two concurrent deliveries can both
 * pass it.
 */
export async function recordStripePayment(
  input: RecordStripePaymentInput
): Promise<RecordStripePaymentResult> {
  const key = idempotencyKeyFor(input);

  const existing = await prisma.payment.findFirst({ where: key, select: { id: true } });
  if (existing) return { outcome: 'duplicate', paymentId: existing.id };

  try {
    return await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          residentId: input.residentId,
          communityId: input.communityId,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          status: input.status,
          paidAt: input.status === 'PAID' ? new Date() : null,
          confirmationNumber: generateConfirmationNumber(),
          stripeCheckoutSessionId: input.checkoutSessionId ?? null,
          stripePaymentIntentId: input.paymentIntentId,
        },
        select: { id: true },
      });

      if (input.status !== 'PAID') {
        return { outcome: 'recorded' as const, paymentId: payment.id, chargesSettled: 0, amountApplied: 0 };
      }

      const applied = await applyToCharges(
        tx,
        payment.id,
        input.residentId,
        input.communityId,
        input.amount
      );
      return { outcome: 'recorded' as const, paymentId: payment.id, ...applied };
    });
  } catch (e) {
    // A concurrent delivery won the race and created the row between our
    // pre-check and the insert. That is a duplicate, not a failure.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const row = await prisma.payment.findFirst({ where: key, select: { id: true } });
      if (row) return { outcome: 'duplicate', paymentId: row.id };
    }
    throw e;
  }
}

export interface RecordManualPaymentInput {
  residentId: string;
  communityId: string;
  /** Cents. */
  amount: number;
  paymentMethod: ManualPaymentMethod;
  /** The admin recording it, for the audit trail. */
  recordedById: string;
}

export interface RecordManualPaymentResult {
  paymentId: string;
  confirmationNumber: string;
  chargesSettled: number;
  amountApplied: number;
}

/**
 * Records money the association received outside Stripe, and applies it to the
 * resident's charges in the same transaction.
 *
 * The sibling of recordStripePayment: same ledger, same application order, same
 * partial-payment handling. It differs in having no external idempotency key —
 * nothing retries a human — and in being recorded PAID immediately, because the
 * admin is asserting the money is already in hand.
 */
export async function recordManualPayment(
  input: RecordManualPaymentInput
): Promise<RecordManualPaymentResult> {
  const confirmationNumber = generateConfirmationNumber();

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        residentId: input.residentId,
        communityId: input.communityId,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        status: 'PAID',
        paidAt: new Date(),
        confirmationNumber,
        // No Stripe ids: these columns stay null for offline money, which is also
        // how reconciliation tells the two apart.
      },
      select: { id: true },
    });

    const applied = await applyToCharges(
      tx,
      payment.id,
      input.residentId,
      input.communityId,
      input.amount
    );

    return { paymentId: payment.id, confirmationNumber, ...applied };
  });
}

/**
 * The Stripe id that identifies this attempt, for duplicate detection.
 *
 * Throws rather than falling back to "no key": recording money with nothing to
 * deduplicate on would let a webhook retry credit a resident twice.
 */
function idempotencyKeyFor(input: RecordStripePaymentInput) {
  if (input.checkoutSessionId) return { stripeCheckoutSessionId: input.checkoutSessionId };
  if (input.paymentIntentId) return { stripePaymentIntentId: input.paymentIntentId };
  throw new Error('recordStripePayment needs a checkout session id or a payment intent id');
}

/**
 * Promotes a previously PENDING payment (ACH) to PAID and settles charges then.
 * Charges are deliberately left untouched while a bank debit is in flight.
 */
export async function settlePendingStripePayment(
  checkoutSessionId: string
): Promise<{ settled: boolean }> {
  const payment = await prisma.payment.findUnique({
    where: { stripeCheckoutSessionId: checkoutSessionId },
    select: { id: true, residentId: true, communityId: true, amount: true, status: true },
  });
  if (!payment || payment.status === 'PAID') return { settled: false };

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'PAID', paidAt: new Date() },
    });
    await applyToCharges(tx, payment.id, payment.residentId, payment.communityId, payment.amount);
  });

  return { settled: true };
}

/** Marks a payment FAILED. Charges were never touched, so nothing to unwind. */
export async function failStripePayment(checkoutSessionId: string): Promise<{ failed: boolean }> {
  const payment = await prisma.payment.findUnique({
    where: { stripeCheckoutSessionId: checkoutSessionId },
    select: { id: true, status: true },
  });
  if (!payment || payment.status === 'PAID') return { failed: false };

  await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
  return { failed: true };
}


export interface VoidPaymentInput {
  paymentId: string;
  voidedById: string;
  reason?: string;
}

export type VoidPaymentResult =
  | { outcome: 'voided'; reversals: Array<{ chargeId: string; amount: number }>; amountReversed: number }
  | { outcome: 'already_voided' }
  | { outcome: 'no_allocations' };

/**
 * Reverses a payment.
 *
 * Mechanical, because the allocations recorded exactly what the payment did: each
 * one is subtracted from its charge, the charge's status is recomputed from the
 * result, and the payment is marked VOIDED. The payment row itself is never
 * deleted — a financial record that vanishes is worse than one marked reversed.
 *
 * Allocation rows ARE deleted, so the invariant "amountPaid equals the sum of a
 * charge's allocations" keeps holding. The caller writes the reversed breakdown to
 * the audit log, which is where the history lives.
 *
 * Returns `no_allocations` for payments that predate allocation tracking: there is
 * nothing recorded to unwind, so silently marking them voided would leave charges
 * still showing money that the ledger now says was never paid.
 */
export async function voidPayment(input: VoidPaymentInput): Promise<VoidPaymentResult> {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      select: { id: true, status: true },
    });
    if (!payment) throw new Error('Payment not found');
    if (payment.status === 'VOIDED') return { outcome: 'already_voided' as const };

    const allocations = await tx.paymentAllocation.findMany({
      where: { paymentId: payment.id },
      select: { id: true, chargeId: true, amount: true },
    });

    if (allocations.length === 0) return { outcome: 'no_allocations' as const };

    const reversals: Array<{ chargeId: string; amount: number }> = [];

    for (const allocation of allocations) {
      const charge = await tx.charge.findUnique({
        where: { id: allocation.chargeId },
        select: { id: true, amount: true, amountPaid: true, dueDate: true },
      });
      // A charge can only disappear by cascade with this payment, but guard anyway
      // rather than let a missing row abort the whole reversal.
      if (!charge) continue;

      const amountPaid = Math.max(0, charge.amountPaid - allocation.amount);

      await tx.charge.update({
        where: { id: charge.id },
        data: {
          amountPaid,
          status: chargeStatusFor({ amount: charge.amount, amountPaid, dueDate: charge.dueDate }),
        },
      });

      reversals.push({ chargeId: charge.id, amount: allocation.amount });
    }

    await tx.paymentAllocation.deleteMany({ where: { paymentId: payment.id } });

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'VOIDED',
        voidedAt: new Date(),
        voidedById: input.voidedById,
        voidReason: input.reason ?? null,
      },
    });

    return {
      outcome: 'voided' as const,
      reversals,
      amountReversed: reversals.reduce((sum, r) => sum + r.amount, 0),
    };
  });
}

/**
 * Applies money to a resident's open charges and RECORDS WHAT IT DID.
 *
 * The allocation rows are the point: without them a payment's effect is smeared
 * across charges with nothing tying the movements together, and reversing it is
 * impossible. `Charge.amountPaid` is a cache of these rows.
 */
async function applyToCharges(
  tx: Prisma.TransactionClient,
  paymentId: string,
  residentId: string,
  communityId: string,
  amount: number
): Promise<{ chargesSettled: number; amountApplied: number }> {
  const charges = await tx.charge.findMany({
    where: { residentId, communityId, status: { in: ['PENDING', 'OVERDUE'] } },
    select: { id: true, amount: true, amountPaid: true, status: true, dueDate: true },
  });

  const { applications } = applyPaymentToCharges(charges as ApplicableCharge[], amount);

  for (const app of applications) {
    await tx.charge.update({
      where: { id: app.chargeId },
      data: { amountPaid: app.amountPaid, ...(app.fullyPaid ? { status: 'PAID' as const } : {}) },
    });

    await tx.paymentAllocation.create({
      data: { paymentId, chargeId: app.chargeId, amount: app.applied },
    });
  }

  return {
    chargesSettled: applications.filter((a) => a.fullyPaid).length,
    amountApplied: applications.reduce((s, a) => s + a.applied, 0),
  };
}

/** Outstanding balance for a resident, in cents. */
export async function residentOutstandingBalance(
  residentId: string,
  communityId: string
): Promise<number> {
  const charges = await prisma.charge.findMany({
    where: { residentId, communityId, status: { in: ['PENDING', 'OVERDUE'] } },
    select: { id: true, amount: true, amountPaid: true, status: true, dueDate: true },
  });
  return outstandingBalance(charges as ApplicableCharge[]);
}
