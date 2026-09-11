import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { isAdmin } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';
import { chargeBalance, chargeStatusFor } from '@/lib/charges';

type Params = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    description: z.string().trim().min(1, 'Description is required').max(200).optional(),
    amount: z.number().int().positive('Amount must be greater than zero').optional(),
    dueDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Due date is invalid').optional(),
  })
  .refine((v) => v.description !== undefined || v.amount !== undefined || v.dueDate !== undefined, {
    message: 'Nothing to update',
  });

/**
 * Correcting a charge — the "update the amount where appropriate" half of
 * deliverable #17, and the answer to a mistyped assessment.
 *
 * What can be changed depends on what has already been paid against it, because
 * `amountPaid` is money that actually arrived and cannot be edited away from here:
 *
 *   - nothing paid  -> description, amount and due date are all free to change
 *   - part paid     -> the amount may not drop below what has been received
 *   - fully paid    -> settled; correcting it means reversing the payment first
 *
 * Status is recomputed from the result rather than preserved, so lowering an
 * amount onto what has already been paid settles the charge, and moving a due date
 * into the past marks it overdue.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isAdmin(session.role)) return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { id } = await params;
  const charge = await prisma.charge.findFirst({
    where: { id, communityId },
    select: { id: true, description: true, amount: true, amountPaid: true, dueDate: true, status: true },
  });
  if (!charge) return notFound('Charge');

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const { description, amount, dueDate } = parsed.data;

  // A settled charge is history. Editing it would silently change what a paid
  // receipt refers to, so the payment has to be reversed first.
  if (charge.status === 'PAID') {
    return err('This charge is fully paid. Reverse the payment before editing it.', 409);
  }

  if (amount !== undefined && amount < charge.amountPaid) {
    return err(
      `Amount cannot be less than the $${(charge.amountPaid / 100).toFixed(2)} already paid against this charge`,
      409
    );
  }

  const next = {
    description: description ?? charge.description,
    amount: amount ?? charge.amount,
    dueDate: dueDate ? new Date(dueDate) : charge.dueDate,
  };

  const updated = await prisma.charge.update({
    where: { id: charge.id },
    data: {
      ...next,
      status: chargeStatusFor({ ...next, amountPaid: charge.amountPaid }),
    },
  });

  await createAuditLog({
    userId: session.id,
    action: 'charge.update',
    entityType: 'Charge',
    entityId: charge.id,
    metadata: {
      before: {
        description: charge.description,
        amount: charge.amount,
        dueDate: charge.dueDate.toISOString(),
        status: charge.status,
      },
      after: {
        description: updated.description,
        amount: updated.amount,
        dueDate: updated.dueDate.toISOString(),
        status: updated.status,
      },
      amountPaid: charge.amountPaid,
    },
  });

  return ok({ charge: updated });
}

/**
 * Removing a charge posted in error.
 *
 * Only ever allowed while nothing has been paid against it. Once money has
 * landed, deleting the charge would strand that money — it was applied to this
 * row, and there is no credit balance for it to fall back to — so the payment has
 * to be reversed first.
 *
 * This is a hard delete rather than a VOIDED status because adding a status would
 * mean auditing every charge filter, badge and report in the app for a state that
 * only ever means "pretend this never happened". The audit row below carries the
 * full contents of what was removed, so the record survives the row.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isAdmin(session.role)) return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { id } = await params;
  const charge = await prisma.charge.findFirst({
    where: { id, communityId },
    select: {
      id: true,
      residentId: true,
      description: true,
      amount: true,
      amountPaid: true,
      dueDate: true,
      status: true,
      createdAt: true,
    },
  });
  if (!charge) return notFound('Charge');

  if (charge.amountPaid > 0) {
    return err(
      `$${(charge.amountPaid / 100).toFixed(2)} has been paid against this charge. Reverse the payment before deleting it.`,
      409
    );
  }

  await prisma.charge.delete({ where: { id: charge.id } });

  await createAuditLog({
    userId: session.id,
    action: 'charge.delete',
    entityType: 'Charge',
    entityId: charge.id,
    // The deleted row in full — this audit entry is the only remaining record.
    metadata: {
      residentId: charge.residentId,
      description: charge.description,
      amount: charge.amount,
      dueDate: charge.dueDate.toISOString(),
      status: charge.status,
      createdAt: charge.createdAt.toISOString(),
      remainingBalance: chargeBalance(charge),
    },
  });

  return ok({ deleted: true, id: charge.id });
}
