import { describe, it, expect } from 'vitest';
import type Stripe from 'stripe';
import { accountMirrors, canAcceptPayments } from '@/lib/stripe';

const ready = {
  stripeAccountId: 'acct_123',
  stripeChargesEnabled: true,
  stripeCardPaymentsActive: true,
};

describe('canAcceptPayments', () => {
  it('is true only with an account, charges enabled and card_payments active', () => {
    expect(canAcceptPayments(ready)).toBe(true);
  });

  /**
   * The bug this guards against: an Express account granted only `transfers`
   * reports charges_enabled: true, renders Checkout, and fails every card at
   * confirm. charges_enabled alone must never be enough.
   */
  it('is false when charges are enabled but card_payments is not active', () => {
    expect(canAcceptPayments({ ...ready, stripeCardPaymentsActive: false })).toBe(false);
  });

  it('is false when card_payments is active but charges are disabled', () => {
    expect(canAcceptPayments({ ...ready, stripeChargesEnabled: false })).toBe(false);
  });

  it('is false with no connected account', () => {
    expect(canAcceptPayments({ ...ready, stripeAccountId: null })).toBe(false);
  });
});

describe('accountMirrors', () => {
  const account = (overrides: Partial<Stripe.Account>) =>
    ({ id: 'acct_123', charges_enabled: true, details_submitted: true, ...overrides }) as Stripe.Account;

  it('mirrors an active card_payments capability', () => {
    expect(accountMirrors(account({ capabilities: { card_payments: 'active' } }))).toEqual({
      stripeChargesEnabled: true,
      stripeCardPaymentsActive: true,
      stripeDetailsSubmitted: true,
    });
  });

  it.each(['pending', 'inactive'] as const)('treats a %s capability as not active', (status) => {
    expect(accountMirrors(account({ capabilities: { card_payments: status } })).stripeCardPaymentsActive).toBe(false);
  });

  it('treats a never-requested capability as not active', () => {
    // What every account created before 2026-09-22 looked like: transfers only.
    expect(accountMirrors(account({ capabilities: { transfers: 'active' } })).stripeCardPaymentsActive).toBe(false);
    expect(accountMirrors(account({ capabilities: undefined })).stripeCardPaymentsActive).toBe(false);
  });
});
