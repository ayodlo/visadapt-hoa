import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';
import { accountMirrors, canAcceptPayments, getStripe, isStripeConfigured } from '@/lib/stripe';

type Params = { params: Promise<{ id: string }> };

/**
 * Stripe Connect onboarding for one HOA.
 *
 * SUPER_ADMIN-only, matching every sibling route under
 * /api/admin/communities/[id] — an ADMIN administers the community they are in,
 * not the set of communities. Worth flagging: in production the person who
 * actually onboards an association is its manager, and the DEVLOG entry of
 * 2026-09-08 records "platform admin has no role" as still open. Follow the
 * existing pattern until that decision lands rather than inventing a role here.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'SUPER_ADMIN') return forbidden();

  const { id } = await params;
  const select = {
    id: true,
    name: true,
    stripeAccountId: true,
    stripeChargesEnabled: true,
    stripeCardPaymentsActive: true,
    stripeDetailsSubmitted: true,
    absorbsProcessingFees: true,
  } as const;
  let community = await prisma.community.findUnique({ where: { id }, select });
  if (!community) return notFound('Community');

  // Every load reads the live account and rewrites our mirrors.
  //
  // The mirrors are maintained by the account.updated webhook, which is the right
  // steady-state mechanism for the payment paths — but this page is where a human
  // decides whether an association is ready, and a missed or late webhook left it
  // showing "Accepting payments" for hours while every checkout failed. The page is
  // SUPER_ADMIN-only and rarely viewed, so one Stripe call per view is cheap, and
  // the write also repairs the mirrors the payment paths gate on.
  let refreshError: string | null = null;

  if (community.stripeAccountId && isStripeConfigured()) {
    try {
      const account = await getStripe().accounts.retrieve(community.stripeAccountId);
      community = await prisma.community.update({
        where: { id: community.id },
        data: accountMirrors(account),
        select,
      });
    } catch (e) {
      // Report the stale mirrors rather than failing the page; the webhook will
      // catch up regardless.
      refreshError = e instanceof Error ? e.message : 'Could not reach Stripe';
      console.error('[stripe] account refresh failed', { communityId: community.id, refreshError });
    }
  }

  return ok({
    ...community,
    stripeConfigured: isStripeConfigured(),
    // The only state that matters to a resident trying to pay.
    canAcceptPayments: canAcceptPayments(community),
    refreshError,
  });
}

/**
 * Creates the Express account if this community has none, then returns a fresh
 * onboarding link.
 *
 * Account links are single-use and short-lived, so this is safe to call again for
 * a community mid-onboarding — it reuses the existing account and issues a new
 * link rather than creating a second account.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'SUPER_ADMIN') return forbidden();
  if (!isStripeConfigured()) return err('Stripe is not configured on this server', 503);

  const { id } = await params;
  const community = await prisma.community.findUnique({
    where: { id },
    select: { id: true, name: true, stripeAccountId: true },
  });
  if (!community) return notFound('Community');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return err('NEXT_PUBLIC_APP_URL is not set', 503);

  const stripe = getStripe();
  let accountId = community.stripeAccountId;

  try {
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        business_profile: { name: community.name, product_description: 'HOA assessments and dues' },
        // No capability is granted by default, and each is load-bearing:
        // `card_payments` because residents pay ON the connected account (direct
        // charges), `transfers` so the money reaches the association's bank.
        // Omitting card_payments is silent until the very last step — the account
        // still reports charges_enabled: true, our mirrors still go green, and
        // Checkout still renders; only confirming the payment fails, with a
        // generic "There was an error processing your request."
        // `us_bank_account_ach_payments` is what makes Checkout offer ACH: payment
        // method types are not pinned there, so without it bank payments silently
        // never appear.
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
          us_bank_account_ach_payments: { requested: true },
        },
        metadata: { communityId: community.id },
      });
      accountId = account.id;

      await prisma.community.update({
        where: { id: community.id },
        data: { stripeAccountId: accountId },
      });

      await createAuditLog({
        userId: session.id,
        action: 'community.stripe.account_created',
        entityType: 'Community',
        entityId: community.id,
        metadata: { stripeAccountId: accountId },
      });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      // Stripe sends the user back here when the link expires or is revisited;
      // the page is expected to POST again for a fresh link.
      refresh_url: `${appUrl}/dashboard/communities/${community.id}?stripe=refresh`,
      return_url: `${appUrl}/dashboard/communities/${community.id}?stripe=return`,
    });

    return ok({ url: link.url, stripeAccountId: accountId });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Stripe request failed';
    console.error('[stripe] onboarding failed', { communityId: community.id, message });
    return err(`Stripe onboarding failed: ${message}`, 502);
  }
}
