import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden, notFound } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

const schema = z.object({
  body: z.string().min(10, 'Response must be at least 10 characters').max(3000),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'RESIDENT') return forbidden();

  const { id } = await params;
  const violation = await prisma.violation.findUnique({ where: { id } });
  if (!violation) return notFound('Violation');
  if (violation.residentId !== session.id) return forbidden();
  if (violation.status !== 'NOTICE_SENT') {
    return err('You can only respond to a notice that has been sent.', 400);
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const [comment] = await prisma.$transaction([
    prisma.violationComment.create({
      data: {
        violationId: id,
        authorId: session.id,
        body: parsed.data.body,
        isInternal: false,
      },
    }),
    prisma.violation.update({
      where: { id },
      data: { status: 'RESIDENT_RESPONDED' },
    }),
  ]);

  await prisma.violationActivity.create({
    data: {
      violationId: id,
      actorId: session.id,
      action: 'resident_responded',
      details: 'Resident submitted a response',
    },
  });

  await createAuditLog({
    userId: session.id,
    action: 'violation.respond',
    entityType: 'Violation',
    entityId: id,
  });

  return ok({ comment }, 201);
}
