import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

const createSchema = z.object({
  residentId: z.string(),
  propertyId: z.string().optional(),
  violationType: z.enum(['LANDSCAPING_MAINTENANCE', 'PARKING', 'NOISE', 'PROPERTY_APPEARANCE', 'UNAUTHORIZED_MODIFICATION', 'PET_VIOLATION', 'TRASH_AND_DEBRIS', 'OTHER']),
  ruleCitation: z.string().min(3).max(500),
  description: z.string().min(10).max(5000),
  observedAt: z.string().datetime({ offset: true }),
  deadline: z.string().datetime({ offset: true }).optional(),
  resolutionSteps: z.string().max(2000).optional(),
  sendNow: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const { searchParams } = req.nextUrl;
  const search = searchParams.get('search')?.trim() ?? '';
  const status = searchParams.get('status') ?? '';
  const type = searchParams.get('type') ?? '';
  const hasAppeal = searchParams.get('hasAppeal') === 'true';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = 20;

  const where = {
    ...(search ? {
      OR: [
        { description: { contains: search, mode: 'insensitive' as const } },
        { ruleCitation: { contains: search, mode: 'insensitive' as const } },
        { resident: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }},
      ],
    } : {}),
    ...(status ? { status: status as never } : {}),
    ...(type ? { violationType: type as never } : {}),
    ...(hasAppeal ? { appeal: { isNot: null } } : {}),
  };

  const [violations, total] = await Promise.all([
    prisma.violation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        resident: { select: { id: true, firstName: true, lastName: true } },
        property: { select: { streetAddress: true, unitNumber: true } },
        appeal: { select: { id: true, status: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.violation.count({ where }),
  ]);

  return ok({ violations, total, totalPages: Math.ceil(total / limit), page });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'ADMIN') return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const { sendNow, observedAt, deadline, ...rest } = parsed.data;
  const status = sendNow ? 'NOTICE_SENT' : 'DRAFT';

  const violation = await prisma.violation.create({
    data: {
      ...rest,
      observedAt: new Date(observedAt),
      deadline: deadline ? new Date(deadline) : null,
      createdById: session.id,
      status,
    },
  });

  await prisma.violationActivity.create({
    data: {
      violationId: violation.id,
      actorId: session.id,
      action: 'created',
      details: sendNow ? 'Violation created and notice sent to resident' : 'Violation draft created',
    },
  });

  await createAuditLog({
    userId: session.id,
    action: 'violation.create',
    entityType: 'Violation',
    entityId: violation.id,
    metadata: { violationType: violation.violationType, status } as object,
  });

  return ok({ violation }, 201);
}
