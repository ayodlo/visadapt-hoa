import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ok, unauthorized, forbidden } from '@/lib/api';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'ADMIN') return forbidden();

  const { searchParams } = req.nextUrl;
  const search = searchParams.get('search')?.trim() ?? '';
  const status = searchParams.get('status') ?? '';
  const type = searchParams.get('type') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = 20;

  const where = {
    ...(search ? {
      OR: [
        { description: { contains: search, mode: 'insensitive' as const } },
        { resident: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }},
      ],
    } : {}),
    ...(status ? { status: status as never } : {}),
    ...(type ? { requestType: type as never } : {}),
  };

  const [requests, total] = await Promise.all([
    prisma.architecturalRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        resident: { select: { id: true, firstName: true, lastName: true } },
        property: { select: { streetAddress: true, unitNumber: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.architecturalRequest.count({ where }),
  ]);

  return ok({ requests, total, totalPages: Math.ceil(total / limit), page });
}
