import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { sendPushToUsers } from '@/lib/push';

const schema = z.object({ body: z.string().min(1).max(2000) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const issue = await prisma.issue.findUnique({ where: { id }, select: { residentId: true, assignedToId: true, title: true } });
  if (!issue) return notFound('Issue');

  // Residents can only comment on their own issues
  if (session.role === 'RESIDENT' && issue.residentId !== session.id) return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const comment = await prisma.issueComment.create({
    data: {
      issueId: id,
      authorId: session.id,
      body: parsed.data.body,
      isInternal: false,
    },
    include: { author: { select: { firstName: true, lastName: true, role: true } } },
  });

  if (issue.assignedToId) {
    await sendPushToUsers([issue.assignedToId], {
      title: 'New Issue Comment',
      body: `New comment on "${issue.title}"`,
      data: { type: 'issue', id },
    });
  }

  return ok({ comment }, 201);
}
