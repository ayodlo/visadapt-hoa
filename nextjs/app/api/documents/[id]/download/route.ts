import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getPresignedDownloadUrl } from '@/lib/s3';
import { ok, unauthorized, notFound } from '@/lib/api';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return notFound('Document');

  const url = await getPresignedDownloadUrl(doc.filename, doc.name);
  return ok({ url });
}
