import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

const patchSchema = z.object({
  status: z.enum(['DRAFT', 'NOTICE_SENT', 'RESIDENT_RESPONDED', 'UNDER_REVIEW', 'RESOLVED', 'ESCALATED', 'CLOSED']).optional(),
  ruleCitation: z.string().min(3).max(500).optional(),
  description: z.string().min(10).max(5000).optional(),
  deadline: z.string().datetime({ offset: true }).nullable().optional(),
  resolutionSteps: z.string().max(2000).nullable().optional(),
  evidenceUrl: z.string().max(500).nullable().optional(),
  comment: z.string().max(2000).optional(),
  isInternal: z.boolean().default(false),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const { id } = await params;
  const violation = await prisma.violation.findUnique({
    where: { id },
    include: {
      resident: { select: { id: true, firstName: true, lastName: true, email: true } },
      property: { select: { streetAddress: true, unitNumber: true, city: true, state: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { firstName: true, lastName: true, role: true } } },
      },
      activities: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { firstName: true, lastName: true, role: true } } },
      },
      appeal: {
        include: {
          submittedBy: { select: { firstName: true, lastName: true } },
          reviewedBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!violation) return notFound('Violation');
  return ok({ violation });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const { id } = await params;
  const existing = await prisma.violation.findUnique({ where: { id } });
  if (!existing) return notFound('Violation');

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const data = parsed.data;
  const activities: { action: string; details: string }[] = [];

  if (data.status && data.status !== existing.status) {
    const label = data.status.replace(/_/g, ' ').toLowerCase();
    if (data.status === 'NOTICE_SENT' && existing.status === 'DRAFT') {
      activities.push({ action: 'notice_sent', details: 'Notice sent to resident' });
    } else {
      activities.push({ action: 'status_changed', details: `Status changed to ${label}` });
    }
  }

  const updated = await prisma.violation.update({
    where: { id },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.ruleCitation ? { ruleCitation: data.ruleCitation } : {}),
      ...(data.description ? { description: data.description } : {}),
      ...('deadline' in data ? { deadline: data.deadline ? new Date(data.deadline) : null } : {}),
      ...('resolutionSteps' in data ? { resolutionSteps: data.resolutionSteps } : {}),
      ...('evidenceUrl' in data ? { evidenceUrl: data.evidenceUrl } : {}),
    },
    include: {
      resident: { select: { id: true, firstName: true, lastName: true, email: true } },
      property: { select: { streetAddress: true, unitNumber: true, city: true, state: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { firstName: true, lastName: true, role: true } } },
      },
      activities: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { firstName: true, lastName: true, role: true } } },
      },
      appeal: {
        include: {
          submittedBy: { select: { firstName: true, lastName: true } },
          reviewedBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  for (const act of activities) {
    await prisma.violationActivity.create({
      data: { violationId: id, actorId: session.id, ...act },
    });
  }

  if (data.comment?.trim()) {
    await prisma.violationComment.create({
      data: {
        violationId: id,
        authorId: session.id,
        body: data.comment.trim(),
        isInternal: data.isInternal,
      },
    });
    if (!data.isInternal) {
      await prisma.violationActivity.create({
        data: { violationId: id, actorId: session.id, action: 'comment_added', details: 'Staff added a comment' },
      });
    }
  }

  await createAuditLog({
    userId: session.id,
    action: 'violation.update',
    entityType: 'Violation',
    entityId: id,
    metadata: { status: data.status } as object,
  });

  return ok({ violation: updated });
}
