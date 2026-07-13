import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { isAdmin } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { ok, err, unauthorized, forbidden } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  // Roster includes every member's email — staff only.
  if (session.role === 'RESIDENT') return forbidden();

  const users = await prisma.user.findMany({
    orderBy: { lastName: 'asc' },
    select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true },
  });
  return ok(users);
}

const createSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  // SUPER_ADMIN is engineer-only and is never assignable here — see prisma/create-super-admin.ts.
  role: z.enum(['ADMIN', 'BOARD_MEMBER', 'RESIDENT']).default('RESIDENT'),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isAdmin(session.role)) return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const { firstName, lastName, email, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return err('Email already in use', 409);

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { firstName, lastName, email, passwordHash, role },
    select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true },
  });

  await createAuditLog({ userId: session.id, action: 'user.create', entityType: 'User', entityId: user.id, metadata: { role } });

  return ok(user, 201);
}
