import { describe, it, expect } from 'vitest';
import { MANUAL_PAYMENT_METHODS } from '@/lib/payment-methods';

describe('MANUAL_PAYMENT_METHODS', () => {
  it('offers the ways money reaches an HOA outside Stripe', () => {
    expect(MANUAL_PAYMENT_METHODS).toEqual(['Check', 'Cash', 'Bank Transfer', 'Money Order']);
  });

  /**
   * The guard that matters. Deleting /api/payments/me/pay removed the only way to
   * mark a balance paid without money behind it; allowing an admin to hand-enter a
   * card payment would put it straight back. Card and debit go through Checkout,
   * where the webhook is the only thing that may declare money received.
   */
  it('does not let a card payment be entered by hand', () => {
    const methods = MANUAL_PAYMENT_METHODS as readonly string[];
    expect(methods).not.toContain('Credit Card');
    expect(methods).not.toContain('Debit Card');
    expect(methods.some((m) => m.toLowerCase().includes('card'))).toBe(false);
  });

  it('is safe for a client component to import', async () => {
    // lib/payments.ts pulls in Prisma, so the list lives apart from it — the same
    // split as lib/roles.ts vs lib/auth.ts. If this module ever grows a Prisma
    // import, the admin payments page breaks at runtime, not at build time.
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../../lib/payment-methods.ts', import.meta.url), 'utf8')
    );
    expect(source).not.toMatch(/from '@?\/?prisma/);
    expect(source).not.toMatch(/@prisma\/client/);
    expect(source).not.toMatch(/next\/headers/);
  });
});
