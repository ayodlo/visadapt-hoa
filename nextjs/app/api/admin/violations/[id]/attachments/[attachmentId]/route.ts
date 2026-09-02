import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { isAdmin } from '@/lib/roles';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { deleteS3Object } from '@/lib/s3';
import { createAuditLog } from '@/lib/audit';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isAdmin(session.role)) return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { id, attachmentId } = await params;

  // Scope through the parent violation so an attachment id from another
  // community cannot be deleted by guessing it.
  const attachment = await prisma.violationAttachment.findFirst({
    where: { id: attachmentId, violationId: id, violation: { communityId } },
  });
  if (!attachment) return notFound('Attachment');

  // Remove the row first: an orphaned object is recoverable, a row pointing at
  // a deleted object renders as a broken link.
  await prisma.violationAttachment.delete({ where: { id: attachmentId } });
  await deleteS3Object(attachment.storageKey).catch(() => {});

  await createAuditLog({
    userId: session.id,
    action: 'violation.attachment.delete',
    entityType: 'ViolationAttachment',
    entityId: attachmentId,
    metadata: { violationId: id, fileName: attachment.fileName },
  });

  return ok({ deleted: true });
}
