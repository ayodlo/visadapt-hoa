import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listRequests, createRequest, updateStatus } from './maintenanceController';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../utils/prisma', () => ({
  prisma: {
    maintenanceRequest: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
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

const fakeRequest = {
  id: 'r1',
  title: 'Leaky faucet',
  description: 'Kitchen sink is dripping',
  status: 'OPEN',
  priority: 'MEDIUM',
  submittedById: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
  submittedBy: { id: 'u1', name: 'Alice' },
};

beforeEach(() => vi.clearAllMocks());

describe('listRequests', () => {
  it('returns all requests for staff', async () => {
    vi.mocked(prisma.maintenanceRequest.findMany).mockResolvedValue([fakeRequest] as never);
    vi.mocked(prisma.maintenanceRequest.count).mockResolvedValue(1);

    const req = { query: {}, userRole: 'ADMIN', userId: 'u1' } as unknown as Request;
    const res = makeRes();
    await listRequests(req, res, makeNext());

    expect(prisma.maintenanceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
    const json = res.json as ReturnType<typeof vi.fn>;
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ requests: [fakeRequest] })
    );
  });

  it('filters to own requests for RESIDENT', async () => {
    vi.mocked(prisma.maintenanceRequest.findMany).mockResolvedValue([]);
    vi.mocked(prisma.maintenanceRequest.count).mockResolvedValue(0);

    const req = { query: {}, userRole: 'RESIDENT', userId: 'u1' } as unknown as Request;
    await listRequests(req, makeRes(), makeNext());

    expect(prisma.maintenanceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { submittedById: 'u1' } })
    );
  });
});

describe('createRequest', () => {
  it('creates and returns a request with 201', async () => {
    vi.mocked(prisma.maintenanceRequest.create).mockResolvedValue(fakeRequest as never);

    const req = {
      body: { title: 'Leaky faucet', description: 'Kitchen sink is dripping', priority: 'MEDIUM' },
      userId: 'u1',
    } as unknown as Request;
    const res = makeRes();
    await createRequest(req, res, makeNext());

    const statusMock = res.status as ReturnType<typeof vi.fn>;
    expect(statusMock).toHaveBeenCalledWith(201);
  });

  it('passes validation error to next on missing fields', async () => {
    const req = { body: {}, userId: 'u1' } as unknown as Request;
    const next = makeNext();
    await createRequest(req, makeRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

describe('updateStatus', () => {
  it('updates and returns the request', async () => {
    vi.mocked(prisma.maintenanceRequest.findUnique).mockResolvedValue(fakeRequest as never);
    vi.mocked(prisma.maintenanceRequest.update).mockResolvedValue({ ...fakeRequest, status: 'RESOLVED' } as never);

    const req = {
      params: { id: 'r1' },
      body: { status: 'RESOLVED' },
    } as unknown as Request;
    const res = makeRes();
    await updateStatus(req, res, makeNext());

    const json = res.json as ReturnType<typeof vi.fn>;
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ request: expect.objectContaining({ status: 'RESOLVED' }) })
    );
  });

  it('returns 404 when request does not exist', async () => {
    vi.mocked(prisma.maintenanceRequest.findUnique).mockResolvedValue(null);

    const req = { params: { id: 'nope' }, body: { status: 'RESOLVED' } } as unknown as Request;
    const next = makeNext();
    await updateStatus(req, makeRes(), next);
    expect((next as ReturnType<typeof vi.fn>).mock.calls[0][0].statusCode).toBe(404);
  });
});
