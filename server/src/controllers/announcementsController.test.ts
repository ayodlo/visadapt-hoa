import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listAnnouncements, createAnnouncement } from './announcementsController';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../utils/prisma', () => ({
  prisma: {
    announcement: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from '../utils/prisma';

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return Object.assign({ json, status }) as unknown as Response;
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

const fakeAnnouncement = {
  id: 'a1',
  title: 'Hello',
  body: 'World',
  authorId: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
  author: { id: 'u1', name: 'Admin', role: 'ADMIN' },
};

beforeEach(() => vi.clearAllMocks());

describe('listAnnouncements', () => {
  it('returns announcements with pagination', async () => {
    vi.mocked(prisma.announcement.findMany).mockResolvedValue([fakeAnnouncement] as never);
    vi.mocked(prisma.announcement.count).mockResolvedValue(1);

    const req = { query: {} } as Request;
    const res = makeRes();
    await listAnnouncements(req, res, makeNext());

    const json = res.json as ReturnType<typeof vi.fn>;
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        announcements: [fakeAnnouncement],
        pagination: expect.objectContaining({ page: 1, limit: 10, total: 1, totalPages: 1 }),
      })
    );
  });

  it('uses page and limit from query string', async () => {
    vi.mocked(prisma.announcement.findMany).mockResolvedValue([]);
    vi.mocked(prisma.announcement.count).mockResolvedValue(0);

    const req = { query: { page: '2', limit: '5' } } as unknown as Request;
    await listAnnouncements(req, makeRes(), makeNext());

    expect(prisma.announcement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 })
    );
  });
});

describe('createAnnouncement', () => {
  it('creates and returns an announcement with 201', async () => {
    vi.mocked(prisma.announcement.create).mockResolvedValue(fakeAnnouncement as never);

    const req = {
      body: { title: 'Hello', body: 'World' },
      userId: 'u1',
    } as unknown as Request;
    const res = makeRes();
    await createAnnouncement(req, res, makeNext());

    const statusMock = res.status as ReturnType<typeof vi.fn>;
    expect(statusMock).toHaveBeenCalledWith(201);
  });

  it('passes Zod validation error to next on missing fields', async () => {
    const req = { body: {}, userId: 'u1' } as unknown as Request;
    const next = makeNext();
    await createAnnouncement(req, makeRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
