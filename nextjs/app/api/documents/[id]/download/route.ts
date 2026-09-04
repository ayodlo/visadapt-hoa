import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { ok, err, unauthorized, notFound } from '@/lib/api';
import { getPresignedDownloadUrl } from '@/lib/s3';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc || doc.communityId !== communityId) return notFound('Document');

  // An uploaded file lives in a private bucket, so it is served through a
  // short-lived presigned URL. Legacy documents still carry an external link.
  if (doc.storageKey) {
    try {
      const url = await getPresignedDownloadUrl(doc.storageKey, doc.fileName);
      return ok({ url, fileName: doc.fileName });
    } catch (error) {
      const { name, message } = error as Error;
      console.error(`[documents] could not sign download for ${doc.id}: ${name}: ${message}`);
      return err('Could not prepare the download. Please try again.', 502);
    }
  }

  if (!doc.fileUrl) return notFound('Document file');

  return ok({ url: doc.fileUrl, fileName: doc.fileName });
}
