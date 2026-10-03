import { NextRequest } from 'next/server';
import { ok, err } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { resetDemoCommunity } from '@/lib/demo-seed';

/**
 * Nightly wipe-and-reseed of the public demo community (lib/demo-seed.ts).
 *
 * Anyone can sign in to the demo, so by evening it holds whatever visitors left
 * behind. Scheduled in `nextjs/vercel.json`. GET because that is what Vercel Cron
 * sends; POST for a manual run. Auth matches /api/cron/autopay: the shared
 * CRON_SECRET as a bearer token, and the route is exempt from proxy.ts JWT gating.
 */
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return err('CRON_SECRET is not set', 503);

  const auth = req.headers.get('authorization');
  const provided = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : null;

  if (!provided || !timingSafeEqual(provided, secret)) {
    return err('Unauthorized', 401);
  }

  const result = await resetDemoCommunity(prisma);
  console.log('[demo-reset] complete', result);
  return ok(result);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
