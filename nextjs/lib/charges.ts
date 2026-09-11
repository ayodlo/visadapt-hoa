/**
 * Applying money to charges.
 *
 * Kept free of Prisma so it can be unit-tested directly: this is the one place
 * where a payment turns into a set of charge updates, and getting it wrong means
 * getting someone's balance wrong.
 *
 * The old `/api/payments/me/pay` loop paid charges only when the remaining amount
 * covered a charge in full and silently dropped the rest (`// partial: leave
 * charge as-is, just stop`). That was survivable while payments were simulated
 * and the UI pre-filled the full balance; it is not survivable with real money,
 * where someone pays $300 against an $825 balance.
 */

export type ApplicableChargeStatus = 'PENDING' | 'OVERDUE' | 'PAID';

export interface ApplicableCharge {
  id: string;
  amount: number;
  amountPaid: number;
  status: ApplicableChargeStatus;
  dueDate: Date | string;
}

export interface ChargeApplication {
  chargeId: string;
  /** Amount applied to this charge by this payment, in cents. Always > 0. */
  applied: number;
  /** The charge's new cumulative amountPaid. */
  amountPaid: number;
  /** True when this application settles the charge in full. */
  fullyPaid: boolean;
}

export interface AppliedPayment {
  applications: ChargeApplication[];
  /** Cents that could not be applied because every charge was settled. */
  unapplied: number;
}

/** What is still owed on a single charge. Never negative, even if overpaid. */
export function chargeBalance(charge: Pick<ApplicableCharge, 'amount' | 'amountPaid'>): number {
  return Math.max(0, charge.amount - charge.amountPaid);
}

/** What is still owed across charges. PAID charges contribute nothing. */
export function outstandingBalance(charges: ApplicableCharge[]): number {
  return charges.filter((c) => c.status !== 'PAID').reduce((sum, c) => sum + chargeBalance(c), 0);
}

/**
 * Oldest debt first, overdue ahead of merely pending. Matches the order the
 * previous implementation intended (`orderBy: [{ status: 'desc' }, { dueDate:
 * 'asc' }]`, where 'OVERDUE' > 'PENDING' alphabetically) but states it
 * explicitly instead of leaning on enum string ordering.
 */
export function applicationOrder(charges: ApplicableCharge[]): ApplicableCharge[] {
  const rank = (s: ApplicableChargeStatus) => (s === 'OVERDUE' ? 0 : 1);
  return [...charges]
    .filter((c) => c.status !== 'PAID' && chargeBalance(c) > 0)
    .sort((a, b) => {
      const byStatus = rank(a.status) - rank(b.status);
      if (byStatus !== 0) return byStatus;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
}

/**
 * Spreads `amount` across the given charges, oldest/overdue first, allowing a
 * partial application to the charge the money runs out on.
 *
 * Returns only the charges actually touched, so a caller can write exactly those
 * rows. `unapplied` is non-zero only when the payment exceeds the total balance,
 * which callers should reject before getting here.
 */
export function applyPaymentToCharges(charges: ApplicableCharge[], amount: number): AppliedPayment {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Payment amount must be a positive integer number of cents');
  }

  const applications: ChargeApplication[] = [];
  let remaining = amount;

  for (const charge of applicationOrder(charges)) {
    if (remaining <= 0) break;

    const balance = chargeBalance(charge);
    const applied = Math.min(remaining, balance);
    const amountPaid = charge.amountPaid + applied;

    applications.push({
      chargeId: charge.id,
      applied,
      amountPaid,
      fullyPaid: amountPaid >= charge.amount,
    });

    remaining -= applied;
  }

  return { applications, unapplied: remaining };
}

/**
 * The status a charge should carry, given what it is owed and when it was due.
 *
 * Single source of truth for the rule, used when a charge is created and when it
 * is edited, so the two cannot drift. Note this is evaluated only at write time:
 * nothing in this codebase re-evaluates it as time passes, so a PENDING charge
 * does not become OVERDUE on its own. Deriving status at read time with this same
 * function is the obvious fix and would make the stored column redundant.
 *
 * **Compared as calendar days in UTC, deliberately.** A due date is a date, not an
 * instant: the forms send `YYYY-MM-DD`, and `new Date('2026-09-11')` parses that as
 * UTC midnight. Comparing that against *local* midnight marks a charge due today
 * as overdue for anyone west of UTC — the whole of the Americas — because UTC
 * midnight on the due date is the previous evening locally. Both sides are
 * therefore reduced to a UTC calendar day before comparing.
 */
export function chargeStatusFor(
  charge: Pick<ApplicableCharge, 'amount' | 'amountPaid'> & { dueDate: Date | string },
  now: Date = new Date()
): ApplicableChargeStatus {
  if (chargeBalance(charge) === 0) return 'PAID';

  // A charge due today is current — the grace runs to the end of its due day.
  return utcDayNumber(new Date(charge.dueDate)) < utcDayNumber(now) ? 'OVERDUE' : 'PENDING';
}

/** Days since the epoch in UTC, collapsing an instant to a calendar day. */
function utcDayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000);
}
