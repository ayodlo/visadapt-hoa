import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * The demo logins are shared by every visitor and their password is printed on
 * the login page. If one visitor could change that password, or an admin visitor
 * could delete or demote a demo account, every later visitor would be locked out
 * until the nightly reset. These drive the real routes to prove they refuse.
 */

const h = vi.hoisted(() => ({
  session: { id: 'demo_user_admin', role: 'ADMIN', communityId: null } as { id: string; role: string; communityId: string | null },
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
    },
    passwordResetToken: { create: vi.fn(async () => ({})) },
  },
  sendPasswordResetEmail: vi.fn(async () => {}),
}));

vi.mock('@/lib/auth', () => ({ getSession: vi.fn(async () => h.session) }));
vi.mock('@/lib/prisma', () => ({ prisma: h.prisma }));
vi.mock('@/lib/community', () => ({ getActiveCommunityId: vi.fn(async () => 'community_public_demo') }));
vi.mock('@/lib/email', () => ({ sendPasswordResetEmail: h.sendPasswordResetEmail }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(() => null) }));

import { POST as changePassword } from '@/app/api/auth/change-password/route';
import { POST as forgotPassword } from '@/app/api/auth/forgot-password/route';
import { PUT as updateUser, DELETE as deleteUser } from '@/app/api/users/[id]/route';

function jsonRequest(body: unknown, method = 'POST') {
  return new NextRequest('http://localhost/api/test', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

/** A user row visible from the demo community, as assertAccessible() loads it. */
function userRow(id: string) {
  return { id, role: 'RESIDENT', email: `${id}@demo.portalhoa.local`, firstName: 'A', passwordHash: 'x', communityId: 'community_public_demo', communityAssignments: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.session = { id: 'demo_user_admin', role: 'ADMIN', communityId: null };
});

describe('demo account locks', () => {
  it('refuses a password change from a demo login', async () => {
    h.session = { id: 'demo_user_resident', role: 'RESIDENT', communityId: 'community_public_demo' };
    const res = await changePassword(jsonRequest({ currentPassword: 'try-portal-hoa', newPassword: 'hijacked-123' }));
    expect(res.status).toBe(403);
    expect(h.prisma.user.update).not.toHaveBeenCalled();
  });

  it('issues no reset token for a demo login, and answers exactly as for any email', async () => {
    h.prisma.user.findUnique.mockResolvedValueOnce(userRow('demo_user_board'));
    const res = await forgotPassword(jsonRequest({ email: 'board@demo.portalhoa.local' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'If that email exists you will receive a reset link.' });
    expect(h.prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(h.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('still issues a reset token for an ordinary user', async () => {
    h.prisma.user.findUnique.mockResolvedValueOnce(userRow('user_real'));
    await forgotPassword(jsonRequest({ email: 'user_real@demo.portalhoa.local' }));
    expect(h.prisma.passwordResetToken.create).toHaveBeenCalledOnce();
  });

  it('refuses an admin changing a demo login\'s role', async () => {
    h.prisma.user.findUnique.mockResolvedValueOnce(userRow('demo_user_resident'));
    const res = await updateUser(jsonRequest({ role: 'ADMIN' }, 'PUT'), params('demo_user_resident'));
    expect(res.status).toBe(403);
    expect(h.prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses an admin deleting a demo login', async () => {
    h.prisma.user.findUnique.mockResolvedValueOnce(userRow('demo_user_board'));
    const res = await deleteUser(jsonRequest(null, 'DELETE'), params('demo_user_board'));
    expect(res.status).toBe(403);
    expect(h.prisma.user.delete).not.toHaveBeenCalled();
  });

  it('still lets an admin delete an ordinary user in the community', async () => {
    h.prisma.user.findUnique.mockResolvedValueOnce(userRow('demo_user_r01'));
    const res = await deleteUser(jsonRequest(null, 'DELETE'), params('demo_user_r01'));
    expect(res.status).toBe(200);
    expect(h.prisma.user.delete).toHaveBeenCalledOnce();
  });
});
