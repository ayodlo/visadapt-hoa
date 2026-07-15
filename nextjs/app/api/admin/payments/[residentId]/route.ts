import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ residentId: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { residentId } = await params;
  const resident = await prisma.user.findUnique({
    where: { id: residentId, role: 'RESIDENT' },
    select: { id: true, firstName: true, lastName: true, email: true, communityId: true },
  });
  if (!resident || resident.communityId !== communityId) return notFound('Resident');

  const [charges, payments] = await Promise.all([
    prisma.charge.findMany({ where: { residentId }, orderBy: { dueDate: 'desc' } }),
    prisma.payment.findMany({ where: { residentId }, orderBy: { createdAt: 'desc' } }),
  ]);

  const balance = charges.filter((c) => c.status === 'PENDING' || c.status === 'OVERDUE').reduce((s, c) => s + c.amount, 0);
  const overdueAmount = charges.filter((c) => c.status === 'OVERDUE').reduce((s, c) => s + c.amount, 0);

  return ok({ resident, charges, payments, summary: { balance, overdueAmount } });
}
