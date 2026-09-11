import { describe, it, expect } from 'vitest';
import { describeMethodLabel, describePaymentMethod } from '@/lib/autopay';

/**
 * These cover the parts of autopay that are pure: turning a Stripe PaymentMethod
 * into the few fields worth storing, and rendering the label the AR view shows.
 * The charging run itself is exercised live, since it is Prisma- and Stripe-bound.
 */
describe('describePaymentMethod', () => {
  it('reduces a card to brand and last4', () => {
    expect(
      describePaymentMethod({
        id: 'pm_card',
        type: 'card',
        card: { brand: 'visa', last4: '4242' },
      } as never)
    ).toEqual({
      stripePaymentMethodId: 'pm_card',
      methodType: 'card',
      methodBrand: 'visa',
      methodLast4: '4242',
    });
  });

  it('reduces a bank account to bank name and last4', () => {
    expect(
      describePaymentMethod({
        id: 'pm_bank',
        type: 'us_bank_account',
        us_bank_account: { bank_name: 'STRIPE TEST BANK', last4: '4821' },
      } as never)
    ).toEqual({
      stripePaymentMethodId: 'pm_bank',
      methodType: 'us_bank_account',
      methodBrand: 'STRIPE TEST BANK',
      methodLast4: '4821',
    });
  });

  /** A method we cannot label is still a method that can pay. */
  it('keeps an unfamiliar method rather than discarding it', () => {
    expect(describePaymentMethod({ id: 'pm_x', type: 'cashapp' } as never)).toEqual({
      stripePaymentMethodId: 'pm_x',
      methodType: 'cashapp',
      methodBrand: null,
      methodLast4: '',
    });
  });

  it('survives a card with missing details', () => {
    const result = describePaymentMethod({ id: 'pm_partial', type: 'card', card: {} } as never);
    expect(result.methodBrand).toBeNull();
    expect(result.methodLast4).toBe('');
  });
});

describe('describeMethodLabel', () => {
  it('renders a card the way the mockup does', () => {
    expect(
      describeMethodLabel({ methodType: 'card', methodBrand: 'visa', methodLast4: '4242' })
    ).toBe('Visa •••• 4242');
  });

  it('renders a bank account with its bank name', () => {
    expect(
      describeMethodLabel({
        methodType: 'us_bank_account',
        methodBrand: 'STRIPE TEST BANK',
        methodLast4: '4821',
      })
    ).toBe('STRIPE TEST BANK •••• 4821');
  });

  it('falls back to ACH for a bank account with no name', () => {
    expect(
      describeMethodLabel({ methodType: 'us_bank_account', methodBrand: null, methodLast4: '4821' })
    ).toBe('ACH •••• 4821');
  });

  it('omits the separator when there is no last4', () => {
    expect(describeMethodLabel({ methodType: 'card', methodBrand: 'visa', methodLast4: '' })).toBe(
      'Visa'
    );
  });
});
