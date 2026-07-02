import { describe, it, expect } from 'vitest';
import { formatDollars } from '@/lib/dashboard';

describe('formatDollars', () => {
  it('formats zero cents as $0.00', () => {
    expect(formatDollars(0)).toBe('$0.00');
  });

  it('formats 100 cents as $1.00', () => {
    expect(formatDollars(100)).toBe('$1.00');
  });

  it('formats 25000 cents as $250.00', () => {
    expect(formatDollars(25000)).toBe('$250.00');
  });

  it('formats 345000 cents as $3,450.00', () => {
    expect(formatDollars(345000)).toBe('$3,450.00');
  });

  it('formats a non-round amount correctly', () => {
    expect(formatDollars(9999)).toBe('$99.99');
  });
});

// Pure balance calculation helper — extracted from getResidentDashboard logic
function calculateBalance(charges: { amount: number }[]): number {
  return charges.reduce((sum, c) => sum + c.amount, 0);
}

describe('balance calculation', () => {
  it('sums charge amounts correctly', () => {
    expect(calculateBalance([{ amount: 5000 }, { amount: 12000 }])).toBe(17000);
  });

  it('returns 0 for empty charge list', () => {
    expect(calculateBalance([])).toBe(0);
  });
});

// Pure avg resolution helper
function calcAvgResolutionDays(issues: { createdAt: Date; updatedAt: Date }[]): number | null {
  if (issues.length === 0) return null;
  const totalMs = issues.reduce((acc, i) => acc + (i.updatedAt.getTime() - i.createdAt.getTime()), 0);
  return Math.round(totalMs / issues.length / 86_400_000);
}

describe('calcAvgResolutionDays', () => {
  it('returns null for empty list', () => {
    expect(calcAvgResolutionDays([])).toBeNull();
  });

  it('returns 7 for issues resolved in exactly 7 days', () => {
    const created = new Date('2026-01-01T00:00:00Z');
    const updated = new Date('2026-01-08T00:00:00Z');
    expect(calcAvgResolutionDays([{ createdAt: created, updatedAt: updated }])).toBe(7);
  });

  it('averages correctly across multiple issues', () => {
    const base = new Date('2026-01-01T00:00:00Z');
    const day = 86_400_000;
    const issues = [
      { createdAt: base, updatedAt: new Date(base.getTime() + 2 * day) }, // 2 days
      { createdAt: base, updatedAt: new Date(base.getTime() + 4 * day) }, // 4 days
    ];
    // average = 3 days
    expect(calcAvgResolutionDays(issues)).toBe(3);
  });
});

// Decision queue count logic
function calcDecisionQueueCount(archRequests: number, escalated: number, pendingAppeals: number): number {
  return archRequests + escalated + pendingAppeals;
}

describe('calcDecisionQueueCount', () => {
  it('sums all three queue sources', () => {
    expect(calcDecisionQueueCount(3, 1, 2)).toBe(6);
  });

  it('returns 0 when all queues are empty', () => {
    expect(calcDecisionQueueCount(0, 0, 0)).toBe(0);
  });
});
