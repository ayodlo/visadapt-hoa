import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

const schema = z.object({
  status: z.enum(['UNDER_REVIEW', 'NEEDS_MORE_INFORMATION', 'APPROVED', 'DENIED']).optional(),
  governingRuleReference: z.string().max(500).nullable().optional(),
  decisionReason: z.string().max(2000).nullable().optional(),
  comment: z.string().max(2000).optional(),
  isInternal: z.boolean().default(false),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'BOARD_MEMBER') return forbidden();

  const { id } = await params;
  const request = await prisma.architecturalRequest.findUnique({
    where: { id },
    include: {
      resident: { select: { id: true, firstName: true, lastName: true, email: true } },
      property: { select: { streetAddress: true, unitNumber: true, city: true, state: true } },
      comments: {
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
  return ok({ request });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'BOARD_MEMBER') return forbidden();

  const { id } = await params;
  const existing = await prisma.architecturalRequest.findUnique({ where: { id } });
  if (!existing) return notFound('Architectural request');

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const data = parsed.data;
  const activities: { action: string; details: string }[] = [];

  if (data.status && data.status !== existing.status) {
    activities.push({
      action: 'status_changed',
      details: `Status changed to ${data.status.replace(/_/g, ' ').toLowerCase()}`,
    });
  }
  if ('governingRuleReference' in data && data.governingRuleReference !== existing.governingRuleReference) {
    if (data.governingRuleReference) {
      activities.push({ action: 'rule_referenced', details: `Governing rule added: ${data.governingRuleReference}` });
    }
  }

  const updated = await prisma.architecturalRequest.update({
    where: { id },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...('governingRuleReference' in data ? { governingRuleReference: data.governingRuleReference } : {}),
      ...('decisionReason' in data ? { decisionReason: data.decisionReason } : {}),
    },
    include: {
      resident: { select: { id: true, firstName: true, lastName: true, email: true } },
      property: { select: { streetAddress: true, unitNumber: true, city: true, state: true } },
      comments: {
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

  for (const act of activities) {
    await prisma.architecturalRequestActivity.create({
      data: { requestId: id, actorId: session.id, ...act },
    });
  }

  if (data.comment?.trim()) {
    await prisma.architecturalRequestComment.create({
      data: {
        requestId: id,
        authorId: session.id,
        body: data.comment.trim(),
        isInternal: data.isInternal,
      },
    });
    if (!data.isInternal) {
      await prisma.architecturalRequestActivity.create({
        data: { requestId: id, actorId: session.id, action: 'comment_added', details: 'Board member added a comment' },
      });
    }
  }

  await createAuditLog({
    userId: session.id,
    action: 'arch_request.board_update',
    entityType: 'ArchitecturalRequest',
    entityId: id,
    metadata: { status: data.status } as object,
  });

  return ok({ request: updated });
}
