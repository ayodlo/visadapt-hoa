import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';

const schema = z.object({
  body: z.string().min(1, 'Comment cannot be empty').max(2000),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'RESIDENT') return forbidden();

  const { id } = await params;
  const request = await prisma.architecturalRequest.findUnique({ where: { id } });
  if (!request) return notFound('Architectural request');
  if (request.residentId !== session.id) return forbidden();
  if (request.status === 'WITHDRAWN' || request.status === 'APPROVED' || request.status === 'DENIED') {
    return err('Comments cannot be added to a closed request.', 400);
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const comment = await prisma.architecturalRequestComment.create({
    data: {
      requestId: id,
      authorId: session.id,
      body: parsed.data.body,
      isInternal: false,
    },
    include: { author: { select: { firstName: true, lastName: true, role: true } } },
  });

  await prisma.architecturalRequestActivity.create({
    data: { requestId: id, actorId: session.id, action: 'comment_added', details: 'Resident added a comment' },
  });

  return ok({ comment }, 201);
}
