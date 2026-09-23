import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Stripe does not order webhook deliveries, and a delivery that fails (server
 * down, deploy, dropped DB connection) is retried later. For an ACH checkout that
 * means `async_payment_succeeded` / `async_payment_failed` can be processed
 * before the `checkout.session.completed` that records the payment.
 *
 * These drive the real route handler against an in-memory ledger that follows
 * the contracts of lib/payments, so what is under test is the order in which
 * the route calls it. Seen for real on 2026-09-23: the server was down for
 * `completed`, the success event was acknowledged as a no-op, and a $12 ACH
 * payment was received but never recorded.
 */

type Status = 'PENDING' | 'PAID' | 'FAILED';

const h = vi.hoisted(() => {
  const ledger = new Map<string, { status: Status; amount: number }>();
  const payments = {
    recordStripePayment: vi.fn(
      async (input: { checkoutSessionId?: string | null; status: 'PAID' | 'PENDING'; amount: number }) => {
        const key = input.checkoutSessionId!;
        if (ledger.has(key)) return { outcome: 'duplicate' as const, paymentId: key };
        ledger.set(key, { status: input.status, amount: input.amount });
        return { outcome: 'recorded' as const, paymentId: key, chargesSettled: 0, amountApplied: 0 };
      }
    ),
    settlePendingStripePayment: vi.fn(async (sessionId: string) => {
      const row = ledger.get(sessionId);
      if (!row) return { found: false, settled: false };
      if (row.status !== 'PENDING') return { found: true, settled: false };
      row.status = 'PAID';
      return { found: true, settled: true };
    }),
    failStripePayment: vi.fn(async (sessionId: string) => {
      const row = ledger.get(sessionId);
      if (!row) return { found: false, failed: false };
      if (row.status !== 'PENDING') return { found: true, failed: false };
      row.status = 'FAILED';
      return { found: true, failed: true };
    }),
  };
  return { ledger, payments };
});

vi.mock('@/lib/payments', () => h.payments);

vi.mock('@/lib/prisma', () => ({
  prisma: {
    community: {
      findUnique: vi.fn(async () => ({ stripeAccountId: 'acct_hoa' })),
    },
  },
}));

vi.mock('@/lib/autopay', () => ({
  clearAutopayFailure: vi.fn(),
  describePaymentMethod: vi.fn(),
  recordAutopayFailure: vi.fn(),
  saveEnrollment: vi.fn(),
}));

vi.mock('@/lib/stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stripe')>();
  return {
    ...actual,
    isStripeConfigured: () => true,
    getStripe: () => ({
      // Signature verification is Stripe's own code; here the payload is the event.
      webhooks: { constructEventAsync: async (payload: string) => JSON.parse(payload) },
      paymentIntents: {
        retrieve: async () => ({
          latest_charge: { payment_method_details: { type: 'us_bank_account' } },
        }),
      },
    }),
  };
});

const { POST } = await import('@/app/api/webhooks/stripe/route');

const SESSION = 'cs_test_ach';

function sessionEvent(type: string, paymentStatus: 'paid' | 'unpaid', metadata?: Record<string, string>) {
  return {
    id: `evt_${type}`,
    type,
    account: 'acct_hoa',
    data: {
      object: {
        id: SESSION,
        mode: 'payment',
        amount_total: 1200,
        payment_status: paymentStatus,
        payment_intent: 'pi_ach',
        metadata: metadata ?? { residentId: 'res_1', communityId: 'comm_1', amount: '1200' },
      },
    },
  };
}

const completed = () => sessionEvent('checkout.session.completed', 'unpaid');
const succeeded = () => sessionEvent('checkout.session.async_payment_succeeded', 'paid');
const failed = () => sessionEvent('checkout.session.async_payment_failed', 'unpaid');

async function deliver(event: object) {
  const res = await POST(
    new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=test' },
      body: JSON.stringify(event),
    })
  );
  return res.status;
}

const statusOf = () => h.ledger.get(SESSION)?.status;

beforeEach(() => {
  h.ledger.clear();
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ACH success, in order', () => {
  it('records PENDING on completed, then settles to PAID', async () => {
    expect(await deliver(completed())).toBe(200);
    expect(statusOf()).toBe('PENDING');

    expect(await deliver(succeeded())).toBe(200);
    expect(statusOf()).toBe('PAID');
  });
});

describe('ACH success before completed', () => {
  it('records the payment PAID from the success event itself', async () => {
    expect(await deliver(succeeded())).toBe(200);
    expect(statusOf()).toBe('PAID');
    expect(h.ledger.get(SESSION)?.amount).toBe(1200);
  });

  it('leaves it PAID when the late completed arrives with its stale unpaid status', async () => {
    await deliver(succeeded());
    expect(await deliver(completed())).toBe(200);
    expect(statusOf()).toBe('PAID');
    expect(h.ledger.size).toBe(1);
  });

  it('settles a row a concurrent completed inserted between the lookup and the insert', async () => {
    // The concurrent `completed` wins the unique insert with PENDING, so the
    // success event's own record call comes back as a duplicate.
    h.payments.recordStripePayment.mockImplementationOnce(async () => {
      h.ledger.set(SESSION, { status: 'PENDING', amount: 1200 });
      return { outcome: 'duplicate' as const, paymentId: SESSION };
    });

    expect(await deliver(succeeded())).toBe(200);
    expect(statusOf()).toBe('PAID');
  });

  it('is idempotent when the success event is delivered twice', async () => {
    await deliver(succeeded());
    await deliver(succeeded());
    expect(statusOf()).toBe('PAID');
    expect(h.payments.recordStripePayment).toHaveBeenCalledTimes(1);
  });
});

describe('ACH failure', () => {
  it('marks a recorded PENDING payment FAILED', async () => {
    await deliver(completed());
    expect(await deliver(failed())).toBe(200);
    expect(statusOf()).toBe('FAILED');
  });

  it('records the attempt as FAILED when it arrives before completed', async () => {
    expect(await deliver(failed())).toBe(200);
    expect(statusOf()).toBe('FAILED');

    await deliver(completed());
    expect(statusOf()).toBe('FAILED');
  });
});

describe('sessions that are not ours', () => {
  it('credits nobody when the session has no metadata', async () => {
    expect(
      await deliver(sessionEvent('checkout.session.async_payment_succeeded', 'paid', {}))
    ).toBe(200);
    expect(h.ledger.size).toBe(0);
  });
});
