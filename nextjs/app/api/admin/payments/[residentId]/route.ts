import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, unauthorized, forbidden, notFound } from '@/lib/api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ residentId: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const { residentId } = await params;
  const resident = await prisma.user.findUnique({
    where: { id: residentId, role: 'RESIDENT' },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  if (!resident) return notFound('Resident');

  const [charges, payments] = await Promise.all([
    prisma.charge.findMany({ where: { residentId }, orderBy: { dueDate: 'desc' } }),
    prisma.payment.findMany({ where: { residentId }, orderBy: { createdAt: 'desc' } }),
  ]);

  const balance = charges.filter((c) => c.status === 'PENDING' || c.status === 'OVERDUE').reduce((s, c) => s + c.amount, 0);
  const overdueAmount = charges.filter((c) => c.status === 'OVERDUE').reduce((s, c) => s + c.amount, 0);

  return ok({ resident, charges, payments, summary: { balance, overdueAmount } });
}
