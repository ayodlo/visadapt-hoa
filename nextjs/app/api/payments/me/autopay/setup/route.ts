import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';
import { getStripe, isStripeConfigured } from '@/lib/stripe';

/**
 * Starts enrolment in autopay.
 *
 * Uses Checkout in `setup` mode rather than Elements: it saves a card or bank
 * account to a Customer through Stripe's own hosted page, which means no card
 * details touch this application, no client-side Stripe library is needed, and
 * the resident sees the same flow they already use to pay a one-off balance.
 *
 * The Customer is created ON the community's connected account, because these are
 * direct charges — a saved method belongs to the association, not the platform.
 * `User.stripeCustomerId` can hold a single value only because a RESIDENT belongs
 * to exactly one community.
 *
 * Nothing is stored until the webhook sees the completed session; abandoning the
 * flow leaves no enrolment behind.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isStripeConfigured()) return err('Online payments are not configured', 503);

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return err('NEXT_PUBLIC_APP_URL is not set', 503);

  const [community, user] = await Promise.all([
    prisma.community.findUnique({
      where: { id: communityId },
      select: { id: true, name: true, stripeAccountId: true, stripeChargesEnabled: true },
    }),
    prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, email: true, firstName: true, lastName: true, stripeCustomerId: true },
    }),
  ]);

  if (!community || !user) return err('No community selected', 400);

  if (!community.stripeAccountId || !community.stripeChargesEnabled) {
    return err('This community is not set up to accept online payments yet', 409);
  }

  const stripe = getStripe();

  try {
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          metadata: { residentId: user.id, communityId },
        },
        { stripeAccount: community.stripeAccountId }
      );
      customerId = customer.id;

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const checkout = await stripe.checkout.sessions.create(
      {
        mode: 'setup',
        customer: customerId,
        // Read back by the webhook, which is what actually saves the enrolment.
        metadata: { residentId: user.id, communityId, purpose: 'autopay' },
        success_url: `${appUrl}/resident/payments?autopay=saved`,
        cancel_url: `${appUrl}/resident/payments?autopay=cancelled`,
      },
      { stripeAccount: community.stripeAccountId }
    );

    if (!checkout.url) return err('Stripe did not return a setup URL', 502);

    await createAuditLog({
      userId: user.id,
      action: 'autopay.setup_started',
      entityType: 'AutopayEnrollment',
      entityId: checkout.id,
      metadata: { communityId },
    });

    return ok({ url: checkout.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Stripe request failed';
    console.error('[autopay] setup session failed', { communityId, message });
    return err(`Could not start autopay setup: ${message}`, 502);
  }
}
