import { z } from 'zod';

export const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
