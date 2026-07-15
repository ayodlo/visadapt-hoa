import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { isAdmin } from '@/lib/roles';
import { ok, err, unauthorized, forbidden } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';

const CATEGORIES = ['CC_AND_RS', 'RULES_AND_REGS', 'MEETING_MINUTES', 'FINANCIALS', 'INSURANCE', 'COMMUNITY_FORMS', 'MAINTENANCE', 'OTHER'] as const;

const createSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  category: z.enum(CATEGORIES),
  fileUrl: z.string().min(1, 'File URL is required'),
  fileName: z.string().min(1, 'File name is required'),
});

const INCLUDE = { uploadedBy: { select: { id: true, firstName: true, lastName: true } } };

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const { searchParams } = req.nextUrl;
  const search = searchParams.get('search')?.trim() ?? '';
  const category = searchParams.get('category')?.trim() ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '12', 10)));

  const where = {
    communityId,
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(category ? { category: category as (typeof CATEGORIES)[number] } : {}),
  };

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: INCLUDE,
    }),
    prisma.document.count({ where }),
  ]);

  return ok({ documents, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isAdmin(session.role)) return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const doc = await prisma.document.create({
    data: { ...parsed.data, uploadedById: session.id, communityId },
    include: INCLUDE,
  });

  await createAuditLog({ userId: session.id, action: 'document.create', entityType: 'Document', entityId: doc.id });

  return ok(doc, 201);
}
