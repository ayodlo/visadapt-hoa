import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listUsers, updateUserRole } from './usersController';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../utils/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '../utils/prisma';

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return Object.assign({ json, status }) as unknown as Response;
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

const fakeUser = { id: 'u1', name: 'Alice', email: 'alice@example.com', role: 'RESIDENT', createdAt: new Date() };

beforeEach(() => vi.clearAllMocks());

describe('listUsers', () => {
  it('returns users with pagination', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([fakeUser] as never);
    vi.mocked(prisma.user.count).mockResolvedValue(1);

    const req = { query: {} } as Request;
    const res = makeRes();
    await listUsers(req, res, makeNext());

    const json = res.json as ReturnType<typeof vi.fn>;
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        users: [fakeUser],
        pagination: expect.objectContaining({ total: 1 }),
      })
    );
  });
});

describe('updateUserRole', () => {
  it('updates and returns the user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(fakeUser as never);
    vi.mocked(prisma.user.update).mockResolvedValue({ ...fakeUser, role: 'BOARD_MEMBER' } as never);

    const req = {
      params: { id: 'u2' },
      body: { role: 'BOARD_MEMBER' },
      userId: 'u1',
    } as unknown as Request;
    const res = makeRes();
    await updateUserRole(req, res, makeNext());

    const json = res.json as ReturnType<typeof vi.fn>;
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ role: 'BOARD_MEMBER' }) })
    );
  });

  it('returns 400 when changing own role', async () => {
    const req = {
      params: { id: 'u1' },
      body: { role: 'RESIDENT' },
      userId: 'u1',
    } as unknown as Request;
    const next = makeNext();
    await updateUserRole(req, makeRes(), next);
    expect((next as ReturnType<typeof vi.fn>).mock.calls[0][0].statusCode).toBe(400);
  });

  it('returns 404 when user does not exist', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = {
      params: { id: 'missing' },
      body: { role: 'RESIDENT' },
      userId: 'u1',
    } as unknown as Request;
    const next = makeNext();
    await updateUserRole(req, makeRes(), next);
    expect((next as ReturnType<typeof vi.fn>).mock.calls[0][0].statusCode).toBe(404);
  });
});
