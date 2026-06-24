import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { createAnnouncementSchema } from '../schemas/announcement';
import { paginate, paginationMeta } from '../utils/paginate';

const authorSelect = { id: true, firstName: true, lastName: true, role: true } as const;

export async function listAnnouncements(req: Request, res: Response, next: NextFunction) {
  try {
    const { skip, take, page, limit } = paginate(req.query);
    const q = String(req.query.search ?? '').trim();
    const where = q
      ? { OR: [{ title: { contains: q, mode: 'insensitive' as const } }, { body: { contains: q, mode: 'insensitive' as const } }] }
      : undefined;
    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { author: { select: authorSelect } },
        skip,
        take,
      }),
      prisma.announcement.count({ where }),
    ]);
    res.json({ announcements, pagination: paginationMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
}

export async function createAnnouncement(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createAnnouncementSchema.parse(req.body);
    const announcement = await prisma.announcement.create({
      data: { ...data, authorId: req.userId! },
      include: { author: { select: authorSelect } },
    });
    res.status(201).json({ announcement });
  } catch (err) {
    next(err);
  }
}
