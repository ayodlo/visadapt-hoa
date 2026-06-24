import { z } from 'zod';
import { RequestStatus, RequestPriority } from '@prisma/client';

export const createMaintenanceSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  priority: z.nativeEnum(RequestPriority).default('MEDIUM'),
});

export const updateStatusSchema = z.object({
  status: z.nativeEnum(RequestStatus),
});

export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>;
