import { describe, it, expect } from 'vitest';
import {
  bucketLabel,
  bucketRange,
  formatAxisValue,
  formatMetricValue,
  isGranularity,
  isMetricKey,
  isRangePreset,
  nextBucket,
  periodChange,
  resolveRange,
  runningTotal,
  truncate,
  zeroFill,
} from '@/lib/metrics-shared';

const utc = (iso: string) => new Date(iso);

describe('truncate', () => {
  it('snaps to the first of the month', () => {
    expect(truncate(utc('2026-06-17T13:45:00Z'), 'month').toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('snaps weeks back to Monday, matching Postgres date_trunc', () => {
    // 2026-06-17 is a Wednesday.
    expect(truncate(utc('2026-06-17T00:00:00Z'), 'week').toISOString()).toBe('2026-06-15T00:00:00.000Z');
  });

  it('keeps a Monday on its own week', () => {
    expect(truncate(utc('2026-06-15T00:00:00Z'), 'week').toISOString()).toBe('2026-06-15T00:00:00.000Z');
  });

  it('pulls a Sunday back to the preceding Monday, not forward', () => {
    // 2026-06-21 is a Sunday; Postgres puts it in the week starting the 15th.
    expect(truncate(utc('2026-06-21T00:00:00Z'), 'week').toISOString()).toBe('2026-06-15T00:00:00.000Z');
  });

  it('snaps quarters to their opening month', () => {
    expect(truncate(utc('2026-08-31T00:00:00Z'), 'quarter').toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(truncate(utc('2026-01-05T00:00:00Z'), 'quarter').toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('snaps years to January 1', () => {
    expect(truncate(utc('2026-08-31T23:59:59Z'), 'year').toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('nextBucket', () => {
  it('rolls over a year boundary for months', () => {
    expect(nextBucket(utc('2026-12-10T00:00:00Z'), 'month').toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('advances a week by seven days across a month boundary', () => {
    expect(nextBucket(utc('2026-06-29T00:00:00Z'), 'week').toISOString()).toBe('2026-07-06T00:00:00.000Z');
  });

  it('advances quarters by three months', () => {
    expect(nextBucket(utc('2026-11-02T00:00:00Z'), 'quarter').toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('bucketRange', () => {
  it('includes both endpoints', () => {
    const range = bucketRange(utc('2026-03-14T00:00:00Z'), utc('2026-06-02T00:00:00Z'), 'month');
    expect(range.map((d) => bucketLabel(d, 'month'))).toEqual(['2026-03', '2026-04', '2026-05', '2026-06']);
  });

  it('returns a single bucket when both dates share one', () => {
    const range = bucketRange(utc('2026-06-02T00:00:00Z'), utc('2026-06-29T00:00:00Z'), 'month');
    expect(range).toHaveLength(1);
  });

  it('returns nothing when the window runs backwards', () => {
    expect(bucketRange(utc('2026-06-01T00:00:00Z'), utc('2026-03-01T00:00:00Z'), 'month')).toEqual([]);
  });
});

describe('bucketLabel', () => {
  it('formats each granularity distinctly', () => {
    const d = utc('2026-08-31T00:00:00Z');
    expect(bucketLabel(truncate(d, 'month'), 'month')).toBe('2026-08');
    expect(bucketLabel(truncate(d, 'quarter'), 'quarter')).toBe('2026-Q3');
    expect(bucketLabel(truncate(d, 'year'), 'year')).toBe('2026');
    expect(bucketLabel(truncate(d, 'week'), 'week')).toBe('2026-08-31');
  });
});

describe('zeroFill', () => {
  const buckets = bucketRange(utc('2026-03-01T00:00:00Z'), utc('2026-06-01T00:00:00Z'), 'month');

  it('fills gaps and trailing empty periods with zero', () => {
    const rows = [{ bucket: utc('2026-04-01T00:00:00Z'), total: 500 }];
    expect(zeroFill(rows, buckets, 'month').map((p) => p.value)).toEqual([0, 500, 0, 0]);
  });

  it('keeps every requested bucket even when there are no rows at all', () => {
    expect(zeroFill([], buckets, 'month')).toHaveLength(4);
  });

  it('sums multiple rows landing in the same bucket', () => {
    const rows = [
      { bucket: utc('2026-05-01T00:00:00Z'), total: 100 },
      { bucket: utc('2026-05-01T00:00:00Z'), total: -30 },
    ];
    expect(zeroFill(rows, buckets, 'month')[2].value).toBe(70);
  });

  it('truncates row dates before matching, so untruncated input still lands', () => {
    const rows = [{ bucket: utc('2026-05-22T09:13:00Z'), total: 42 }];
    expect(zeroFill(rows, buckets, 'month')[2].value).toBe(42);
  });

  it('ignores rows outside the requested range', () => {
    const rows = [{ bucket: utc('2025-01-01T00:00:00Z'), total: 999 }];
    expect(zeroFill(rows, buckets, 'month').map((p) => p.value)).toEqual([0, 0, 0, 0]);
  });
});

describe('runningTotal', () => {
  const buckets = bucketRange(utc('2026-03-01T00:00:00Z'), utc('2026-06-01T00:00:00Z'), 'month');

  it('accumulates period movement into a balance', () => {
    const points = zeroFill(
      [
        { bucket: utc('2026-03-01T00:00:00Z'), total: 1000 },
        { bucket: utc('2026-04-01T00:00:00Z'), total: -400 },
        { bucket: utc('2026-05-01T00:00:00Z'), total: 250 },
      ],
      buckets,
      'month'
    );
    expect(runningTotal(points).map((p) => p.value)).toEqual([1000, 600, 850, 850]);
  });

  it('carries an opening balance into the first bucket', () => {
    const points = zeroFill([{ bucket: utc('2026-03-01T00:00:00Z'), total: 100 }], buckets, 'month');
    expect(runningTotal(points, 500)[0].value).toBe(600);
  });

  it('models the billed-minus-collected ledger settling back to zero', () => {
    // Charges billed in March and April, both paid off by May.
    const points = zeroFill(
      [
        { bucket: utc('2026-03-01T00:00:00Z'), total: 25000 },
        { bucket: utc('2026-04-01T00:00:00Z'), total: 25000 },
        { bucket: utc('2026-03-01T00:00:00Z'), total: -25000 },
        { bucket: utc('2026-05-01T00:00:00Z'), total: -25000 },
      ],
      buckets,
      'month'
    );
    expect(runningTotal(points).map((p) => p.value)).toEqual([0, 25000, 0, 0]);
  });
});

describe('periodChange', () => {
  const point = (label: string, value: number) => ({ bucket: label, label, value });

  it('returns null with fewer than two points', () => {
    expect(periodChange([])).toBeNull();
    expect(periodChange([point('2026-01', 5)])).toBeNull();
  });

  it('reports a percentage rise', () => {
    const result = periodChange([point('2026-01', 200), point('2026-02', 300)]);
    expect(result).toEqual({ delta: 100, pct: 50 });
  });

  it('reports a fall as a negative delta', () => {
    const result = periodChange([point('2026-01', 400), point('2026-02', 300)]);
    expect(result?.delta).toBe(-100);
    expect(result?.pct).toBe(-25);
  });

  it('returns a null percentage when the previous period was zero', () => {
    expect(periodChange([point('2026-01', 0), point('2026-02', 80)])?.pct).toBeNull();
  });

  it('uses the magnitude of a negative base so the sign tracks direction', () => {
    const result = periodChange([point('2026-01', -200), point('2026-02', -100)]);
    expect(result?.delta).toBe(100);
    expect(result?.pct).toBe(50);
  });
});

describe('resolveRange', () => {
  const now = utc('2026-08-31T12:00:00Z');

  it('spans whole months back, inclusive of the current one', () => {
    expect(resolveRange('3m', now).from.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(resolveRange('6m', now).from.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(resolveRange('12m', now).from.toISOString()).toBe('2025-09-01T00:00:00.000Z');
  });

  it('starts year-to-date on January 1', () => {
    expect(resolveRange('ytd', now).from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('always ends at the reference time', () => {
    expect(resolveRange('3m', now).to).toEqual(now);
  });

  it('produces exactly the promised number of month buckets', () => {
    const { from, to } = resolveRange('3m', now);
    expect(bucketRange(from, to, 'month')).toHaveLength(3);
  });
});

describe('formatting', () => {
  it('renders currency from cents', () => {
    expect(formatMetricValue(125000, 'currency')).toBe('$1,250.00');
    expect(formatMetricValue(0, 'currency')).toBe('$0.00');
  });

  it('renders counts without a currency symbol', () => {
    expect(formatMetricValue(1500, 'count')).toBe('1,500');
  });

  it('abbreviates thousands on the axis', () => {
    expect(formatAxisValue(125000, 'currency')).toBe('$1k');
    expect(formatAxisValue(45000, 'currency')).toBe('$450');
    expect(formatAxisValue(12, 'count')).toBe('12');
  });

  it('puts the sign before the currency symbol on credit balances', () => {
    // A prepayment can carry the ledger below zero; `$-5k` reads as a typo.
    expect(formatAxisValue(-500000, 'currency')).toBe('-$5k');
    expect(formatAxisValue(-45000, 'currency')).toBe('-$450');
    expect(formatMetricValue(-500000, 'currency')).toBe('-$5,000.00');
  });
});

describe('input guards', () => {
  it('accepts only known values', () => {
    expect(isGranularity('month')).toBe(true);
    expect(isGranularity('decade')).toBe(false);
    expect(isMetricKey('unpaid-balance')).toBe(true);
    expect(isMetricKey('drop table')).toBe(false);
    expect(isRangePreset('ytd')).toBe(true);
    expect(isRangePreset('all')).toBe(false);
  });
});
