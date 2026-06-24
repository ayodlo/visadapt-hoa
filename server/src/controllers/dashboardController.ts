import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const isStaff = req.userRole === 'ADMIN' || req.userRole === 'BOARD_MEMBER';
    const now = new Date();

    const [
      openMaintenance,
      inProgressMaintenance,
      upcomingEvents,
      activePollsCount,
      recentAnnouncements,
      outstandingDues,
    ] = await Promise.all([
      prisma.maintenanceRequest.count({
        where: {
          status: 'OPEN',
          ...(!isStaff && { submittedById: req.userId }),
        },
      }),
      prisma.maintenanceRequest.count({
        where: {
          status: 'IN_PROGRESS',
          ...(!isStaff && { submittedById: req.userId }),
        },
      }),
      prisma.event.findMany({
        where: { startAt: { gte: now } },
        orderBy: { startAt: 'asc' },
        take: 3,
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      }),
      prisma.poll.count({
        where: {
          OR: [{ closesAt: null }, { closesAt: { gt: now } }],
        },
      }),
      prisma.announcement.findMany({
        orderBy: { createdAt: 'desc' },
        take: 4,
        include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
      }),
      prisma.duesRecord.aggregate({
        where: {
          status: { in: ['PENDING', 'OVERDUE'] },
          ...(!isStaff && { userId: req.userId }),
        },
        _sum: { amountCents: true },
      }),
    ]);

    res.json({
      stats: {
        openMaintenanceRequests: openMaintenance,
        inProgressMaintenanceRequests: inProgressMaintenance,
        activePollsCount,
        outstandingDuesCents: outstandingDues._sum.amountCents ?? 0,
      },
      recentAnnouncements,
      upcomingEvents,
    });
  } catch (err) {
    next(err);
  }
}
