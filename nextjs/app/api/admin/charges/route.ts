import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { isAdmin } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';
import { chargeStatusFor } from '@/lib/charges';

/**
 * Posting a charge to a resident's account — deliverable #17, "assign specific
 * amounts owed to specific residents".
 *
 * Amounts are per-charge and per-resident with nothing shared or defaulted, so
 * three residents can owe $250, $300 and $425 without any notion of a standard
 * assessment. Recurring/scheduled assessments are deliberately NOT here: that is
 * the separate "Assessments" concept and needs a product decision about whether it
 * generates Charge rows or revives DuesRecord.
 */
const createSchema = z.object({
  residentId: z.string().min(1, 'Resident is required'),
  description: z.string().trim().min(1, 'Description is required').max(200),
  /** Cents, to match Charge.amount and every other money field in the app. */
  amount: z.number().int().positive('Amount must be greater than zero'),
  dueDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Due date is invalid'),
  propertyId: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  // Reads are open to all staff; posting a charge moves money into someone's
  // ledger, so it follows the same isAdmin gate as vendors and announcements.
  if (!isAdmin(session.role)) return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const { residentId, description, amount, dueDate, propertyId } = parsed.data;

  // The resident must live in the community being administered. Without this an
  // admin could post a charge into another association's ledger by id.
  const resident = await prisma.user.findFirst({
    where: { id: residentId, role: 'RESIDENT', communityId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!resident) return err('Resident not found in this community', 404);

  if (propertyId) {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, communityId, ownerId: residentId },
      select: { id: true },
    });
    if (!property) return err('Property not found for this resident', 404);
  }

  const due = new Date(dueDate);

  // Nothing in this codebase ages a PENDING charge into OVERDUE — there is no cron
  // or scheduler anywhere. A charge backdated past its due date is therefore
  // created OVERDUE directly, so it is not silently filed as current. Shared with
  // PATCH via chargeStatusFor so the two cannot drift.
  const status = chargeStatusFor({ amount, amountPaid: 0, dueDate: due });

  const charge = await prisma.charge.create({
    data: {
      residentId,
      communityId,
      propertyId: propertyId ?? null,
      description,
      amount,
      dueDate: due,
      status,
    },
  });

  await createAuditLog({
    userId: session.id,
    action: 'charge.create',
    entityType: 'Charge',
    entityId: charge.id,
    metadata: {
      residentId,
      amount,
      status,
      dueDate: due.toISOString(),
      description,
    },
  });

  return ok({ charge }, 201);
}

