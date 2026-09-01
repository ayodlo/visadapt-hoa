import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { deleteS3Object, getPresignedViewUrl, uploadToS3 } from '@/lib/s3';
import { eventImageKey, validateImage } from '@/lib/uploads';

/**
 * Attach or replace an event's feature image.
 *
 * Kept separate from POST /api/events so the JSON create contract stays intact
 * for the mobile client, and so an image can be added to an event later.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event || event.communityId !== communityId) return notFound('Event');

  const form = await req.formData().catch(() => null);
  const file = form?.get('image');
  if (!(file instanceof File)) return err('No image supplied', 400);

  const invalid = validateImage({ type: file.type, size: file.size, name: file.name });
  if (invalid) return err(invalid, 400);

  const key = eventImageKey(communityId, id, file.type, randomUUID());

  // Upload before touching the database: if S3 rejects the object we must not
  // leave the event pointing at a key that was never stored.
  try {
    await uploadToS3(key, Buffer.from(await file.arrayBuffer()), file.type);
  } catch {
    return err('Could not store the image. Please try again.', 502);
  }

  const previousKey = event.imageKey;
  await prisma.event.update({ where: { id }, data: { imageKey: key } });

  // Best-effort cleanup of the replaced object; a leftover orphan is harmless
  // next to failing a request whose visible work already succeeded.
  if (previousKey && previousKey !== key) {
    await deleteS3Object(previousKey).catch(() => {});
  }

  return ok({ imageUrl: await getPresignedViewUrl(key) });
}

/** Remove an event's image, leaving the event itself untouched. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event || event.communityId !== communityId) return notFound('Event');

  if (event.imageKey) {
    await deleteS3Object(event.imageKey).catch(() => {});
    await prisma.event.update({ where: { id }, data: { imageKey: null } });
  }

  return ok({ imageUrl: null });
}
