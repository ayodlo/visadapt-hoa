import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { isStaff } from '@/lib/roles';
import { sendPushToUsers } from '@/lib/push';
import { sendNewMaintenanceRequestEmail } from '@/lib/email';
import { ok, err, unauthorized } from '@/lib/api';
import { formatRequestNumber, isEmergency, maintenanceRequestSchema, staffQuickRequestSchema } from '@/lib/maintenance';
import { copyS3Object, deleteS3Object, headS3Object } from '@/lib/s3';
import {
  MAX_DIRECT_UPLOAD_BYTES,
  isStagedKeyFor,
  maintenanceAttachmentKey,
} from '@/lib/uploads';

/** Bounded so one submission cannot enqueue unlimited S3 work. */
const MAX_ATTACHMENTS = 10;

const INCLUDE = {
  submittedBy: { select: { id: true, firstName: true, lastName: true } },
  property: { select: { id: true, streetAddress: true, unitNumber: true } },
  _count: { select: { attachments: true } },
};

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  // Staff triage the whole queue; a resident sees only their own requests.
  // Previously everyone saw every request in the community.
  const requests = await prisma.maintenanceRequest.findMany({
    where: { communityId, ...(isStaff(session.role) ? {} : { submittedById: session.id }) },
    orderBy: { createdAt: 'desc' },
    include: INCLUDE,
  });
  return ok(requests);
}

/**
 * Allocate the next per-year request number.
 *
 * Retried because two concurrent submissions can derive the same sequence; the
 * unique index on `requestNumber` is what actually guarantees correctness, and
 * this loop just turns that collision into a fresh attempt.
 */
async function createWithRequestNumber(
  data: Omit<Prisma.MaintenanceRequestUncheckedCreateInput, 'requestNumber'>,
  attempts = 5
) {
  const year = new Date().getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));

  for (let attempt = 0; attempt < attempts; attempt++) {
    const used = await prisma.maintenanceRequest.count({
      where: { communityId: data.communityId, createdAt: { gte: yearStart } },
    });
    try {
      return await prisma.maintenanceRequest.create({
        data: { ...data, requestNumber: formatRequestNumber(year, used + 1 + attempt) },
        include: INCLUDE,
      });
    } catch (error) {
      const conflict =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (!conflict || attempt === attempts - 1) throw error;
    }
  }
  throw new Error('Could not allocate a request number');
}

/**
 * Tell the people who triage that a request exists.
 *
 * Nothing announced a new submission before this, so the queue was only ever
 * discovered by someone happening to open the page. Scoped to admins (mirroring
 * `isAdmin`) rather than every non-resident: board members can read the queue
 * but do not work it, and a push per maintenance request would be noise.
 *
 * Never throws. The request is already created and committed by this point, and
 * a notification failure must not turn a successful submission into an error
 * the resident sees.
 */
async function notifyStaffOfNewRequest(
  communityId: string,
  actorId: string,
  request: { id: string; title: string; requestNumber: string | null },
  submitterName: string,
  urgent = false
) {
  try {
    const recipients = await prisma.user.findMany({
      where: {
        id: { not: actorId },
        role: { in: ['ADMIN', 'SUPER_ADMIN'] },
        communityAssignments: { some: { communityId } },
      },
      select: { id: true, email: true, firstName: true },
    });
    if (recipients.length === 0) return;

    // Email is the channel that actually lands: maintenance is web-only, and
    // sendPushToUsers no-ops for anyone without a mobile push token. The push
    // is still sent so this behaves like every other feature once a mobile
    // maintenance screen exists.
    await Promise.allSettled(
      recipients.map((r) =>
        sendNewMaintenanceRequestEmail(
          r.email,
          r.firstName,
          {
            id: request.id,
            title: request.title,
            requestNumber: request.requestNumber,
            submitterName: submitterName,
          },
          urgent
        )
      )
    );

    await sendPushToUsers(recipients.map((r) => r.id), {
      title: urgent ? 'Emergency Maintenance Request' : 'New Maintenance Request',
      body: `${request.requestNumber ?? 'Request'}: ${request.title}`,
      data: { type: 'maintenance', id: request.id },
    });
  } catch (error) {
    const { name, message } = error as Error;
    console.error(`[maintenance] could not notify staff of ${request.id}: ${name}: ${message}`);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const body = await req.json().catch(() => null);

  // Residents must satisfy the full resident schema. Staff may additionally use
  // the quick-entry shape when logging a request on someone's behalf.
  const full = maintenanceRequestSchema.safeParse(body);
  if (!full.success) {
    if (!isStaff(session.role)) return err(full.error.issues[0].message, 400);

    const quick = staffQuickRequestSchema.safeParse(body);
    if (!quick.success) return err(quick.error.issues[0].message, 400);

    const request = await createWithRequestNumber({
      ...quick.data,
      status: 'SUBMITTED',
      submittedById: session.id,
      communityId,
    });
    await notifyStaffOfNewRequest(
      communityId,
      session.id,
      request,
      `${session.firstName} ${session.lastName}`
    );
    return ok(request, 201);
  }

  const { propertyId, firstObservedAt, ...rest } = full.data;

  // Never trust a client-supplied propertyId: it must belong to this community,
  // and to the submitter unless staff are filing on someone's behalf.
  let verifiedPropertyId: string | null = null;
  if (propertyId) {
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        communityId,
        ...(isStaff(session.role) ? {} : { ownerId: session.id }),
      },
      select: { id: true },
    });
    if (!property) return err('That property is not available to you', 403);
    verifiedPropertyId = property.id;
  }

  // Attachments were uploaded straight to S3 before submit; the client returns
  // the keys the server issued. Verify every one against the bucket *before*
  // creating anything, so a bad key can never produce a request with a broken
  // attachment — and reject rather than silently drop it.
  const stagedKeys = Array.isArray(body?.attachmentKeys) ? (body.attachmentKeys as unknown[]) : [];
  if (stagedKeys.length > MAX_ATTACHMENTS) {
    return err(`Attach at most ${MAX_ATTACHMENTS} files.`, 400);
  }

  const verified: { key: string; fileName: string; contentType: string; size: number }[] = [];
  for (const candidate of stagedKeys) {
    if (typeof candidate !== 'string' || !isStagedKeyFor(candidate, communityId, 'maintenance')) {
      return err('An attachment could not be verified. Please re-upload it.', 400);
    }
    const head = await headS3Object(candidate);
    // The signature could not enforce size, so the stored object is the authority.
    if (!head || head.size <= 0 || head.size > MAX_DIRECT_UPLOAD_BYTES) {
      await deleteS3Object(candidate).catch(() => {});
      return err('An attachment was missing or too large. Please re-upload it.', 400);
    }
    verified.push({
      key: candidate,
      fileName: candidate.split('/').pop()?.replace(/^[0-9a-f-]{36}-/, '') ?? 'file',
      contentType: head.contentType,
      size: head.size,
    });
  }

  const request = await createWithRequestNumber({
    ...rest,
    specificLocation: rest.specificLocation || null,
    accessInstructions: rest.accessInstructions || null,
    firstObservedAt: firstObservedAt ? new Date(firstObservedAt) : null,
    status: 'SUBMITTED',
    propertyId: verifiedPropertyId,
    submittedById: session.id,
    communityId,
  });

  // Promote each staged object to its permanent key. Staged objects are expected
  // to be expired by a lifecycle rule, so a confirmed attachment must not be
  // left behind in that prefix.
  for (const file of verified) {
    const finalKey = maintenanceAttachmentKey(communityId, request.id, file.fileName, randomUUID());
    try {
      await copyS3Object(file.key, finalKey);
    } catch (error) {
      const { name, message } = error as Error;
      console.error(`[maintenance] could not promote ${file.key}: ${name}: ${message}`);
      continue;
    }
    await prisma.maintenanceAttachment.create({
      data: {
        requestId: request.id,
        storageKey: finalKey,
        fileName: file.fileName,
        contentType: file.contentType,
        sizeBytes: file.size,
        uploadedById: session.id,
      },
    });
    await deleteS3Object(file.key).catch(() => {});
  }

  await notifyStaffOfNewRequest(
    communityId,
    session.id,
    request,
    `${session.firstName} ${session.lastName}`,
    isEmergency(rest.residentUrgency ?? '')
  );

  return ok(request, 201);
}
