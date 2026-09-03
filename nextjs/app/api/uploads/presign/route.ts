import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { ok, err, unauthorized } from '@/lib/api';
import { getPresignedUploadUrl } from '@/lib/s3';
import {
  MAX_DIRECT_UPLOAD_BYTES,
  UPLOAD_SCOPES,
  stagedUploadKey,
  validateDirectUpload,
} from '@/lib/uploads';

const schema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(150),
  size: z.number().int().positive().max(MAX_DIRECT_UPLOAD_BYTES),
  scope: z.enum(UPLOAD_SCOPES),
});

/** Presigned URLs are short-lived: long enough to upload, short enough to matter. */
const EXPIRES_SECONDS = 300;

/**
 * Issue a one-object, short-lived upload URL.
 *
 * Everything that matters is decided here, not by the caller: the community
 * comes from the session, the object key is generated server-side, and the
 * content type is bound into the signature. The declared `size` is advisory —
 * a signature cannot enforce it — so whoever consumes the staged key must
 * verify the stored object before trusting it.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0].message, 400);

  const { fileName, contentType, size, scope } = parsed.data;

  const invalid = validateDirectUpload({ type: contentType, size, name: fileName });
  if (invalid) return err(invalid, 400);

  if (!process.env.AWS_S3_BUCKET) {
    console.error('[presign] AWS_S3_BUCKET is not set — direct uploads unavailable');
    return err('File storage is not configured. Contact your administrator.', 503);
  }

  const key = stagedUploadKey(communityId, scope, fileName, randomUUID());

  try {
    const url = await getPresignedUploadUrl(key, contentType, EXPIRES_SECONDS);
    return ok({ url, key, expiresIn: EXPIRES_SECONDS });
  } catch (error) {
    const { name, message } = error as Error;
    console.error(`[presign] could not sign upload: ${name}: ${message} (key=${key})`);
    return err('Could not prepare the upload. Please try again.', 502);
  }
}
