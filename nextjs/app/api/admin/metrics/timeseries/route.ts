import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { ok, err, unauthorized, forbidden } from '@/lib/api';
import { getTimeseries } from '@/lib/metrics';
import { GRANULARITIES, METRIC_KEYS, RANGE_PRESETS, resolveRange } from '@/lib/metrics-shared';

const schema = z.object({
  metric: z.enum(METRIC_KEYS),
  granularity: z.enum(GRANULARITIES),
  range: z.enum(RANGE_PRESETS),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { searchParams } = req.nextUrl;
  const parsed = schema.safeParse({
    metric: searchParams.get('metric') ?? undefined,
    granularity: searchParams.get('granularity') ?? undefined,
    range: searchParams.get('range') ?? undefined,
  });
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const { metric, granularity, range } = parsed.data;
  const { from, to } = resolveRange(range);

  const series = await getTimeseries(communityId, metric, granularity, from, to);
  return ok(series);
}
