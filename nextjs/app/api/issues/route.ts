import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

const schema = z.object({
  category: z.enum(['LANDSCAPING', 'MAINTENANCE', 'PARKING', 'SAFETY', 'NOISE', 'GATE_ACCESS', 'TRASH', 'OTHER']),
  title: z.string().min(5).max(200),
  description: z.string().min(10),
  location: z.string().min(3).max(300),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  preferredContactMethod: z.enum(['Email', 'Phone', 'Text']),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const issue = await prisma.issue.create({
    data: { residentId: session.id, ...parsed.data },
  });

  await prisma.issueActivity.create({
    data: {
      issueId: issue.id,
      actorId: session.id,
      action: 'created',
      details: 'Issue submitted',
    },
  });

  await createAuditLog({
    userId: session.id,
    action: 'issue.create',
    entityType: 'Issue',
    entityId: issue.id,
    metadata: { category: issue.category, title: issue.title },
  });

  return ok({ issue }, 201);
}
