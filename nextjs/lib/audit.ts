import { prisma } from './prisma';

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
  metadata?: object;
}): Promise<void> {
  await prisma.auditLog.create({
    data: { userId, action, entityType, entityId, metadata },
  }).catch(() => {});
}
