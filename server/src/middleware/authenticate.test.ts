import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { authenticate } from './authenticate';
import { AppError } from './errorHandler';
import type { Request, Response, NextFunction } from 'express';

vi.mock('jsonwebtoken');

function makeReq(authHeader?: string): Request {
  return { headers: { authorization: authHeader } } as unknown as Request;
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

describe('authenticate', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  it('calls next(AppError 401) when Authorization header is missing', () => {
    const req = makeReq();
    const next = makeNext();
    authenticate(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect((next as ReturnType<typeof vi.fn>).mock.calls[0][0].statusCode).toBe(401);
  });

  it('calls next(AppError 401) when header does not start with Bearer', () => {
    const req = makeReq('Basic abc');
    const next = makeNext();
    authenticate(req, {} as Response, next);
    expect((next as ReturnType<typeof vi.fn>).mock.calls[0][0].statusCode).toBe(401);
  });

  it('calls next(AppError 401) when token is invalid', () => {
    vi.mocked(jwt.verify).mockImplementation(() => { throw new Error('invalid'); });
    const req = makeReq('Bearer bad-token');
    const next = makeNext();
    authenticate(req, {} as Response, next);
    expect((next as ReturnType<typeof vi.fn>).mock.calls[0][0].statusCode).toBe(401);
  });

  it('sets userId and userRole then calls next() for a valid token', () => {
    vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-1', role: 'ADMIN' } as never);
    const req = makeReq('Bearer valid-token') as Request & { userId?: string; userRole?: string };
    const next = makeNext();
    authenticate(req, {} as Response, next);
    expect(req.userId).toBe('user-1');
    expect(req.userRole).toBe('ADMIN');
    expect(next).toHaveBeenCalledWith();
  });
});
