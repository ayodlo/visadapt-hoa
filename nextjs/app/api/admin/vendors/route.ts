import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { isAdmin } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const vendors = await prisma.vendor.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, contactName: true, category: true },
  });

  return ok({ vendors });
}

const createSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isAdmin(session.role)) return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const vendor = await prisma.vendor.create({ data: parsed.data });

  await createAuditLog({ userId: session.id, action: 'vendor.create', entityType: 'Vendor', entityId: vendor.id });

  return ok({ vendor }, 201);
}
