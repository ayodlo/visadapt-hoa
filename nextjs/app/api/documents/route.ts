import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { isAdmin } from '@/lib/roles';
import { ok, err, unauthorized, forbidden } from '@/lib/api';
import { createAuditLog } from '@/lib/audit';
import { copyS3Object, deleteS3Object, headS3Object } from '@/lib/s3';
import { MAX_DIRECT_UPLOAD_BYTES, documentKey, isStagedKeyFor } from '@/lib/uploads';
import { randomUUID } from 'node:crypto';

const CATEGORIES = ['CC_AND_RS', 'RULES_AND_REGS', 'MEETING_MINUTES', 'FINANCIALS', 'INSURANCE', 'COMMUNITY_FORMS', 'MAINTENANCE', 'OTHER'] as const;

/**
 * A document is either uploaded to our bucket (`stagedKey`) or linked to a file
 * hosted elsewhere (`fileUrl`) -- never both, and never neither. The refinement
 * enforces that here rather than leaving a row that points at nothing.
 */
const createSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    category: z.enum(CATEGORIES),
    fileUrl: z.string().min(1).optional(),
    stagedKey: z.string().min(1).optional(),
    fileName: z.string().min(1, 'File name is required'),
  })
  .refine((v) => Boolean(v.fileUrl) !== Boolean(v.stagedKey), {
    message: 'Provide either an uploaded file or a file URL, not both.',
  });

const INCLUDE = { uploadedBy: { select: { id: true, firstName: true, lastName: true } } };

// Whitelisted sort columns — the `sort` param is never used as a column name directly.
const SORT_FIELDS = ['title', 'category', 'fileName', 'createdAt'] as const;
type SortField = (typeof SORT_FIELDS)[number];

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

  // Defaults preserve the previous behaviour: newest first.
  const sortParam = searchParams.get('sort') ?? '';
  const sort: SortField = (SORT_FIELDS as readonly string[]).includes(sortParam)
    ? (sortParam as SortField)
    : 'createdAt';
  const dir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';

  const where = {
    communityId,
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
            { fileName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(category ? { category: category as (typeof CATEGORIES)[number] } : {}),
  };

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { [sort]: dir },
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

  const { stagedKey, ...fields } = parsed.data;

  // An uploaded file is promoted out of `_staging/` BEFORE the row is written,
  // so a failed copy leaves no document pointing at a file that isn't there.
  // Staged objects are expired by a bucket lifecycle rule, which is why a
  // confirmed upload must not be left in that prefix.
  let stored: { storageKey: string; contentType: string; sizeBytes: number } | null = null;
  if (stagedKey) {
    if (!isStagedKeyFor(stagedKey, communityId, 'documents')) {
      return err('That upload could not be verified. Please try again.', 400);
    }

    // The presigned URL could not enforce size, so the stored object is the
    // authority -- not what the client claimed when it asked for the URL.
    const head = await headS3Object(stagedKey);
    if (!head || head.size <= 0 || head.size > MAX_DIRECT_UPLOAD_BYTES) {
      await deleteS3Object(stagedKey).catch(() => {});
      return err('That file was missing or too large. Please upload it again.', 400);
    }

    const finalKey = documentKey(communityId, fields.fileName, randomUUID());
    try {
      await copyS3Object(stagedKey, finalKey);
    } catch (error) {
      const { name, message } = error as Error;
      console.error(`[documents] could not promote ${stagedKey}: ${name}: ${message}`);
      return err('Could not store the file. Please try again.', 502);
    }
    await deleteS3Object(stagedKey).catch(() => {});
    stored = { storageKey: finalKey, contentType: head.contentType, sizeBytes: head.size };
  }

  const doc = await prisma.document.create({
    data: {
      ...fields,
      fileUrl: fields.fileUrl ?? null,
      ...(stored ?? {}),
      uploadedById: session.id,
      communityId,
    },
    include: INCLUDE,
  });

  await createAuditLog({ userId: session.id, action: 'document.create', entityType: 'Document', entityId: doc.id });

  return ok(doc, 201);
}
