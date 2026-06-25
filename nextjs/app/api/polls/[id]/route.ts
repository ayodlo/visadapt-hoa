import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, unauthorized, forbidden, notFound } from '@/lib/api';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const { id } = await params;
  const existing = await prisma.poll.findUnique({ where: { id } });
  if (!existing) return notFound('Poll');

  await prisma.poll.delete({ where: { id } });
  return ok({ deleted: true });
}
