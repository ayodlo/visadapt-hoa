import { z } from 'zod';

export const createPollSchema = z.object({
  question: z.string().min(1).max(500),
  description: z.string().optional(),
  closesAt: z.string().datetime().optional(),
  options: z.array(z.string().min(1)).min(2, 'At least two options required').max(10),
});

export const castVoteSchema = z.object({
  optionId: z.string().min(1),
});

export type CreatePollInput = z.infer<typeof createPollSchema>;
