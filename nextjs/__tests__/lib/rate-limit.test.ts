import { describe, it, expect } from 'vitest';
import { createRateLimiter } from '@/lib/rate-limit';

const WINDOW = 60_000;

describe('createRateLimiter', () => {
  it('allows requests up to the limit within a window', () => {
    const limiter = createRateLimiter();
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(limiter.check('login:1.2.3.4', 5, WINDOW, now + i).allowed).toBe(true);
    }
  });

  it('blocks the request that exceeds the limit', () => {
    const limiter = createRateLimiter();
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) limiter.check('k', 5, WINDOW, now);
    const result = limiter.check('k', 5, WINDOW, now);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('reports retry-after as the remaining window in whole seconds', () => {
    const limiter = createRateLimiter();
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) limiter.check('k', 3, WINDOW, now);
    const result = limiter.check('k', 3, WINDOW, now + 30_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(30);
  });

  it('resets the counter after the window elapses', () => {
    const limiter = createRateLimiter();
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) limiter.check('k', 3, WINDOW, now);
    expect(limiter.check('k', 3, WINDOW, now).allowed).toBe(false);
    expect(limiter.check('k', 3, WINDOW, now + WINDOW).allowed).toBe(true);
  });

  it('tracks keys independently', () => {
    const limiter = createRateLimiter();
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) limiter.check('login:a', 3, WINDOW, now);
    expect(limiter.check('login:a', 3, WINDOW, now).allowed).toBe(false);
    expect(limiter.check('login:b', 3, WINDOW, now).allowed).toBe(true);
    expect(limiter.check('register:a', 3, WINDOW, now).allowed).toBe(true);
  });

  it('a blocked request does not extend or consume the window', () => {
    const limiter = createRateLimiter();
    const now = 1_000_000;
    for (let i = 0; i < 2; i++) limiter.check('k', 2, WINDOW, now);
    limiter.check('k', 2, WINDOW, now + 1); // blocked
    // window still ends at now + WINDOW
    expect(limiter.check('k', 2, WINDOW, now + WINDOW).allowed).toBe(true);
  });
});
