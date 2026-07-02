import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, unauthorized, forbidden } from '@/lib/api';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const vendors = await prisma.vendor.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, contactName: true, category: true },
  });

  return ok({ vendors });
}
