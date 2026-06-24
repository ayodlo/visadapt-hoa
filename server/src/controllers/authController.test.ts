import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { register, login, me } from './authController';
import type { Request, Response, NextFunction } from 'express';

vi.mock('bcryptjs');
vi.mock('jsonwebtoken');
vi.mock('../utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from '../utils/prisma';

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return Object.assign({ json, status }, { _json: json }) as unknown as Response;
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

const fakeUser = {
  id: 'u1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  passwordHash: 'hashed',
  role: 'RESIDENT',
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret';
  vi.mocked(jwt.sign).mockReturnValue('fake-token' as never);
});

describe('register', () => {
  it('creates a user and returns token + user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(bcrypt.hash).mockResolvedValue('hashed' as never);
    vi.mocked(prisma.user.create).mockResolvedValue(fakeUser as never);

    const req = {
      body: { firstName: 'Test', lastName: 'User', email: 'test@example.com', password: 'password123' },
    } as Request;
    const res = makeRes();
    const next = makeNext();

    await register(req, res, next);

    const statusMock = res.status as ReturnType<typeof vi.fn>;
    expect(statusMock).toHaveBeenCalledWith(201);
    const json = statusMock.mock.results[0].value.json as ReturnType<typeof vi.fn>;
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ token: 'fake-token' }));
  });

  it('returns 409 when email already exists', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(fakeUser as never);

    const req = {
      body: { firstName: 'Test', lastName: 'User', email: 'test@example.com', password: 'password123' },
    } as Request;
    const next = makeNext();

    await register(req, makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err.statusCode).toBe(409);
  });

  it('calls next with error on invalid body', async () => {
    const req = { body: {} } as Request;
    const next = makeNext();
    await register(req, makeRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

describe('login', () => {
  it('returns token and user on valid credentials', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(fakeUser as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const req = { body: { email: 'test@example.com', password: 'password123' } } as Request;
    const res = makeRes();
    const next = makeNext();

    await login(req, res, next);

    const json = res.json as ReturnType<typeof vi.fn>;
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ token: 'fake-token' }));
  });

  it('returns 401 when user does not exist', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = { body: { email: 'nobody@example.com', password: 'password123' } } as Request;
    const next = makeNext();
    await login(req, makeRes(), next);

    expect((next as ReturnType<typeof vi.fn>).mock.calls[0][0].statusCode).toBe(401);
  });

  it('returns 401 when password does not match', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(fakeUser as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const req = { body: { email: 'test@example.com', password: 'wrongpassword' } } as Request;
    const next = makeNext();
    await login(req, makeRes(), next);

    expect((next as ReturnType<typeof vi.fn>).mock.calls[0][0].statusCode).toBe(401);
  });
});

describe('me', () => {
  it('returns the authenticated user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(fakeUser as never);

    const req = { userId: 'u1' } as unknown as Request;
    const res = makeRes();
    const next = makeNext();

    await me(req, res, next);

    const json = res.json as ReturnType<typeof vi.fn>;
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ id: 'u1' }) }));
  });

  it('returns 404 when user is not found', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = { userId: 'missing' } as unknown as Request;
    const next = makeNext();
    await me(req, makeRes(), next);

    expect((next as ReturnType<typeof vi.fn>).mock.calls[0][0].statusCode).toBe(404);
  });
});
