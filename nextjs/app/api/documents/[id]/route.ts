import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { deleteS3Object } from '@/lib/s3';
import { ok, unauthorized, forbidden, notFound } from '@/lib/api';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return notFound('Document');

  await deleteS3Object(doc.filename).catch(() => {});
  await prisma.document.delete({ where: { id } });
  return ok({ deleted: true });
}
