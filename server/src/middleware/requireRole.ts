import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AppError } from './errorHandler';

export function requireRole(...roles: UserRole[]) {
  return (_req: Request, _res: Response, next: NextFunction) => {
    if (!_req.userRole || !roles.includes(_req.userRole as UserRole)) {
      return next(new AppError(403, 'You do not have permission to perform this action'));
    }
    next();
  };
}
