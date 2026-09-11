import type Stripe from 'stripe';
import { prisma } from './prisma';
import { getStripe, paymentMethodLabel } from './stripe';
import { residentOutstandingBalance } from './payments';

/**
 * Autopay: charging a saved payment method without the resident present.
 *
 * The shape of this follows from the direct-charge design. Because charges are
 * created ON each HOA's connected account, the Customer and PaymentMethod live
 * there too — so a saved method belongs to one association, not to the platform.
 * That is workable only because a RESIDENT has exactly one fixed community.
 */

/** How Stripe describes the saved method, reduced to what we display. */
export interface SavedMethod {
  stripePaymentMethodId: string;
  methodType: string;
  methodBrand: string | null;
  methodLast4: string;
}

/**
 * Pulls the displayable bits off a PaymentMethod.
 *
 * Cards carry brand and last4; US bank accounts carry the bank name and the last
 * four of the account number. Anything else is stored with what it has, rather
 * than rejected — a method we cannot label is still a method that can pay.
 */
export function describePaymentMethod(pm: Stripe.PaymentMethod): SavedMethod {
  if (pm.type === 'card' && pm.card) {
    return {
      stripePaymentMethodId: pm.id,
      methodType: 'card',
      methodBrand: pm.card.brand ?? null,
      methodLast4: pm.card.last4 ?? '',
    };
  }

  if (pm.type === 'us_bank_account' && pm.us_bank_account) {
    return {
      stripePaymentMethodId: pm.id,
      methodType: 'us_bank_account',
      methodBrand: pm.us_bank_account.bank_name ?? null,
      methodLast4: pm.us_bank_account.last4 ?? '',
    };
  }

  return { stripePaymentMethodId: pm.id, methodType: pm.type, methodBrand: null, methodLast4: '' };
}

/** "Visa ···· 4242" / "ACH ···· 4821", for the AR view and the resident portal. */
export function describeMethodLabel(e: {
  methodType: string;
  methodBrand: string | null;
  methodLast4: string;
}): string {
  const name =
    e.methodType === 'us_bank_account'
      ? (e.methodBrand ?? 'ACH')
      : (e.methodBrand ?? paymentMethodLabel(e.methodType));
  const pretty = name.charAt(0).toUpperCase() + name.slice(1);
  return e.methodLast4 ? `${pretty} •••• ${e.methodLast4}` : pretty;
}

/**
 * Records a completed enrolment, replacing any previous one for that resident.
 *
 * Enabling on save is deliberate: the resident went through a hosted setup flow
 * they had to opt into, so treating that as consent to charge is what they expect.
 * Re-enrolling clears any prior failure — a new method deserves a clean slate.
 */
export async function saveEnrollment(input: {
  userId: string;
  communityId: string;
  method: SavedMethod;
}) {
  const data = {
    communityId: input.communityId,
    stripePaymentMethodId: input.method.stripePaymentMethodId,
    methodType: input.method.methodType,
    methodBrand: input.method.methodBrand,
    methodLast4: input.method.methodLast4,
    enabled: true,
    enabledAt: new Date(),
    lastFailureAt: null,
    lastFailureCode: null,
    lastFailureMessage: null,
  };

  return prisma.autopayEnrollment.upsert({
    where: { userId: input.userId },
    create: { userId: input.userId, ...data },
    update: data,
  });
}

export interface AutopayRunResult {
  considered: number;
  charged: number;
  skipped: number;
  failed: number;
  totalCents: number;
  details: Array<{
    userId: string;
    outcome: 'charged' | 'skipped' | 'failed';
    amount?: number;
    reason?: string;
  }>;
}

/**
 * Charges every enabled enrolment that owes money.
 *
 * Intended to run daily. There is no scheduler in this codebase, so the caller is
 * an HTTP endpoint that a platform cron hits — see app/api/cron/autopay.
 *
 * Safety properties, in the order they matter:
 *
 *  - **Never charges twice in a day.** `lastRunAt` is checked first and written
 *    whatever the outcome, and the Stripe call carries a per-resident-per-day
 *    idempotency key, so even a duplicate invocation cannot take money twice.
 *  - **Never charges more than is owed.** The amount is the outstanding balance
 *    computed at run time, not a stored figure.
 *  - **Never records the payment itself.** The webhook does that, exactly as with
 *    portal payments; this only starts the intent.
 *  - **One resident's failure cannot stop the run.** Each is caught and recorded.
 */
export async function runAutopay(options: { now?: Date; dryRun?: boolean } = {}): Promise<AutopayRunResult> {
  const now = options.now ?? new Date();
  const result: AutopayRunResult = {
    considered: 0,
    charged: 0,
    skipped: 0,
    failed: 0,
    totalCents: 0,
    details: [],
  };

  const enrollments = await prisma.autopayEnrollment.findMany({
    where: { enabled: true },
    select: {
      id: true,
      userId: true,
      communityId: true,
      stripePaymentMethodId: true,
      lastRunAt: true,
      user: { select: { id: true, email: true, stripeCustomerId: true } },
      community: {
        select: { id: true, name: true, stripeAccountId: true, stripeChargesEnabled: true },
      },
    },
  });

  for (const enrollment of enrollments) {
    result.considered += 1;

    const skip = (reason: string) => {
      result.skipped += 1;
      result.details.push({ userId: enrollment.userId, outcome: 'skipped', reason });
    };

    if (enrollment.lastRunAt && sameUtcDay(enrollment.lastRunAt, now)) {
      skip('already attempted today');
      continue;
    }

    if (!enrollment.community.stripeAccountId || !enrollment.community.stripeChargesEnabled) {
      skip('community cannot accept payments');
      continue;
    }

    if (!enrollment.user.stripeCustomerId) {
      skip('no stripe customer');
      continue;
    }

    const balance = await residentOutstandingBalance(enrollment.userId, enrollment.communityId);
    if (balance <= 0) {
      // Not a failure and not interesting — most residents on most days.
      skip('nothing owed');
      continue;
    }

    if (options.dryRun) {
      result.details.push({ userId: enrollment.userId, outcome: 'charged', amount: balance });
      result.charged += 1;
      result.totalCents += balance;
      continue;
    }

    // Written before the charge, not after: if the process dies mid-call, the
    // next run must not try again blind.
    await prisma.autopayEnrollment.update({
      where: { id: enrollment.id },
      data: { lastRunAt: now },
    });

    try {
      await getStripe().paymentIntents.create(
        {
          amount: balance,
          currency: 'usd',
          customer: enrollment.user.stripeCustomerId,
          payment_method: enrollment.stripePaymentMethodId,
          // The resident is not in the browser, so Stripe needs telling that this
          // is a merchant-initiated charge against a method they already approved.
          off_session: true,
          confirm: true,
          description: `${enrollment.community.name} — automatic payment`,
          metadata: {
            residentId: enrollment.userId,
            communityId: enrollment.communityId,
            autopay: 'true',
          },
        },
        {
          stripeAccount: enrollment.community.stripeAccountId,
          // Belt and braces alongside lastRunAt: Stripe itself will refuse to
          // create a second intent for this resident on this day.
          idempotencyKey: `autopay_${enrollment.userId}_${utcDayKey(now)}`,
        }
      );

      await prisma.autopayEnrollment.update({
        where: { id: enrollment.id },
        data: { lastFailureAt: null, lastFailureCode: null, lastFailureMessage: null },
      });

      result.charged += 1;
      result.totalCents += balance;
      result.details.push({ userId: enrollment.userId, outcome: 'charged', amount: balance });
    } catch (e) {
      const { code, message } = describeStripeError(e);

      await prisma.autopayEnrollment.update({
        where: { id: enrollment.id },
        data: { lastFailureAt: now, lastFailureCode: code, lastFailureMessage: message },
      });

      result.failed += 1;
      result.details.push({ userId: enrollment.userId, outcome: 'failed', reason: message });
      console.error('[autopay] charge failed', { userId: enrollment.userId, code, message });
    }
  }

  return result;
}

/**
 * Records a failure that arrived later, via webhook rather than from the create
 * call — an ACH debit that bounces days after it was accepted.
 */
export async function recordAutopayFailure(
  userId: string,
  code: string | null,
  message: string | null,
  at: Date = new Date()
) {
  await prisma.autopayEnrollment.updateMany({
    where: { userId },
    data: { lastFailureAt: at, lastFailureCode: code, lastFailureMessage: message },
  });
}

/** Clears the failure flag once money actually lands. */
export async function clearAutopayFailure(userId: string) {
  await prisma.autopayEnrollment.updateMany({
    where: { userId },
    data: { lastFailureAt: null, lastFailureCode: null, lastFailureMessage: null },
  });
}

function describeStripeError(e: unknown): { code: string | null; message: string } {
  if (e && typeof e === 'object' && 'type' in e) {
    const err = e as { code?: string; decline_code?: string; message?: string };
    return {
      code: err.decline_code ?? err.code ?? null,
      message: err.message ?? 'Stripe rejected the payment',
    };
  }
  return { code: null, message: e instanceof Error ? e.message : 'Unknown error' };
}

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sameUtcDay(a: Date, b: Date): boolean {
  return utcDayKey(a) === utcDayKey(b);
}
