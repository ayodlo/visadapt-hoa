import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { isAdmin } from '@/lib/roles';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { getPresignedDownloadUrl, getPresignedViewUrl, uploadToS3 } from '@/lib/s3';
import { isImageType, validateAttachment, violationAttachmentKey } from '@/lib/uploads';
import { createAuditLog } from '@/lib/audit';

/** Staff may read a violation; only admins may change it — mirrors the parent routes. */
async function loadViolation(id: string, communityId: string) {
  const violation = await prisma.violation.findUnique({ where: { id } });
  if (!violation || violation.communityId !== communityId) return null;
  return violation;
}

/**
 * Attachments with short-lived URLs. Images get an inline view URL so they can
 * render in an <img>; documents get a download URL that preserves the original
 * filename. `storageKey` is never returned — the bucket stays private.
 */
async function present(rows: {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  createdAt: Date;
  uploadedBy: { firstName: string; lastName: string };
}[]) {
  return Promise.all(
    rows.map(async ({ storageKey, uploadedBy, ...rest }) => ({
      ...rest,
      isImage: isImageType(rest.contentType),
      uploadedBy: `${uploadedBy.firstName} ${uploadedBy.lastName}`,
      url: await (isImageType(rest.contentType)
        ? getPresignedViewUrl(storageKey)
        : getPresignedDownloadUrl(storageKey, rest.fileName)
      ).catch(() => null),
    }))
  );
}

const SELECT = {
  id: true,
  fileName: true,
  contentType: true,
  sizeBytes: true,
  storageKey: true,
  createdAt: true,
  uploadedBy: { select: { firstName: true, lastName: true } },
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { id } = await params;
  if (!(await loadViolation(id, communityId))) return notFound('Violation');

  const attachments = await prisma.violationAttachment.findMany({
    where: { violationId: id },
    orderBy: { createdAt: 'asc' },
    select: SELECT,
  });

  return ok({ attachments: await present(attachments) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isAdmin(session.role)) return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { id } = await params;
  if (!(await loadViolation(id, communityId))) return notFound('Violation');

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return err('No file supplied', 400);

  const invalid = validateAttachment({ type: file.type, size: file.size, name: file.name });
  if (invalid) return err(invalid, 400);

  if (!process.env.AWS_S3_BUCKET) {
    console.error('[violation-attachment] AWS_S3_BUCKET is not set — storage unconfigured');
    return err('File storage is not configured. Contact your administrator.', 503);
  }

  const key = violationAttachmentKey(communityId, id, file.name, randomUUID());

  // Store the object before recording it: a database row pointing at an object
  // that was never written is worse than no row at all.
  try {
    await uploadToS3(key, Buffer.from(await file.arrayBuffer()), file.type);
  } catch (error) {
    const { name, message } = error as Error;
    console.error(
      `[violation-attachment] S3 upload failed: ${name}: ${message} ` +
        `(bucket=${process.env.AWS_S3_BUCKET}, region=${process.env.AWS_REGION ?? 'us-east-1'}, key=${key})`
    );
    return err('Could not store the file. Please try again.', 502);
  }

  const created = await prisma.violationAttachment.create({
    data: {
      violationId: id,
      storageKey: key,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      uploadedById: session.id,
    },
    select: SELECT,
  });

  await createAuditLog({
    userId: session.id,
    action: 'violation.attachment.create',
    entityType: 'ViolationAttachment',
    entityId: created.id,
    metadata: { violationId: id, fileName: file.name, sizeBytes: file.size },
  });

  return ok({ attachment: (await present([created]))[0] }, 201);
}
