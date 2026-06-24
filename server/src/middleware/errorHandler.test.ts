import { describe, it, expect, vi } from 'vitest';
import { AppError, errorHandler } from './errorHandler';
import type { Request, Response, NextFunction } from 'express';

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json, _json: json } as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

describe('AppError', () => {
  it('stores statusCode and message', () => {
    const err = new AppError(404, 'Not found');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Not found');
    expect(err.name).toBe('AppError');
  });
});

describe('errorHandler', () => {
  const req = {} as Request;
  const next = vi.fn() as unknown as NextFunction;

  it('responds with statusCode and error message for AppError', () => {
    const res = makeRes();
    errorHandler(new AppError(422, 'Unprocessable'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unprocessable' });
  });

  it('responds with 500 for unknown errors in non-production', () => {
    process.env.NODE_ENV = 'test';
    const res = makeRes();
    errorHandler(new Error('boom'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body).toHaveProperty('error');
  });
});
