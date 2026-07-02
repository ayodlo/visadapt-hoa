import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

const RESIDENT_EDITABLE_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION'];
const WITHDRAW_ALLOWED_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION'];

const residentPatchSchema = z.object({
  requestType: z.enum(['FENCE', 'EXTERIOR_PAINT', 'LANDSCAPING', 'SOLAR', 'ROOF', 'SHED', 'OTHER']).optional(),
  description: z.string().min(20).max(5000).optional(),
  desiredStartDate: z.string().datetime({ offset: true }).nullable().optional(),
  propertyId: z.string().nullable().optional(),
  submitNow: z.boolean().optional(),
  withdraw: z.boolean().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const request = await prisma.architecturalRequest.findUnique({
    where: { id },
    include: {
      resident: { select: { id: true, firstName: true, lastName: true, email: true } },
      property: { select: { streetAddress: true, unitNumber: true, city: true, state: true } },
      comments: {
        where: session.role === 'RESIDENT' ? { isInternal: false } : {},
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { firstName: true, lastName: true, role: true } } },
      },
      activities: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { firstName: true, lastName: true, role: true } } },
      },
      attachments: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!request) return notFound('Architectural request');
  if (session.role === 'RESIDENT' && request.residentId !== session.id) return forbidden();

  return ok({ request });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'RESIDENT') return forbidden();

  const { id } = await params;
  const existing = await prisma.architecturalRequest.findUnique({ where: { id } });
  if (!existing) return notFound('Architectural request');
  if (existing.residentId !== session.id) return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = residentPatchSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const data = parsed.data;

  if (data.withdraw) {
    if (!WITHDRAW_ALLOWED_STATUSES.includes(existing.status)) {
      return err('This request cannot be withdrawn in its current status.', 400);
    }
    const updated = await prisma.architecturalRequest.update({
      where: { id },
      data: { status: 'WITHDRAWN' },
    });
    await prisma.architecturalRequestActivity.create({
      data: { requestId: id, actorId: session.id, action: 'withdrawn', details: 'Request withdrawn by resident' },
    });
    await createAuditLog({
      userId: session.id,
      action: 'arch_request.withdraw',
      entityType: 'ArchitecturalRequest',
      entityId: id,
    });
    return ok({ request: updated });
  }

  if (!RESIDENT_EDITABLE_STATUSES.includes(existing.status)) {
    return err('This request can no longer be edited.', 400);
  }

  const submitNow = data.submitNow && existing.status === 'DRAFT';
  const newStatus = submitNow ? 'SUBMITTED' : existing.status;

  const updated = await prisma.architecturalRequest.update({
    where: { id },
    data: {
      ...(data.requestType ? { requestType: data.requestType } : {}),
      ...(data.description ? { description: data.description } : {}),
      ...('desiredStartDate' in data ? { desiredStartDate: data.desiredStartDate ? new Date(data.desiredStartDate) : null } : {}),
      ...('propertyId' in data ? { propertyId: data.propertyId } : {}),
      status: newStatus,
    },
  });

  if (submitNow) {
    await prisma.architecturalRequestActivity.create({
      data: { requestId: id, actorId: session.id, action: 'submitted', details: 'Request submitted for review' },
    });
  } else {
    await prisma.architecturalRequestActivity.create({
      data: { requestId: id, actorId: session.id, action: 'updated', details: 'Request details updated' },
    });
  }

  await createAuditLog({
    userId: session.id,
    action: 'arch_request.update',
    entityType: 'ArchitecturalRequest',
    entityId: id,
    metadata: { status: newStatus } as object,
  });

  return ok({ request: updated });
}
