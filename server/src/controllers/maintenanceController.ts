import { Request, Response, NextFunction } from 'express';
import { RequestStatus, RequestPriority } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { createMaintenanceSchema, updateStatusSchema } from '../schemas/maintenance';
import { AppError } from '../middleware/errorHandler';
import { paginate, paginationMeta } from '../utils/paginate';

const submittedBySelect = { id: true, firstName: true, lastName: true } as const;

export async function listRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const isStaff = req.userRole === 'ADMIN' || req.userRole === 'BOARD_MEMBER';
    const { skip, take, page, limit } = paginate(req.query);

    const rawStatus = req.query.status as string | undefined;
    const rawPriority = req.query.priority as string | undefined;
    const statusFilter = rawStatus && Object.values(RequestStatus).includes(rawStatus as RequestStatus)
      ? (rawStatus as RequestStatus) : undefined;
    const priorityFilter = rawPriority && Object.values(RequestPriority).includes(rawPriority as RequestPriority)
      ? (rawPriority as RequestPriority) : undefined;

    const baseWhere = isStaff ? {} : { submittedById: req.userId };
    const where = {
      ...baseWhere,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(priorityFilter ? { priority: priorityFilter } : {}),
    };

    const [requests, total] = await Promise.all([
      prisma.maintenanceRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { submittedBy: { select: submittedBySelect } },
        skip,
        take,
      }),
      prisma.maintenanceRequest.count({ where }),
    ]);
    res.json({ requests, pagination: paginationMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
}

export async function createRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createMaintenanceSchema.parse(req.body);
    const request = await prisma.maintenanceRequest.create({
      data: { ...data, submittedById: req.userId! },
      include: { submittedBy: { select: submittedBySelect } },
    });
    res.status(201).json({ request });
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status } = updateStatusSchema.parse(req.body);
    const existing = await prisma.maintenanceRequest.findUnique({ where: { id } });
    if (!existing) return next(new AppError(404, 'Request not found'));
    const request = await prisma.maintenanceRequest.update({
      where: { id },
      data: { status },
      include: { submittedBy: { select: submittedBySelect } },
    });
    res.json({ request });
  } catch (err) {
    next(err);
  }
}
