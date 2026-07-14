import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { sendPushToUsers } from '@/lib/push';

const schema = z.object({
  body: z.string().min(1).max(2000),
  isInternal: z.boolean().default(false),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const { id } = await params;
  const issue = await prisma.issue.findUnique({ where: { id }, select: { id: true, residentId: true, title: true } });
  if (!issue) return notFound('Issue');

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const comment = await prisma.issueComment.create({
    data: {
      issueId: id,
      authorId: session.id,
      body: parsed.data.body,
      isInternal: parsed.data.isInternal,
    },
    include: { author: { select: { firstName: true, lastName: true, role: true } } },
  });

  if (!parsed.data.isInternal) {
    await prisma.issueActivity.create({
      data: {
        issueId: id,
        actorId: session.id,
        action: 'comment_added',
        details: 'Admin added a public comment',
      },
    });
    await sendPushToUsers([issue.residentId], {
      title: 'New Issue Comment',
      body: `New comment on "${issue.title}"`,
      data: { type: 'issue', id },
    });
  }

  return ok({ comment }, 201);
}
