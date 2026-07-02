import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, unauthorized, forbidden } from '@/lib/api';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const { searchParams } = req.nextUrl;
  const search = searchParams.get('search')?.trim() ?? '';
  const status = searchParams.get('status') ?? '';
  const category = searchParams.get('category') ?? '';
  const priority = searchParams.get('priority') ?? '';
  const assignedTo = searchParams.get('assignedTo') ?? '';
  const vendor = searchParams.get('vendor') ?? '';
  const sortBy = searchParams.get('sortBy') ?? 'createdAt';
  const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = 20;

  type IssueOrderBy =
    | { createdAt: 'asc' | 'desc' }
    | { updatedAt: 'asc' | 'desc' }
    | { priority: 'asc' | 'desc' }
    | { status: 'asc' | 'desc' };

  const orderBy: IssueOrderBy =
    sortBy === 'updatedAt' ? { updatedAt: sortDir } :
    sortBy === 'priority' ? { priority: sortDir } :
    sortBy === 'status' ? { status: sortDir } :
    { createdAt: sortDir };

  const where = {
    ...(search ? {
      OR: [
        { title: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
        { location: { contains: search, mode: 'insensitive' as const } },
        { resident: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }},
      ],
    } : {}),
    ...(status ? { status: status as never } : {}),
    ...(category ? { category: category as never } : {}),
    ...(priority ? { priority: priority as never } : {}),
    ...(assignedTo === 'unassigned' ? { assignedToId: null } : assignedTo ? { assignedToId: assignedTo } : {}),
    ...(vendor === 'unassigned' ? { vendorId: null } : vendor ? { vendorId: vendor } : {}),
  };

  const [issues, total] = await Promise.all([
    prisma.issue.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        resident: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        vendor: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.issue.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);
  return ok({ issues, total, totalPages, page });
}
