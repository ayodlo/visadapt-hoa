import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, unauthorized, notFound } from '@/lib/api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return notFound('Document');

  return ok({ url: doc.fileUrl, fileName: doc.fileName });
}
