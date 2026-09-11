import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import { residentOutstandingBalance } from '@/lib/payments';

const schema = z.object({
  /** Cents. Optional — omit to pay the whole outstanding balance. */
  amount: z.number().int().positive().optional(),
});

/**
 * Starts a Stripe-hosted Checkout session for the signed-in resident.
 *
 * This endpoint creates NOTHING in our database. It replaces
 * /api/payments/me/pay, which wrote a PAID payment row straight from a browser
 * request and moved no money. The Payment row is now written by the webhook
 * (app/api/webhooks/stripe), which is the only party that knows a charge
 * succeeded. An abandoned Checkout therefore leaves no trace, which is the
 * behaviour we want.
 *
 * The session is created ON the community connected account (`stripeAccount`), so
 * this is a direct charge: the HOA is merchant of record, its own statement
 * descriptor appears on the resident's bank line, and disputes land with the
 * association rather than the platform.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isStripeConfigured()) return err('Online payments are not configured', 503);

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return err('NEXT_PUBLIC_APP_URL is not set', 503);

  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { id: true, name: true, stripeAccountId: true, stripeChargesEnabled: true },
  });
  if (!community) return err('No community selected', 400);

  if (!community.stripeAccountId || !community.stripeChargesEnabled) {
    return err('This community is not set up to accept online payments yet', 409);
  }

  const balance = await residentOutstandingBalance(session.id, communityId);
  if (balance === 0) return err('No outstanding balance to pay', 400);

  const amount = parsed.data.amount ?? balance;
  if (amount > balance) {
    return err(`Amount exceeds balance of $${(balance / 100).toFixed(2)}`, 400);
  }

  const stripe = getStripe();

  try {
    const checkout = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        // Payment method types are deliberately NOT pinned. Listing
        // us_bank_account would fail session creation for any HOA that has not
        // enabled ACH, so Stripe is left to offer whatever the connected account
        // actually supports.
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: amount,
              product_data: {
                name: `${community.name} — account payment`,
                description:
                  amount < balance
                    ? 'Partial payment toward your outstanding balance'
                    : 'Payment of your outstanding balance',
              },
            },
          },
        ],
        customer_email: session.email,
        // Read back by the webhook. The resident id must come from the session,
        // never from the browser, or one resident could credit another.
        metadata: {
          residentId: session.id,
          communityId,
          amount: String(amount),
        },
        success_url: `${appUrl}/resident/payments?payment=success`,
        cancel_url: `${appUrl}/resident/payments?payment=cancelled`,
      },
      // Direct charge on the HOA's own account. No statement_descriptor is set:
      // the connected account's own descriptor is the point of this design.
      { stripeAccount: community.stripeAccountId }
    );

    if (!checkout.url) return err('Stripe did not return a checkout URL', 502);

    await createAuditLog({
      userId: session.id,
      action: 'payment.checkout_started',
      entityType: 'Payment',
      entityId: checkout.id,
      metadata: { amount, communityId, balance },
    });

    return ok({ url: checkout.url, sessionId: checkout.id, amount });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Stripe request failed';
    console.error('[stripe] checkout session failed', { communityId, message });
    return err(`Could not start checkout: ${message}`, 502);
  }
}
