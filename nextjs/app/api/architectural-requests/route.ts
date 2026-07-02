import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

const schema = z.object({
  requestType: z.enum(['FENCE', 'EXTERIOR_PAINT', 'LANDSCAPING', 'SOLAR', 'ROOF', 'SHED', 'OTHER']),
  description: z.string().min(20, 'Description must be at least 20 characters').max(5000),
  desiredStartDate: z.string().datetime({ offset: true }).nullable().optional(),
  propertyId: z.string().optional(),
  submitNow: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'RESIDENT') return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const { submitNow, desiredStartDate, propertyId, ...rest } = parsed.data;
  const status = submitNow ? 'SUBMITTED' : 'DRAFT';

  const request = await prisma.architecturalRequest.create({
    data: {
      residentId: session.id,
      status,
      desiredStartDate: desiredStartDate ? new Date(desiredStartDate) : null,
      propertyId: propertyId ?? null,
      ...rest,
    },
  });

  await prisma.architecturalRequestActivity.create({
    data: {
      requestId: request.id,
      actorId: session.id,
      action: 'created',
      details: submitNow ? 'Request submitted for review' : 'Draft saved',
    },
  });

  await createAuditLog({
    userId: session.id,
    action: 'arch_request.create',
    entityType: 'ArchitecturalRequest',
    entityId: request.id,
    metadata: { requestType: request.requestType, status } as object,
  });

  return ok({ request }, 201);
}
