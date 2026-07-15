import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { signToken, verifyToken } from '@/lib/auth';

const payload = {
  id: 'user-abc-123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'RESIDENT' as const,
  communityId: 'community-abc-123',
};

describe('signToken', () => {
  it('returns a non-empty string', () => {
    const token = signToken(payload);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('produces a three-part JWT', () => {
    const token = signToken(payload);
    expect(token.split('.')).toHaveLength(3);
  });
});

describe('verifyToken', () => {
  it('returns the original payload for a valid token', () => {
    const token = signToken(payload);
    const result = verifyToken(token);
    expect(result?.id).toBe(payload.id);
    expect(result?.email).toBe(payload.email);
    expect(result?.firstName).toBe(payload.firstName);
    expect(result?.lastName).toBe(payload.lastName);
    expect(result?.role).toBe(payload.role);
  });

  it('returns null for a malformed token', () => {
    expect(verifyToken('not.a.token')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(verifyToken('')).toBeNull();
  });

  it('returns null for a token signed with a different secret', () => {
    const foreignToken = jwt.sign(payload, 'different-secret-entirely');
    expect(verifyToken(foreignToken)).toBeNull();
  });

  it('returns null for an expired token', () => {
    const expiredToken = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: -1 });
    expect(verifyToken(expiredToken)).toBeNull();
  });
});
