import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, unauthorized, forbidden } from '@/lib/api';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  // Roster includes every member's email — staff only.
  if (session.role === 'RESIDENT') return forbidden();

  const users = await prisma.user.findMany({
    orderBy: { lastName: 'asc' },
    select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true },
  });
  return ok(users);
}
