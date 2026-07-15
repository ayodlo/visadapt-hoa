import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { isAdmin } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';

const schema = z.object({
  body: z.string().min(1).max(2000),
  isInternal: z.boolean().default(false),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isAdmin(session.role)) return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { id } = await params;
  const request = await prisma.architecturalRequest.findUnique({ where: { id } });
  if (!request || request.communityId !== communityId) return notFound('Architectural request');

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const comment = await prisma.architecturalRequestComment.create({
    data: { requestId: id, authorId: session.id, body: parsed.data.body, isInternal: parsed.data.isInternal },
    include: { author: { select: { firstName: true, lastName: true, role: true } } },
  });

  if (!parsed.data.isInternal) {
    await prisma.architecturalRequestActivity.create({
      data: { requestId: id, actorId: session.id, action: 'comment_added', details: 'Reviewer added a comment' },
    });
  }

  return ok({ comment }, 201);
}
