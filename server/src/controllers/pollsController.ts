import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { createPollSchema, castVoteSchema } from '../schemas/poll';
import { AppError } from '../middleware/errorHandler';
import { paginate, paginationMeta } from '../utils/paginate';

export async function listPolls(req: Request, res: Response, next: NextFunction) {
  try {
    const { skip, take, page, limit } = paginate(req.query);
    const [polls, total] = await Promise.all([
      prisma.poll.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true } },
          options: { include: { _count: { select: { votes: true } } } },
          votes: { where: { userId: req.userId }, select: { optionId: true } },
        },
        skip,
        take,
      }),
      prisma.poll.count(),
    ]);

    const shaped = polls.map(({ votes, ...poll }) => ({
      ...poll,
      myVote: votes[0]?.optionId ?? null,
      totalVotes: poll.options.reduce((sum, o) => sum + o._count.votes, 0),
      options: poll.options.map(({ _count, ...o }) => ({ ...o, voteCount: _count.votes })),
    }));

    res.json({ polls: shaped, pagination: paginationMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
}

export async function createPoll(req: Request, res: Response, next: NextFunction) {
  try {
    const { options, closesAt, ...rest } = createPollSchema.parse(req.body);

    const poll = await prisma.poll.create({
      data: {
        ...rest,
        closesAt: closesAt ? new Date(closesAt) : undefined,
        createdById: req.userId!,
        options: { create: options.map((text) => ({ text })) },
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        options: { include: { _count: { select: { votes: true } } } },
      },
    });

    res.status(201).json({
      poll: {
        ...poll,
        myVote: null,
        totalVotes: 0,
        options: poll.options.map(({ _count, ...o }) => ({ ...o, voteCount: 0 })),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function castVote(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { optionId } = castVoteSchema.parse(req.body);

    const poll = await prisma.poll.findUnique({
      where: { id },
      include: { options: { select: { id: true } } },
    });
    if (!poll) return next(new AppError(404, 'Poll not found'));
    if (poll.closesAt && poll.closesAt < new Date()) {
      return next(new AppError(400, 'This poll is closed'));
    }
    if (!poll.options.some((o) => o.id === optionId)) {
      return next(new AppError(400, 'Invalid option'));
    }

    const existing = await prisma.pollVote.findUnique({
      where: { pollId_userId: { pollId: id, userId: req.userId! } },
    });
    if (existing) return next(new AppError(409, 'You have already voted on this poll'));

    await prisma.pollVote.create({
      data: { pollId: id, optionId, userId: req.userId! },
    });

    res.status(201).json({ message: 'Vote cast' });
  } catch (err) {
    next(err);
  }
}
