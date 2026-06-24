import { prisma } from '../utils/prisma';

export async function createAuditLog({
  userId,
  action,
  entityType,
  entityId,
  metadata,
}: {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: { userId, action, entityType, entityId, metadata },
  });
}
