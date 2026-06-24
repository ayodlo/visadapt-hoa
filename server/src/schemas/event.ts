import { z } from 'zod';

export const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  location: z.string().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
