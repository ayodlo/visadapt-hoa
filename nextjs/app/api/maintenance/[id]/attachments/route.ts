import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { isStaff } from '@/lib/roles';
import { ok, err, unauthorized, notFound } from '@/lib/api';
import { getPresignedDownloadUrl, getPresignedViewUrl, uploadToS3 } from '@/lib/s3';
import { isImageType, sanitizeFileName, validateAttachment } from '@/lib/uploads';

/**
 * Attachments live under the same bucket as event images and violation
 * evidence, separated by prefix: communities/<id>/maintenance/<requestId>/…
 */
function attachmentKey(communityId: string, requestId: string, fileName: string, unique: string) {
  return `communities/${communityId}/maintenance/${requestId}/${unique}-${sanitizeFileName(fileName)}`;
}

/** A resident may only touch their own request; staff may touch any in-community. */
async function loadRequest(id: string, communityId: string, userId: string, staff: boolean) {
  return prisma.maintenanceRequest.findFirst({
    where: { id, communityId, ...(staff ? {} : { submittedById: userId }) },
    select: { id: true },
  });
}

const SELECT = {
  id: true,
  fileName: true,
  contentType: true,
  sizeBytes: true,
  storageKey: true,
  createdAt: true,
};

async function present(rows: (typeof SELECT extends never ? never : {
  id: string; fileName: string; contentType: string; sizeBytes: number; storageKey: string; createdAt: Date;
})[]) {
  return Promise.all(
    rows.map(async ({ storageKey, ...rest }) => ({
      ...rest,
      isImage: isImageType(rest.contentType),
      url: await (isImageType(rest.contentType)
        ? getPresignedViewUrl(storageKey)
        : getPresignedDownloadUrl(storageKey, rest.fileName)
      ).catch(() => null),
    }))
  );
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { id } = await params;
  if (!(await loadRequest(id, communityId, session.id, isStaff(session.role)))) {
    return notFound('Maintenance request');
  }

  const attachments = await prisma.maintenanceAttachment.findMany({
    where: { requestId: id },
    orderBy: { createdAt: 'asc' },
    select: SELECT,
  });
  return ok({ attachments: await present(attachments) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { id } = await params;
  if (!(await loadRequest(id, communityId, session.id, isStaff(session.role)))) {
    return notFound('Maintenance request');
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return err('No file supplied', 400);

  const invalid = validateAttachment({ type: file.type, size: file.size, name: file.name });
  if (invalid) return err(invalid, 400);

  if (!process.env.AWS_S3_BUCKET) {
    console.error('[maintenance-attachment] AWS_S3_BUCKET is not set — storage unconfigured');
    return err('File storage is not configured. Contact your administrator.', 503);
  }

  const key = attachmentKey(communityId, id, file.name, randomUUID());

  // Store the object before recording it, so a failed upload cannot leave a row
  // pointing at something that was never written.
  try {
    await uploadToS3(key, Buffer.from(await file.arrayBuffer()), file.type);
  } catch (error) {
    const { name, message } = error as Error;
    console.error(
      `[maintenance-attachment] S3 upload failed: ${name}: ${message} ` +
        `(bucket=${process.env.AWS_S3_BUCKET}, region=${process.env.AWS_REGION ?? 'us-east-1'}, key=${key})`
    );
    return err('Could not store the file. Please try again.', 502);
  }

  const created = await prisma.maintenanceAttachment.create({
    data: {
      requestId: id,
      storageKey: key,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      uploadedById: session.id,
    },
    select: SELECT,
  });

  return ok({ attachment: (await present([created]))[0] }, 201);
}
