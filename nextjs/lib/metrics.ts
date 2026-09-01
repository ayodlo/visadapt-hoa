import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import {
  METRIC_META,
  bucketRange,
  runningTotal,
  truncate,
  zeroFill,
  type Granularity,
  type MetricKey,
  type MetricPoint,
  type TimeseriesResult,
} from './metrics-shared';

type RawRow = { bucket: Date; total: bigint | number | null };

/** $queryRaw returns bigint for SUM()/COUNT() — narrow to number for JSON. */
function toRows(raw: RawRow[]): { bucket: Date; total: number }[] {
  return raw.map((r) => ({ bucket: r.bucket, total: Number(r.total ?? 0) }));
}

/**
 * Charges bucketed by `dueDate`.
 *
 * `dueDate` is deliberate: `createdAt` is unusable as a history anchor because
 * prisma/seed.ts never sets it, so every seeded charge shares the seed-run
 * timestamp and would collapse into a single bucket.
 */
function billedByBucket(communityId: string, granularity: Granularity, to: Date) {
  return prisma.$queryRaw<RawRow[]>`
    SELECT date_trunc(${granularity}, "dueDate") AS bucket, SUM(amount)::bigint AS total
    FROM charges
    WHERE "communityId" = ${communityId} AND "dueDate" <= ${to}
    GROUP BY 1 ORDER BY 1
  `;
}

/** Settled payments bucketed by when they were paid. */
function collectedByBucket(communityId: string, granularity: Granularity, to: Date, from?: Date) {
  const lowerBound = from ? Prisma.sql`AND COALESCE("paidAt", "createdAt") >= ${from}` : Prisma.empty;
  return prisma.$queryRaw<RawRow[]>`
    SELECT date_trunc(${granularity}, COALESCE("paidAt", "createdAt")) AS bucket,
           SUM(amount)::bigint AS total
    FROM payments
    WHERE "communityId" = ${communityId}
      AND status = 'PAID'
      AND COALESCE("paidAt", "createdAt") <= ${to}
      ${lowerBound}
    GROUP BY 1 ORDER BY 1
  `;
}

/** `table` is a fixed fragment chosen from a closed set, never user input. */
function countByBucket(
  table: Prisma.Sql,
  communityId: string,
  granularity: Granularity,
  from: Date,
  to: Date
) {
  return prisma.$queryRaw<RawRow[]>`
    SELECT date_trunc(${granularity}, "createdAt") AS bucket, COUNT(*)::bigint AS total
    FROM ${table}
    WHERE "communityId" = ${communityId}
      AND "createdAt" >= ${from}
      AND "createdAt" <= ${to}
    GROUP BY 1 ORDER BY 1
  `;
}

/**
 * Outstanding balance at the end of each bucket, derived as
 * `billed to date − collected to date`.
 *
 * There is no `Charge.paidAt` and no `Payment.chargeId`, so the moment a charge
 * flipped to PAID is not recorded anywhere. This ledger reconstructs the balance
 * from timestamps that are real. It can read lower than the dashboard's
 * "sum of PENDING + OVERDUE charges" when a partial payment exists, because
 * app/api/payments/me/pay/route.ts records the Payment but leaves the charge
 * PENDING until it is covered in full.
 */
async function unpaidBalanceSeries(
  communityId: string,
  granularity: Granularity,
  from: Date,
  to: Date
): Promise<MetricPoint[]> {
  const [billed, collected] = await Promise.all([
    billedByBucket(communityId, granularity, to).then(toRows),
    collectedByBucket(communityId, granularity, to).then(toRows),
  ]);

  const movement = [...billed, ...collected.map((r) => ({ ...r, total: -r.total }))];
  if (movement.length === 0) return [];

  // Accumulate from the first activity of any kind so the window opens with the
  // balance already carried into it, then keep only the requested range. When the
  // window starts before any activity, start there instead so requested periods
  // still appear on the axis at zero rather than being dropped.
  const earliest = movement.reduce((min, r) => (r.bucket < min ? r.bucket : min), movement[0].bucket);
  const start = earliest.getTime() < from.getTime() ? earliest : from;
  const balance = runningTotal(zeroFill(movement, bucketRange(start, to, granularity), granularity));

  const windowStart = truncate(from, granularity).getTime();
  return balance.filter((p) => new Date(p.bucket).getTime() >= windowStart);
}

export async function getTimeseries(
  communityId: string,
  metric: MetricKey,
  granularity: Granularity,
  from: Date,
  to: Date
): Promise<TimeseriesResult> {
  let points: MetricPoint[];

  if (metric === 'unpaid-balance') {
    points = await unpaidBalanceSeries(communityId, granularity, from, to);
  } else {
    const rows =
      metric === 'payments-collected'
        ? await collectedByBucket(communityId, granularity, to, from).then(toRows)
        : await countByBucket(
            metric === 'issues-created' ? Prisma.sql`issues` : Prisma.sql`violations`,
            communityId,
            granularity,
            from,
            to
          ).then(toRows);
    points = zeroFill(rows, bucketRange(from, to, granularity), granularity);
  }

  return {
    metric,
    granularity,
    from: from.toISOString(),
    to: to.toISOString(),
    valueKind: METRIC_META[metric].valueKind,
    points,
  };
}
