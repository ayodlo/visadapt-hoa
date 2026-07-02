import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, unauthorized } from '@/lib/api';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const payments = await prisma.payment.findMany({
    where: { residentId: session.id },
    orderBy: { createdAt: 'desc' },
  });

  return ok({ payments });
}
