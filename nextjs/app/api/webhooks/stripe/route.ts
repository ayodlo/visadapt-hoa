import { NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { ok, err } from '@/lib/api';
import { accountMirrors, getStripe, isStripeConfigured, paymentMethodLabel } from '@/lib/stripe';
import { failStripePayment, recordStripePayment, settlePendingStripePayment } from '@/lib/payments';
import {
  clearAutopayFailure,
  describePaymentMethod,
  recordAutopayFailure,
  saveEnrollment,
} from '@/lib/autopay';

/**
 * Stripe webhook — the ONLY place a payment is recorded as received.
 *
 * Two things about this route are load-bearing:
 *
 * 1. It must be reachable without a session. `proxy.ts` gates every path except
 *    PUBLIC_PATHS and /api/auth, and Stripe's POST carries no JWT, so an
 *    unexempted webhook 401s before this handler ever runs. /api/webhooks is
 *    exempted there; the signature check below is what stands in for auth.
 * 2. The body must be read as raw text. Signature verification hashes the exact
 *    bytes Stripe sent, so `req.json()` would break it.
 *
 * Charges are created ON the connected accounts (direct charges), so payment
 * events arrive as Connect events with `event.account` set to the HOA's account.
 */
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) return err('Stripe is not configured', 503);

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return err('STRIPE_WEBHOOK_SECRET is not set', 503);

  const signature = req.headers.get('stripe-signature');
  if (!signature) return err('Missing stripe-signature header', 400);

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    // Async variant: uses WebCrypto rather than the sync node:crypto API.
    event = await getStripe().webhooks.constructEventAsync(payload, signature, secret);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    console.error('[stripe] webhook signature verification failed', message);
    // 400 so Stripe marks the delivery failed and retries — a 200 here would
    // silently swallow a misconfigured secret.
    return err(`Webhook signature verification failed: ${message}`, 400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        // Two very different things arrive as this one event. A 'setup' session
        // saved a payment method for autopay and moved no money; a 'payment'
        // session took money. Branching on mode keeps them from being confused.
        if (event.data.object.mode === 'setup') {
          await handleAutopaySetupCompleted(event.data.object, event.account ?? null);
        } else {
          await handleCheckoutCompleted(event.data.object, event.account ?? null);
        }
        break;

      // Stripe does not order deliveries, and a failed checkout.session.completed
      // is retried later, so the outcome of an ACH debit can arrive before the
      // payment it settles has been recorded. Acknowledging that as a no-op would
      // lose the outcome for good: the late `completed` still carries
      // payment_status 'unpaid' and would leave the payment PENDING forever.
      // Instead, record the payment from this event's session (which carries the
      // same metadata) and then apply the outcome. The second settle/fail also
      // covers a concurrent `completed` winning the insert, which makes the
      // record call a duplicate that left the row PENDING.
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        let result = await settlePendingStripePayment(session.id);
        const recordedFromSession = !result.found;
        if (recordedFromSession) {
          await handleCheckoutCompleted(session, event.account ?? null);
          result = await settlePendingStripePayment(session.id);
        }
        console.log('[stripe] async payment succeeded', {
          sessionId: session.id,
          settled: result.settled,
          recordedFromSession,
        });
        break;
      }

      case 'checkout.session.async_payment_failed': {
        const session = event.data.object;
        let result = await failStripePayment(session.id);
        const recordedFromSession = !result.found;
        if (recordedFromSession) {
          await handleCheckoutCompleted(session, event.account ?? null);
          result = await failStripePayment(session.id);
        }
        console.log('[stripe] async payment failed', {
          sessionId: session.id,
          recorded: result.failed,
          recordedFromSession,
        });
        break;
      }

      // Autopay charges off-session, so they never create a Checkout session and
      // arrive here instead. Portal payments also emit these, and are ignored:
      // their checkout.session.completed already recorded them, and
      // recordStripePayment would treat a second call as a duplicate anyway.
      case 'payment_intent.succeeded':
        await handleAutopayIntentSucceeded(event.data.object, event.account ?? null);
        break;

      case 'payment_intent.payment_failed':
        await handleAutopayIntentFailed(event.data.object);
        break;

      case 'account.updated':
        await handleAccountUpdated(event.data.object);
        break;

      default:
        // Unhandled types are acknowledged, not errored — Stripe retries non-2xx,
        // and an endpoint subscribed to more than it handles is normal.
        break;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    console.error('[stripe] webhook handler failed', { type: event.type, id: event.id, message });
    // 500 so Stripe retries. Handlers are idempotent, so a retry is safe.
    return err('Webhook handler failed', 500);
  }

  return ok({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, account: string | null) {
  const residentId = session.metadata?.residentId;
  const communityId = session.metadata?.communityId;

  if (!residentId || !communityId) {
    // Not one of ours (or metadata was stripped). Nothing safe to credit.
    console.error('[stripe] checkout.session.completed without metadata', { sessionId: session.id });
    return;
  }

  // The session belongs to a connected account; confirm it is the account we have
  // on file for that community before crediting anyone. Without this check a
  // session from an unrelated account could credit a resident here.
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { stripeAccountId: true },
  });
  if (!community || (account && community.stripeAccountId !== account)) {
    console.error('[stripe] checkout session account mismatch', {
      sessionId: session.id,
      eventAccount: account,
      communityId,
    });
    return;
  }

  const amount = session.amount_total;
  if (amount === null || amount <= 0) {
    console.error('[stripe] checkout session with no amount_total', { sessionId: session.id });
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  // 'paid' means the money is captured (cards). 'unpaid' with a payment intent is
  // the ACH case: the debit is in flight and can still fail days later, so the
  // payment is recorded PENDING and charges are left alone until it settles.
  const status = session.payment_status === 'paid' ? 'PAID' : 'PENDING';

  const methodType = await resolvePaymentMethodType(session, account);

  const result = await recordStripePayment({
    residentId,
    communityId,
    amount,
    paymentMethod: paymentMethodLabel(methodType),
    checkoutSessionId: session.id,
    paymentIntentId,
    status,
  });

  console.log('[stripe] checkout completed', {
    sessionId: session.id,
    status,
    outcome: result.outcome,
    ...(result.outcome === 'recorded'
      ? { chargesSettled: result.chargesSettled, amountApplied: result.amountApplied }
      : {}),
  });
}

/**
 * A resident finished the hosted setup flow, so the method they chose becomes
 * their autopay enrolment.
 *
 * The payment method is read off the SetupIntent rather than trusted from the
 * session, and the session's account is checked against the community on file for
 * the same reason the payment path checks it.
 */
async function handleAutopaySetupCompleted(session: Stripe.Checkout.Session, account: string | null) {
  const residentId = session.metadata?.residentId;
  const communityId = session.metadata?.communityId;

  if (!residentId || !communityId || session.metadata?.purpose !== 'autopay') {
    console.error('[stripe] setup session without autopay metadata', { sessionId: session.id });
    return;
  }

  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { stripeAccountId: true },
  });
  if (!community || (account && community.stripeAccountId !== account)) {
    console.error('[stripe] setup session account mismatch', { sessionId: session.id, communityId });
    return;
  }

  const setupIntentId =
    typeof session.setup_intent === 'string' ? session.setup_intent : session.setup_intent?.id;
  if (!setupIntentId) {
    console.error('[stripe] setup session with no setup_intent', { sessionId: session.id });
    return;
  }

  const intent = await getStripe().setupIntents.retrieve(
    setupIntentId,
    { expand: ['payment_method'] },
    account ? { stripeAccount: account } : undefined
  );

  const pm = intent.payment_method;
  if (!pm || typeof pm === 'string') {
    console.error('[stripe] setup intent has no expanded payment method', { setupIntentId });
    return;
  }

  await saveEnrollment({
    userId: residentId,
    communityId,
    method: describePaymentMethod(pm),
  });

  console.log('[autopay] enrollment saved', { residentId, communityId, methodType: pm.type });
}

/**
 * An off-session autopay charge succeeded.
 *
 * Recorded exactly like a portal payment — same ledger, same allocations — keyed
 * on the payment intent, since there is no checkout session to key on.
 */
async function handleAutopayIntentSucceeded(intent: Stripe.PaymentIntent, account: string | null) {
  if (intent.metadata?.autopay !== 'true') return;

  const residentId = intent.metadata?.residentId;
  const communityId = intent.metadata?.communityId;
  if (!residentId || !communityId) {
    console.error('[autopay] succeeded intent without metadata', { intentId: intent.id });
    return;
  }

  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { stripeAccountId: true },
  });
  if (!community || (account && community.stripeAccountId !== account)) {
    console.error('[autopay] intent account mismatch', { intentId: intent.id, communityId });
    return;
  }

  const charge = intent.latest_charge;
  const methodType =
    charge && typeof charge !== 'string' ? (charge.payment_method_details?.type ?? null) : null;

  const result = await recordStripePayment({
    residentId,
    communityId,
    amount: intent.amount_received || intent.amount,
    paymentMethod: paymentMethodLabel(methodType),
    paymentIntentId: intent.id,
    status: 'PAID',
  });

  // Money arrived, so whatever failed last time is no longer true.
  await clearAutopayFailure(residentId);

  console.log('[autopay] charge recorded', {
    intentId: intent.id,
    residentId,
    outcome: result.outcome,
  });
}

/**
 * An off-session autopay charge failed — including an ACH debit that bounces days
 * after it was accepted, which the create call could not have told us about.
 * Nothing is recorded against the ledger; the enrolment is flagged so the failure
 * surfaces in the AR view.
 */
async function handleAutopayIntentFailed(intent: Stripe.PaymentIntent) {
  if (intent.metadata?.autopay !== 'true') return;

  const residentId = intent.metadata?.residentId;
  if (!residentId) return;

  const error = intent.last_payment_error;
  await recordAutopayFailure(
    residentId,
    error?.decline_code ?? error?.code ?? null,
    error?.message ?? 'The payment was declined'
  );

  console.log('[autopay] charge failed', { intentId: intent.id, residentId, code: error?.code });
}

/**
 * Which payment method the resident actually used, for the receipt label.
 *
 * `session.payment_method_types` lists what was offered, not what was used, so the
 * real answer lives on the charge behind the payment intent. Best-effort: a
 * failure here must not fail the webhook, since the payment itself is fine.
 */
async function resolvePaymentMethodType(
  session: Stripe.Checkout.Session,
  account: string | null
): Promise<string | null> {
  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  if (!paymentIntentId) return null;

  try {
    const intent = await getStripe().paymentIntents.retrieve(
      paymentIntentId,
      { expand: ['latest_charge'] },
      account ? { stripeAccount: account } : undefined
    );
    const charge = intent.latest_charge;
    if (charge && typeof charge !== 'string') {
      return charge.payment_method_details?.type ?? null;
    }
  } catch (e) {
    console.error('[stripe] could not resolve payment method type', {
      sessionId: session.id,
      message: e instanceof Error ? e.message : 'unknown error',
    });
  }
  return null;
}

/** Keeps our mirrors of charges_enabled / card_payments / details_submitted honest. */
async function handleAccountUpdated(account: Stripe.Account) {
  const community = await prisma.community.findFirst({
    where: { stripeAccountId: account.id },
    select: { id: true },
  });
  if (!community) return;

  await prisma.community.update({
    where: { id: community.id },
    data: accountMirrors(account),
  });

  console.log('[stripe] account updated', {
    accountId: account.id,
    communityId: community.id,
    chargesEnabled: account.charges_enabled,
    cardPayments: account.capabilities?.card_payments ?? null,
  });
}
