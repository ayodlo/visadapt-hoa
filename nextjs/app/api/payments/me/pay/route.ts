import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

const schema = z.object({
  amount: z.number().int().positive(),
  paymentMethod: z.enum(['Credit Card', 'Debit Card', 'Bank Transfer', 'Check']),
});

function generateConfirmationNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `CHQ-${ts}-${rand}`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const { amount, paymentMethod } = parsed.data;

  // Validate there is an outstanding balance
  const outstanding = await prisma.charge.findMany({
    where: { residentId: session.id, status: { in: ['PENDING', 'OVERDUE'] } },
    orderBy: [{ status: 'desc' }, { dueDate: 'asc' }], // OVERDUE first
  });

  const totalOwed = outstanding.reduce((s, c) => s + c.amount, 0);
  if (totalOwed === 0) return err('No outstanding balance to pay', 400);
  if (amount > totalOwed) return err(`Amount exceeds balance of $${(totalOwed / 100).toFixed(2)}`, 400);

  const confirmationNumber = generateConfirmationNumber();
  const now = new Date();

  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      residentId: session.id,
      communityId,
      amount,
      paymentMethod,
      status: 'PAID',
      paidAt: now,
      confirmationNumber,
    },
  });

  // Apply payment to charges oldest/overdue first
  let remaining = amount;
  for (const charge of outstanding) {
    if (remaining <= 0) break;
    if (remaining >= charge.amount) {
      await prisma.charge.update({ where: { id: charge.id }, data: { status: 'PAID' } });
      remaining -= charge.amount;
    }
    // partial: leave charge as-is, just stop (simplest approach)
  }

  await createAuditLog({
    userId: session.id,
    action: 'payment.create',
    entityType: 'Payment',
    entityId: payment.id,
    metadata: { amount, paymentMethod, confirmationNumber },
  });

  return ok({
    payment,
    receipt: {
      confirmationNumber,
      amount,
      paymentMethod,
      paidAt: now.toISOString(),
    },
  });
}
