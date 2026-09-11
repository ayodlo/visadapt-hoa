import { describe, it, expect } from 'vitest';
import {
  applicationOrder,
  applyPaymentToCharges,
  chargeBalance,
  chargeStatusFor,
  outstandingBalance,
  type ApplicableCharge,
} from '@/lib/charges';

function charge(over: Partial<ApplicableCharge> & { id: string }): ApplicableCharge {
  return {
    amount: 10000,
    amountPaid: 0,
    status: 'PENDING',
    dueDate: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('chargeBalance', () => {
  it('is the full amount when nothing has been paid', () => {
    expect(chargeBalance({ amount: 82500, amountPaid: 0 })).toBe(82500);
  });

  it('is the remainder after a partial payment', () => {
    expect(chargeBalance({ amount: 82500, amountPaid: 30000 })).toBe(52500);
  });

  it('never goes negative on an overpaid charge', () => {
    expect(chargeBalance({ amount: 10000, amountPaid: 12000 })).toBe(0);
  });
});

describe('outstandingBalance', () => {
  it('sums remainders, not face values', () => {
    const charges = [
      charge({ id: 'a', amount: 82500, amountPaid: 30000 }),
      charge({ id: 'b', amount: 10000 }),
    ];
    expect(outstandingBalance(charges)).toBe(62500);
  });

  it('ignores PAID charges', () => {
    const charges = [
      charge({ id: 'a', amount: 10000, amountPaid: 10000, status: 'PAID' }),
      charge({ id: 'b', amount: 5000 }),
    ];
    expect(outstandingBalance(charges)).toBe(5000);
  });

  it('is zero when everything is settled', () => {
    expect(outstandingBalance([charge({ id: 'a', amountPaid: 10000, status: 'PAID' })])).toBe(0);
  });
});

describe('applicationOrder', () => {
  it('puts overdue charges ahead of pending ones regardless of due date', () => {
    const order = applicationOrder([
      charge({ id: 'pending-older', dueDate: '2025-01-01T00:00:00.000Z' }),
      charge({ id: 'overdue-newer', status: 'OVERDUE', dueDate: '2026-06-01T00:00:00.000Z' }),
    ]);
    expect(order.map((c) => c.id)).toEqual(['overdue-newer', 'pending-older']);
  });

  it('orders oldest first within the same status', () => {
    const order = applicationOrder([
      charge({ id: 'newer', dueDate: '2026-06-01T00:00:00.000Z' }),
      charge({ id: 'older', dueDate: '2026-01-01T00:00:00.000Z' }),
    ]);
    expect(order.map((c) => c.id)).toEqual(['older', 'newer']);
  });

  it('drops charges with nothing left to pay', () => {
    const order = applicationOrder([
      charge({ id: 'settled', amountPaid: 10000 }),
      charge({ id: 'paid', status: 'PAID' }),
      charge({ id: 'open' }),
    ]);
    expect(order.map((c) => c.id)).toEqual(['open']);
  });

  it('does not mutate the input array', () => {
    const charges = [charge({ id: 'b', status: 'PENDING' }), charge({ id: 'a', status: 'OVERDUE' })];
    applicationOrder(charges);
    expect(charges.map((c) => c.id)).toEqual(['b', 'a']);
  });
});

describe('applyPaymentToCharges', () => {
  it('settles a charge paid in full', () => {
    const { applications, unapplied } = applyPaymentToCharges(
      [charge({ id: 'a', amount: 10000 })],
      10000
    );
    expect(unapplied).toBe(0);
    expect(applications).toEqual([{ chargeId: 'a', applied: 10000, amountPaid: 10000, fullyPaid: true }]);
  });

  /**
   * The regression this module exists for. The previous loop in
   * /api/payments/me/pay applied a charge only when the remaining amount covered
   * it in full, so $300 against an $825 assessment recorded the payment and
   * credited the charge with nothing.
   */
  it('records a partial payment against the charge instead of dropping it', () => {
    const { applications, unapplied } = applyPaymentToCharges(
      [charge({ id: 'assessment', amount: 82500 })],
      30000
    );
    expect(unapplied).toBe(0);
    expect(applications).toEqual([
      { chargeId: 'assessment', applied: 30000, amountPaid: 30000, fullyPaid: false },
    ]);
  });

  it('accumulates onto an existing partial payment and settles it', () => {
    const { applications } = applyPaymentToCharges(
      [charge({ id: 'assessment', amount: 82500, amountPaid: 30000 })],
      52500
    );
    expect(applications).toEqual([
      { chargeId: 'assessment', applied: 52500, amountPaid: 82500, fullyPaid: true },
    ]);
  });

  it('spreads across charges, settling the first and partially paying the next', () => {
    const { applications, unapplied } = applyPaymentToCharges(
      [
        charge({ id: 'old', amount: 10000, dueDate: '2026-01-01T00:00:00.000Z' }),
        charge({ id: 'new', amount: 10000, dueDate: '2026-02-01T00:00:00.000Z' }),
      ],
      15000
    );
    expect(unapplied).toBe(0);
    expect(applications).toEqual([
      { chargeId: 'old', applied: 10000, amountPaid: 10000, fullyPaid: true },
      { chargeId: 'new', applied: 5000, amountPaid: 5000, fullyPaid: false },
    ]);
  });

  it('pays overdue debt before pending debt', () => {
    const { applications } = applyPaymentToCharges(
      [
        charge({ id: 'pending', amount: 10000, dueDate: '2025-01-01T00:00:00.000Z' }),
        charge({ id: 'overdue', amount: 10000, status: 'OVERDUE', dueDate: '2026-06-01T00:00:00.000Z' }),
      ],
      10000
    );
    expect(applications).toEqual([
      { chargeId: 'overdue', applied: 10000, amountPaid: 10000, fullyPaid: true },
    ]);
  });

  it('touches only the charges it actually applies money to', () => {
    const { applications } = applyPaymentToCharges(
      [charge({ id: 'a', amount: 10000 }), charge({ id: 'b', amount: 10000 })],
      5000
    );
    expect(applications).toHaveLength(1);
    expect(applications[0].chargeId).toBe('a');
  });

  it('reports an overpayment as unapplied rather than over-crediting', () => {
    const { applications, unapplied } = applyPaymentToCharges(
      [charge({ id: 'a', amount: 10000 })],
      15000
    );
    expect(applications).toEqual([{ chargeId: 'a', applied: 10000, amountPaid: 10000, fullyPaid: true }]);
    expect(unapplied).toBe(5000);
  });

  it('applies nothing when every charge is settled', () => {
    const { applications, unapplied } = applyPaymentToCharges(
      [charge({ id: 'a', status: 'PAID', amountPaid: 10000 })],
      5000
    );
    expect(applications).toEqual([]);
    expect(unapplied).toBe(5000);
  });

  it('rejects non-positive and fractional amounts', () => {
    const charges = [charge({ id: 'a' })];
    expect(() => applyPaymentToCharges(charges, 0)).toThrow(/positive integer/);
    expect(() => applyPaymentToCharges(charges, -100)).toThrow(/positive integer/);
    expect(() => applyPaymentToCharges(charges, 10.5)).toThrow(/positive integer/);
  });

  it('keeps cents exact across a three-way split', () => {
    const { applications, unapplied } = applyPaymentToCharges(
      [
        charge({ id: 'a', amount: 3333, dueDate: '2026-01-01T00:00:00.000Z' }),
        charge({ id: 'b', amount: 3333, dueDate: '2026-02-01T00:00:00.000Z' }),
        charge({ id: 'c', amount: 3334, dueDate: '2026-03-01T00:00:00.000Z' }),
      ],
      10000
    );
    expect(unapplied).toBe(0);
    expect(applications.reduce((s, a) => s + a.applied, 0)).toBe(10000);
    expect(applications.every((a) => a.fullyPaid)).toBe(true);
  });
});

describe('chargeStatusFor', () => {
  const now = new Date('2026-09-11T14:30:00.000Z');

  it('is PAID once the balance reaches zero, whatever the due date', () => {
    expect(chargeStatusFor({ amount: 25000, amountPaid: 25000, dueDate: '2020-01-01' }, now)).toBe('PAID');
  });

  it('is PAID when overpaid', () => {
    expect(chargeStatusFor({ amount: 25000, amountPaid: 30000, dueDate: '2030-01-01' }, now)).toBe('PAID');
  });

  it('is OVERDUE when the due date has passed and money is still owed', () => {
    expect(chargeStatusFor({ amount: 25000, amountPaid: 0, dueDate: '2026-08-01' }, now)).toBe('OVERDUE');
  });

  it('is still OVERDUE when only part has been paid', () => {
    expect(chargeStatusFor({ amount: 25000, amountPaid: 10000, dueDate: '2026-08-01' }, now)).toBe('OVERDUE');
  });

  it('is PENDING when the due date is in the future', () => {
    expect(chargeStatusFor({ amount: 25000, amountPaid: 0, dueDate: '2026-12-01' }, now)).toBe('PENDING');
  });

  /** A charge due today is current — the grace runs to the end of the day. */
  it('treats a charge due today as PENDING, not OVERDUE', () => {
    expect(chargeStatusFor({ amount: 25000, amountPaid: 0, dueDate: '2026-09-11T00:00:00.000Z' }, now)).toBe(
      'PENDING'
    );
  });

  it('accepts a Date as readily as a string', () => {
    expect(chargeStatusFor({ amount: 100, amountPaid: 0, dueDate: new Date('2026-08-01') }, now)).toBe('OVERDUE');
  });
});

/**
 * Regression: a due date is a calendar day, not an instant. The forms send
 * YYYY-MM-DD, which parses to UTC midnight; comparing that against local midnight
 * marked a charge due today as OVERDUE everywhere west of UTC.
 */
describe('chargeStatusFor across timezones', () => {
  it('does not mark a charge due today as overdue in a western timezone', () => {
    // 09:00 in New York on the due date, expressed as the UTC instant it is.
    const morningInNewYork = new Date('2026-09-11T13:00:00.000Z');
    expect(
      chargeStatusFor({ amount: 25000, amountPaid: 0, dueDate: '2026-09-11' }, morningInNewYork)
    ).toBe('PENDING');
  });

  it('does not mark a charge due today as overdue in an eastern timezone', () => {
    // 09:00 in Tokyo on the due date.
    const morningInTokyo = new Date('2026-09-11T00:00:00.000Z');
    expect(
      chargeStatusFor({ amount: 25000, amountPaid: 0, dueDate: '2026-09-11' }, morningInTokyo)
    ).toBe('PENDING');
  });

  it('still marks yesterday overdue', () => {
    expect(
      chargeStatusFor(
        { amount: 25000, amountPaid: 0, dueDate: '2026-09-10' },
        new Date('2026-09-11T13:00:00.000Z')
      )
    ).toBe('OVERDUE');
  });

  it('is not overdue late on the due day itself', () => {
    expect(
      chargeStatusFor(
        { amount: 25000, amountPaid: 0, dueDate: '2026-09-11' },
        new Date('2026-09-11T23:59:00.000Z')
      )
    ).toBe('PENDING');
  });
});
