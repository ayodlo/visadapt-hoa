import { describe, it, expect, vi } from 'vitest';
import { requireRole } from './requireRole';
import { AppError } from './errorHandler';
import type { Request, Response, NextFunction } from 'express';

function makeReq(role?: string): Request {
  return { userRole: role } as unknown as Request;
}

describe('requireRole', () => {
  it('calls next(AppError 403) when userRole is missing', () => {
    const next = vi.fn() as unknown as NextFunction;
    requireRole('ADMIN')(makeReq(), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect((next as ReturnType<typeof vi.fn>).mock.calls[0][0].statusCode).toBe(403);
  });

  it('calls next(AppError 403) when role does not match', () => {
    const next = vi.fn() as unknown as NextFunction;
    requireRole('ADMIN')(makeReq('RESIDENT'), {} as Response, next);
    expect((next as ReturnType<typeof vi.fn>).mock.calls[0][0].statusCode).toBe(403);
  });

  it('calls next() when role matches', () => {
    const next = vi.fn() as unknown as NextFunction;
    requireRole('ADMIN')(makeReq('ADMIN'), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('allows any of the listed roles', () => {
    const next = vi.fn() as unknown as NextFunction;
    requireRole('ADMIN', 'BOARD_MEMBER')(makeReq('BOARD_MEMBER'), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
