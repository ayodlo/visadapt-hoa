import { z } from 'zod';
import { DuesStatus } from '@prisma/client';

export const createDuesSchema = z.object({
  label: z.string().min(1).max(200),
  amountCents: z.number().int().positive(),
  dueDate: z.string().datetime(),
  notes: z.string().optional(),
  userIds: z.array(z.string().min(1)).min(1, 'Select at least one resident'),
});

export const updateDuesStatusSchema = z.object({
  status: z.nativeEnum(DuesStatus),
  notes: z.string().optional(),
});

export type CreateDuesInput = z.infer<typeof createDuesSchema>;
