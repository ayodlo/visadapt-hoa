import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

const APPEALABLE = ['NOTICE_SENT', 'RESIDENT_RESPONDED', 'UNDER_REVIEW', 'ESCALATED'];

const schema = z.object({
  reason: z.string().min(20, 'Appeal reason must be at least 20 characters').max(3000),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'RESIDENT') return forbidden();

  const { id } = await params;
  const violation = await prisma.violation.findUnique({
    where: { id },
    include: { appeal: true },
  });
  if (!violation) return notFound('Violation');
  if (violation.residentId !== session.id) return forbidden();
  if (!APPEALABLE.includes(violation.status)) {
    return err('An appeal cannot be filed at this stage.', 400);
  }
  if (violation.appeal) {
    return err('An appeal has already been filed for this notice.', 400);
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const appeal = await prisma.violationAppeal.create({
    data: {
      violationId: id,
      submittedById: session.id,
      reason: parsed.data.reason,
      status: 'SUBMITTED',
    },
  });

  await prisma.violationActivity.create({
    data: {
      violationId: id,
      actorId: session.id,
      action: 'appeal_filed',
      details: 'Resident filed an appeal',
    },
  });

  await createAuditLog({
    userId: session.id,
    action: 'violation.appeal',
    entityType: 'Violation',
    entityId: id,
  });

  return ok({ appeal }, 201);
}
