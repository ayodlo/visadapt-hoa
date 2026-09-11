import Stripe from 'stripe';

/**
 * Pinned to the API version the installed SDK was generated against
 * (`node_modules/stripe/esm/apiVersion.d.ts`). Bump this only together with the
 * `stripe` dependency, never on its own — the two are a matched pair.
 */
export const STRIPE_API_VERSION = '2026-08-26.dahlia' satisfies Stripe.LatestApiVersion;

let client: Stripe | null = null;

/**
 * Lazy singleton. Deliberately NOT constructed at module scope: route modules are
 * evaluated during `next build`, where STRIPE_SECRET_KEY is absent, and a throwing
 * constructor there would fail the build rather than the request.
 */
export function getStripe(): Stripe {
  if (client) return client;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');

  client = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
  return client;
}

/** True when the server has enough configuration to talk to Stripe at all. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Maps a Stripe payment method type onto the `Payment.paymentMethod` strings this
 * app already stores, so Stripe rows read the same as the historical ones rather
 * than introducing a second vocabulary.
 */
export function paymentMethodLabel(type: string | null | undefined): string {
  switch (type) {
    case 'card':
      return 'Credit Card';
    case 'us_bank_account':
    case 'acss_debit':
    case 'sepa_debit':
      return 'Bank Transfer';
    default:
      return 'Card';
  }
}
