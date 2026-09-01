/**
 * Types, constants, and pure helpers for dashboard trend metrics.
 *
 * This file exists separately from `lib/metrics.ts` for the same reason
 * `lib/roles.ts` exists separately from `lib/auth.ts`: client components cannot
 * import a module that pulls in Prisma. Everything here is safe on both sides.
 */

export const GRANULARITIES = ['week', 'month', 'quarter', 'year'] as const;
export type Granularity = (typeof GRANULARITIES)[number];

export const GRANULARITY_LABELS: Record<Granularity, { short: string; full: string }> = {
  week: { short: 'W', full: 'Weekly' },
  month: { short: 'M', full: 'Monthly' },
  quarter: { short: 'Q', full: 'Quarterly' },
  year: { short: 'Y', full: 'Yearly' },
};

export const METRIC_KEYS = [
  'unpaid-balance',
  'payments-collected',
  'issues-created',
  'violations-created',
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export type ValueKind = 'currency' | 'count';

export interface MetricPoint {
  /** Bucket start, ISO date (UTC). */
  bucket: string;
  /** Axis label, e.g. `2026-01`. */
  label: string;
  /** Cents for `currency` metrics, a plain count otherwise. */
  value: number;
}

export interface TimeseriesResult {
  metric: MetricKey;
  granularity: Granularity;
  from: string;
  to: string;
  valueKind: ValueKind;
  points: MetricPoint[];
}

export const METRIC_META: Record<
  MetricKey,
  { title: string; valueKind: ValueKind; cumulative: boolean; help: string }
> = {
  'unpaid-balance': {
    title: 'Unpaid Balance',
    valueKind: 'currency',
    cumulative: true,
    help: 'Outstanding balance at the end of each period, derived as charges billed to date minus payments collected to date. Charges are counted by their due date.',
  },
  'payments-collected': {
    title: 'Payments Collected',
    valueKind: 'currency',
    cumulative: false,
    help: 'Total of settled payments in each period, counted by the date the payment was made.',
  },
  'issues-created': {
    title: 'Issues Created',
    valueKind: 'count',
    cumulative: false,
    help: 'Maintenance issues submitted in each period.',
  },
  'violations-created': {
    title: 'Violations Created',
    valueKind: 'count',
    cumulative: false,
    help: 'Violations recorded in each period.',
  },
};

export function isGranularity(value: string): value is Granularity {
  return (GRANULARITIES as readonly string[]).includes(value);
}

export function isMetricKey(value: string): value is MetricKey {
  return (METRIC_KEYS as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------ */
/* Range presets                                                       */
/* ------------------------------------------------------------------ */

export const RANGE_PRESETS = ['3m', '6m', '12m', 'ytd'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const DEFAULT_RANGE: RangePreset = '12m';

export const RANGE_LABELS: Record<RangePreset, string> = {
  '3m': '3M',
  '6m': '6M',
  '12m': '12M',
  ytd: 'YTD',
};

export function isRangePreset(value: string): value is RangePreset {
  return (RANGE_PRESETS as readonly string[]).includes(value);
}

/** Resolve a preset to an absolute [from, to] window ending now. */
export function resolveRange(preset: RangePreset, now = new Date()): { from: Date; to: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const months: Record<Exclude<RangePreset, 'ytd'>, number> = { '3m': 2, '6m': 5, '12m': 11 };
  const from =
    preset === 'ytd' ? new Date(Date.UTC(y, 0, 1)) : new Date(Date.UTC(y, m - months[preset], 1));
  return { from, to: now };
}

/* ------------------------------------------------------------------ */
/* Pure bucket helpers — mirror Postgres date_trunc semantics in UTC.  */
/* Prisma maps DateTime to timestamp(3) (no time zone) and stores UTC, */
/* so truncating in UTC here lines up with date_trunc in the query.    */
/* ------------------------------------------------------------------ */

/** Start of the bucket `date` falls in. Weeks start Monday, as in Postgres. */
export function truncate(date: Date, granularity: Granularity): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  switch (granularity) {
    case 'week': {
      // getUTCDay(): 0 = Sunday. Postgres weeks start Monday.
      const shift = (date.getUTCDay() + 6) % 7;
      return new Date(Date.UTC(y, m, date.getUTCDate() - shift));
    }
    case 'month':
      return new Date(Date.UTC(y, m, 1));
    case 'quarter':
      return new Date(Date.UTC(y, m - (m % 3), 1));
    case 'year':
      return new Date(Date.UTC(y, 0, 1));
  }
}

/** The bucket immediately after `date`'s bucket. */
export function nextBucket(date: Date, granularity: Granularity): Date {
  const start = truncate(date, granularity);
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  switch (granularity) {
    case 'week':
      return new Date(Date.UTC(y, m, start.getUTCDate() + 7));
    case 'month':
      return new Date(Date.UTC(y, m + 1, 1));
    case 'quarter':
      return new Date(Date.UTC(y, m + 3, 1));
    case 'year':
      return new Date(Date.UTC(y + 1, 0, 1));
  }
}

/** Every bucket start from `from`'s bucket through `to`'s bucket, inclusive. */
export function bucketRange(from: Date, to: Date, granularity: Granularity): Date[] {
  const buckets: Date[] = [];
  const end = truncate(to, granularity);
  let cursor = truncate(from, granularity);
  while (cursor.getTime() <= end.getTime()) {
    buckets.push(cursor);
    cursor = nextBucket(cursor, granularity);
  }
  return buckets;
}

export function bucketLabel(date: Date, granularity: Granularity): string {
  const y = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  switch (granularity) {
    case 'week':
      return `${y}-${mm}-${String(date.getUTCDate()).padStart(2, '0')}`;
    case 'month':
      return `${y}-${mm}`;
    case 'quarter':
      return `${y}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
    case 'year':
      return `${y}`;
  }
}

/** Bucket key used to join query rows to the generated range. */
function bucketKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Expand sparse query rows across every bucket in the range so periods with no
 * activity still render on the axis instead of collapsing the timeline.
 */
export function zeroFill(
  rows: { bucket: Date; total: number }[],
  buckets: Date[],
  granularity: Granularity
): MetricPoint[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const k = bucketKey(truncate(row.bucket, granularity));
    totals.set(k, (totals.get(k) ?? 0) + row.total);
  }
  return buckets.map((b) => ({
    bucket: b.toISOString(),
    label: bucketLabel(b, granularity),
    value: totals.get(bucketKey(b)) ?? 0,
  }));
}

/** Running total across points — turns per-period movement into a balance. */
export function runningTotal(points: MetricPoint[], opening = 0): MetricPoint[] {
  let acc = opening;
  return points.map((p) => {
    acc += p.value;
    return { ...p, value: acc };
  });
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** Full-precision value for tooltips and the table view. */
export function formatMetricValue(value: number, kind: ValueKind): string {
  if (kind !== 'currency') return value.toLocaleString('en-US');
  return (value / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/**
 * Compact value for axis ticks, where space is tight. The sign leads the symbol
 * so a credit balance reads as `-$5k`, not `$-5k`.
 */
export function formatAxisValue(value: number, kind: ValueKind): string {
  if (kind !== 'currency') return value.toLocaleString('en-US');
  const dollars = value / 100;
  const sign = dollars < 0 ? '-' : '';
  const magnitude = Math.abs(dollars);
  if (magnitude >= 1000) return `${sign}$${Math.round(magnitude / 1000)}k`;
  return `${sign}$${Math.round(magnitude)}`;
}

/**
 * Period-over-period change between the last two points.
 * Returns null when there is no prior period to compare against.
 */
export function periodChange(points: MetricPoint[]): { delta: number; pct: number | null } | null {
  if (points.length < 2) return null;
  const latest = points[points.length - 1].value;
  const previous = points[points.length - 2].value;
  const delta = latest - previous;
  return { delta, pct: previous === 0 ? null : (delta / Math.abs(previous)) * 100 };
}
