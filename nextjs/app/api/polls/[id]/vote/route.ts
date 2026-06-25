import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, err, unauthorized, notFound } from '@/lib/api';

const schema = z.object({ optionId: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id: pollId } = await params;
  const poll = await prisma.poll.findUnique({ where: { id: pollId } });
  if (!poll) return notFound('Poll');
  if (poll.closesAt && poll.closesAt < new Date()) return err('Poll is closed', 400);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err('Invalid option', 400);

  const existing = await prisma.pollVote.findUnique({ where: { pollId_userId: { pollId, userId: session.id } } });
  if (existing) return err('Already voted', 409);

  const vote = await prisma.pollVote.create({
    data: { pollId, optionId: parsed.data.optionId, userId: session.id },
  });
  return ok(vote, 201);
}
