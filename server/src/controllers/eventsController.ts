import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { createEventSchema } from '../schemas/event';
import { AppError } from '../middleware/errorHandler';
import { paginate, paginationMeta } from '../utils/paginate';

const createdBySelect = { id: true, name: true } as const;

export async function listEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const { skip, take, page, limit } = paginate(req.query);
    const [events, total] = await Promise.all([
      prisma.event.findMany({
        orderBy: { startAt: 'asc' },
        include: { createdBy: { select: createdBySelect } },
        skip,
        take,
      }),
      prisma.event.count(),
    ]);
    res.json({ events, pagination: paginationMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
}

export async function createEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createEventSchema.parse(req.body);
    const event = await prisma.event.create({
      data: {
        ...data,
        startAt: new Date(data.startAt),
        endAt: data.endAt ? new Date(data.endAt) : undefined,
        createdById: req.userId!,
      },
      include: { createdBy: { select: createdBySelect } },
    });
    res.status(201).json({ event });
  } catch (err) {
    next(err);
  }
}

export async function deleteEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) return next(new AppError(404, 'Event not found'));

    await prisma.event.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
