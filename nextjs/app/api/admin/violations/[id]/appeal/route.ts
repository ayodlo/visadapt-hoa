import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';
import { sendPushToUsers } from '@/lib/push';

const schema = z.object({
  status: z.enum(['UNDER_REVIEW', 'APPROVED', 'DENIED', 'WITHDRAWN']),
  outcome: z.string().max(2000).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const { id } = await params;
  const violation = await prisma.violation.findUnique({
    where: { id },
    include: { appeal: true },
  });
  if (!violation) return notFound('Violation');
  if (!violation.appeal) return notFound('Appeal');

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const { status, outcome } = parsed.data;
  const isDecision = status === 'APPROVED' || status === 'DENIED';

  const appeal = await prisma.violationAppeal.update({
    where: { id: violation.appeal.id },
    data: {
      status,
      ...(outcome ? { outcome } : {}),
      ...(isDecision ? { reviewedById: session.id, reviewedAt: new Date() } : {}),
    },
    include: {
      submittedBy: { select: { firstName: true, lastName: true } },
      reviewedBy: { select: { firstName: true, lastName: true } },
    },
  });

  // Auto-resolve violation when appeal is approved
  if (status === 'APPROVED') {
    await prisma.violation.update({
      where: { id },
      data: { status: 'RESOLVED' },
    });
    await prisma.violationActivity.create({
      data: {
        violationId: id,
        actorId: session.id,
        action: 'status_changed',
        details: 'Violation resolved — appeal approved',
      },
    });
  }

  const actionLabel = status === 'APPROVED'
    ? 'Appeal approved — violation resolved'
    : status === 'DENIED'
    ? 'Appeal denied'
    : status === 'UNDER_REVIEW'
    ? 'Appeal is now under review'
    : 'Appeal withdrawn';

  await prisma.violationActivity.create({
    data: {
      violationId: id,
      actorId: session.id,
      action: 'appeal_reviewed',
      details: actionLabel,
    },
  });

  await createAuditLog({
    userId: session.id,
    action: 'violation.appeal_decision',
    entityType: 'ViolationAppeal',
    entityId: violation.appeal.id,
    metadata: { status } as object,
  });

  if (isDecision) {
    await sendPushToUsers([violation.residentId], {
      title: 'Appeal Decision',
      body: actionLabel,
      data: { type: 'violation', id },
    });
  }

  return ok({ appeal });
}
