import { describe, it, expect, afterEach, vi } from 'vitest';
import { DEMO_ACCOUNTS, isDemoAccount, isDemoLoginEnabled } from '@/lib/demo';

describe('isDemoAccount', () => {
  it('is true for each of the three shared logins', () => {
    expect(DEMO_ACCOUNTS.map((a) => a.role)).toEqual(['RESIDENT', 'BOARD_MEMBER', 'ADMIN']);
    for (const a of DEMO_ACCOUNTS) expect(isDemoAccount(a.id)).toBe(true);
  });

  it('is false for demo neighbours and real users', () => {
    expect(isDemoAccount('demo_user_r01')).toBe(false);
    expect(isDemoAccount('cm1234567890')).toBe(false);
  });
});

describe('isDemoLoginEnabled', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is off unless NEXT_PUBLIC_DEMO_LOGIN is exactly "1"', () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_LOGIN', '');
    expect(isDemoLoginEnabled()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_DEMO_LOGIN', 'true');
    expect(isDemoLoginEnabled()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_DEMO_LOGIN', '1');
    expect(isDemoLoginEnabled()).toBe(true);
  });
});
