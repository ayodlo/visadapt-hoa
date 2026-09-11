import { NextRequest } from 'next/server';
import { ok, err } from '@/lib/api';
import { isStripeConfigured } from '@/lib/stripe';
import { runAutopay } from '@/lib/autopay';

/**
 * The daily autopay run.
 *
 * There is no scheduler in this codebase, so this is an HTTP endpoint meant to be
 * called by a platform cron (Vercel Cron, once the app is deployed — it needs no
 * new dependency, only a `crons` entry in the project config). Until then it can
 * be invoked by hand, which is also how it is tested.
 *
 * Auth is a shared secret rather than a session, because no user is present. Like
 * the Stripe webhook, this route is exempted from `proxy.ts` JWT gating and does
 * its own check.
 *
 * `?dryRun=1` reports what would be charged without calling Stripe, which is the
 * only safe way to look at this in an environment holding real enrolments.
 */
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return err('CRON_SECRET is not set', 503);

  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; the header is also
  // accepted from anything else that knows the secret.
  const auth = req.headers.get('authorization');
  const provided = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : null;

  if (!provided || !timingSafeEqual(provided, secret)) {
    return err('Unauthorized', 401);
  }

  if (!isStripeConfigured()) return err('Stripe is not configured', 503);

  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';

  const result = await runAutopay({ dryRun });

  console.log('[autopay] run complete', {
    dryRun,
    considered: result.considered,
    charged: result.charged,
    skipped: result.skipped,
    failed: result.failed,
    totalCents: result.totalCents,
  });

  return ok({ dryRun, ...result });
}

/**
 * Constant-time comparison, so the endpoint does not leak the secret one
 * character at a time through response timing.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
