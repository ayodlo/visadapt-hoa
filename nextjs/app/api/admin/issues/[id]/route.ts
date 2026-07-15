import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

const schema = z.object({
  status: z.enum(['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_VENDOR', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedToId: z.string().nullable().optional(),
  vendorId: z.string().nullable().optional(),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { id } = await params;
  const existing = await prisma.issue.findUnique({ where: { id } });
  if (!existing || existing.communityId !== communityId) return notFound('Issue');

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const data = parsed.data;
  const activities: { action: string; details: string }[] = [];

  if (data.status && data.status !== existing.status) {
    activities.push({ action: 'status_changed', details: `Status changed from "${existing.status.replace(/_/g, ' ')}" to "${data.status.replace(/_/g, ' ')}"` });
  }
  if ('assignedToId' in data && data.assignedToId !== existing.assignedToId) {
    if (data.assignedToId) {
      const user = await prisma.user.findUnique({ where: { id: data.assignedToId }, select: { firstName: true, lastName: true } });
      activities.push({ action: 'assigned', details: `Assigned to ${user?.firstName} ${user?.lastName}` });
    } else {
      activities.push({ action: 'unassigned', details: 'Assignment removed' });
    }
  }
  if ('vendorId' in data && data.vendorId !== existing.vendorId) {
    if (data.vendorId) {
      const vendor = await prisma.vendor.findUnique({ where: { id: data.vendorId }, select: { name: true } });
      activities.push({ action: 'vendor_assigned', details: `Vendor set to ${vendor?.name}` });
    } else {
      activities.push({ action: 'vendor_removed', details: 'Vendor removed' });
    }
  }
  if ('dueDate' in data) {
    const newDate = data.dueDate ? new Date(data.dueDate).toDateString() : null;
    const oldDate = existing.dueDate?.toDateString() ?? null;
    if (newDate !== oldDate) {
      activities.push({
        action: 'due_date_set',
        details: data.dueDate ? `Due date set to ${new Date(data.dueDate).toLocaleDateString()}` : 'Due date cleared',
      });
    }
  }

  const updated = await prisma.issue.update({
    where: { id },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.priority ? { priority: data.priority } : {}),
      ...('assignedToId' in data ? { assignedToId: data.assignedToId } : {}),
      ...('vendorId' in data ? { vendorId: data.vendorId } : {}),
      ...('dueDate' in data ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
    },
    include: {
      resident: { select: { id: true, firstName: true, lastName: true, email: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
      vendor: { select: { id: true, name: true, contactName: true, phone: true } },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { firstName: true, lastName: true, role: true } } },
      },
      activities: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { firstName: true, lastName: true, role: true } } },
      },
    },
  });

  for (const act of activities) {
    await prisma.issueActivity.create({
      data: { issueId: id, actorId: session.id, ...act },
    });
  }

  await createAuditLog({
    userId: session.id,
    action: 'issue.update',
    entityType: 'Issue',
    entityId: id,
    metadata: data as object,
  });

  return ok({ issue: updated });
}
