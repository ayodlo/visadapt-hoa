import { NextFunction, Request, Response } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
    });
  }

  console.error('[unhandled error]', err);

  return res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}
