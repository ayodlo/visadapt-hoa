import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Fixed-window, in-memory rate limiter for the auth endpoints.
 *
 * Scope caveat: state lives in module memory, so limits apply per server
 * process. On a single Node server that is a real global limit; on
 * serverless (Vercel) each warm instance counts separately, so treat this
 * as brute-force friction, not a hard guarantee. A shared store (Upstash
 * Redis or similar) is the production-grade upgrade path.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const MAX_BUCKETS = 10_000;

export function createRateLimiter() {
  const buckets = new Map<string, Bucket>();

  function check(key: string, limit: number, windowMs: number, now = Date.now()) {
    // Opportunistic sweep so the map cannot grow unbounded under key churn
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, b] of buckets) {
        if (b.resetAt <= now) buckets.delete(k);
      }
    }

    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (bucket.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      };
    }
    bucket.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return { check };
}

const limiter = createRateLimiter();

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Returns null when the request is allowed, or a ready-to-return 429
 * response when the caller has exceeded `limit` requests per `windowMs`.
 */
export function rateLimit(
  req: NextRequest,
  route: string,
  limit: number,
  windowMs: number
): NextResponse | null {
  const result = limiter.check(`${route}:${clientIp(req)}`, limit, windowMs);
  if (result.allowed) return null;
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } }
  );
}
