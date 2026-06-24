import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { paginate, paginationMeta } from '../utils/paginate';

const updateRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
});

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const { skip, take, page, limit } = paginate(req.query);
    const q = String(req.query.search ?? '').trim();
    const where = q
      ? {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' as const } },
            { lastName: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : undefined;
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ users, pagination: paginationMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
}

export async function updateUserRole(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { role } = updateRoleSchema.parse(req.body);

    if (id === req.userId) {
      return next(new AppError(400, 'You cannot change your own role'));
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return next(new AppError(404, 'User not found'));

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true },
    });

    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
}
