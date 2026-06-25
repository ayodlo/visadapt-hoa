import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { uploadToS3, BUCKET } from '@/lib/s3';
import { ok, err, unauthorized, forbidden } from '@/lib/api';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const documents = await prisma.document.findMany({
    orderBy: { createdAt: 'desc' },
    include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
  });
  return ok(documents);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const formData = await req.formData().catch(() => null);
  if (!formData) return err('Invalid form data', 400);

  const file = formData.get('file') as File | null;
  const name = formData.get('name') as string | null;
  const category = (formData.get('category') as string | null) ?? 'GENERAL';

  if (!file || !name) return err('file and name are required', 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split('.').pop() ?? 'bin';
  const key = `documents/${crypto.randomUUID()}.${ext}`;

  await uploadToS3(key, buffer, file.type);

  const doc = await prisma.document.create({
    data: {
      name,
      filename: key,
      mimeType: file.type,
      sizeBytes: buffer.byteLength,
      category: category as never,
      uploadedById: session.id,
    },
    include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
  });

  if (!BUCKET) return err('S3 not configured', 500);
  return ok(doc, 201);
}
