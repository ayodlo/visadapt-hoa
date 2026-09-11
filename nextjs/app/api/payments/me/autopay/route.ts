import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, notFound } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import { describeMethodLabel } from '@/lib/autopay';

/**
 * The resident's own autopay: see it, start it, pause it, cancel it.
 *
 * Enrolment itself happens through Stripe-hosted Checkout in `setup` mode (see
 * ./setup), so no card details ever reach this application and no client-side
 * Stripe library is needed — the same reasoning that chose hosted Checkout for
 * one-off payments.
 */

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const [enrollment, community] = await Promise.all([
    prisma.autopayEnrollment.findUnique({
      where: { userId: session.id },
      select: {
        enabled: true,
        enabledAt: true,
        methodType: true,
        methodBrand: true,
        methodLast4: true,
        lastRunAt: true,
        lastFailureAt: true,
        lastFailureMessage: true,
      },
    }),
    prisma.community.findUnique({
      where: { id: communityId },
      select: { stripeAccountId: true, stripeChargesEnabled: true },
    }),
  ]);

  return ok({
    enrolled: Boolean(enrollment),
    enabled: enrollment?.enabled ?? false,
    method: enrollment ? describeMethodLabel(enrollment) : null,
    methodType: enrollment?.methodType ?? null,
    enabledAt: enrollment?.enabledAt ?? null,
    lastRunAt: enrollment?.lastRunAt ?? null,
    lastFailureAt: enrollment?.lastFailureAt ?? null,
    lastFailureMessage: enrollment?.lastFailureMessage ?? null,
    // Autopay cannot be offered at all until the association can take money.
    available:
      isStripeConfigured() &&
      Boolean(community?.stripeAccountId) &&
      Boolean(community?.stripeChargesEnabled),
  });
}

const patchSchema = z.object({ enabled: z.boolean() });

/** Pauses or resumes autopay without discarding the saved method. */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const enrollment = await prisma.autopayEnrollment.findUnique({
    where: { userId: session.id },
    select: { id: true },
  });
  if (!enrollment) return notFound('Autopay enrollment');

  await prisma.autopayEnrollment.update({
    where: { id: enrollment.id },
    data: { enabled: parsed.data.enabled },
  });

  await createAuditLog({
    userId: session.id,
    action: parsed.data.enabled ? 'autopay.resume' : 'autopay.pause',
    entityType: 'AutopayEnrollment',
    entityId: enrollment.id,
  });

  return ok({ enabled: parsed.data.enabled });
}

/**
 * Cancels autopay outright and detaches the saved method at Stripe.
 *
 * Detaching is best-effort: if it fails, the enrolment is still removed here,
 * because a resident who asked to stop must stop. A method left attached is
 * harmless — nothing will reference it once the row is gone.
 */
export async function DELETE() {
  const session = await getSession();
  if (!session) return unauthorized();

  const enrollment = await prisma.autopayEnrollment.findUnique({
    where: { userId: session.id },
    select: { id: true, stripePaymentMethodId: true, communityId: true },
  });
  if (!enrollment) return notFound('Autopay enrollment');

  const community = await prisma.community.findUnique({
    where: { id: enrollment.communityId },
    select: { stripeAccountId: true },
  });

  if (isStripeConfigured() && community?.stripeAccountId) {
    try {
      await getStripe().paymentMethods.detach(
        enrollment.stripePaymentMethodId,
        {},
        { stripeAccount: community.stripeAccountId }
      );
    } catch (e) {
      console.error('[autopay] could not detach payment method', {
        userId: session.id,
        message: e instanceof Error ? e.message : 'unknown error',
      });
    }
  }

  await prisma.autopayEnrollment.delete({ where: { id: enrollment.id } });

  await createAuditLog({
    userId: session.id,
    action: 'autopay.cancel',
    entityType: 'AutopayEnrollment',
    entityId: enrollment.id,
  });

  return ok({ cancelled: true });
}
