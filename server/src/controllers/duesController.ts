import { Request, Response, NextFunction } from 'express';
import { DuesStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { createDuesSchema, updateDuesStatusSchema } from '../schemas/dues';
import { AppError } from '../middleware/errorHandler';
import { paginate, paginationMeta } from '../utils/paginate';

const userSelect = { id: true, name: true, email: true } as const;

export async function listDues(req: Request, res: Response, next: NextFunction) {
  try {
    const isStaff = req.userRole === 'ADMIN' || req.userRole === 'BOARD_MEMBER';
    const { skip, take, page, limit } = paginate(req.query);
    const rawStatus = req.query.status as string | undefined;
    const statusFilter = rawStatus && Object.values(DuesStatus).includes(rawStatus as DuesStatus)
      ? (rawStatus as DuesStatus)
      : undefined;

    const baseWhere = isStaff ? {} : { userId: req.userId };
    const where = { ...baseWhere, ...(statusFilter ? { status: statusFilter } : {}) };

    const [records, total] = await Promise.all([
      prisma.duesRecord.findMany({
        where,
        orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
        include: { user: { select: userSelect } },
        skip,
        take,
      }),
      prisma.duesRecord.count({ where }),
    ]);
    res.json({ records, pagination: paginationMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
}

export async function createDues(req: Request, res: Response, next: NextFunction) {
  try {
    const { userIds, dueDate, ...rest } = createDuesSchema.parse(req.body);

    const records = await prisma.$transaction(
      userIds.map((userId) =>
        prisma.duesRecord.create({
          data: { ...rest, userId, dueDate: new Date(dueDate) },
          include: { user: { select: userSelect } },
        })
      )
    );

    res.status(201).json({ records });
  } catch (err) {
    next(err);
  }
}

export async function updateDuesStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status, notes } = updateDuesStatusSchema.parse(req.body);

    const existing = await prisma.duesRecord.findUnique({ where: { id } });
    if (!existing) return next(new AppError(404, 'Record not found'));

    const record = await prisma.duesRecord.update({
      where: { id },
      data: {
        status,
        notes: notes ?? existing.notes,
        paidAt: status === 'PAID' ? new Date() : status === 'PENDING' ? null : existing.paidAt,
      },
      include: { user: { select: userSelect } },
    });

    res.json({ record });
  } catch (err) {
    next(err);
  }
}
