import {
  S3Client,
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const BUCKET = process.env.AWS_S3_BUCKET!;

export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType })
  );
}

/**
 * Presigned URL for displaying an object inline (e.g. an <img> src).
 *
 * Separate from `getPresignedDownloadUrl`, which forces a download by setting
 * Content-Disposition: attachment — that would make an <img> tag fail.
 */
export async function getPresignedViewUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}

export async function getPresignedDownloadUrl(key: string, filename: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

export async function deleteS3Object(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/**
 * Presigned URL letting the browser PUT one object directly to S3.
 *
 * The bytes never pass through the application server, which is what removes
 * the platform request-body limit. The signature is bound to a single key and
 * content type, and expires quickly — it is a narrow, short-lived capability,
 * not general write access.
 *
 * The declared size cannot be enforced by the signature itself; the caller is
 * expected to verify the stored object with `headS3Object` before trusting it.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 300
): Promise<string> {
  return getSignedUrl(s3, new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }), {
    expiresIn,
  });
}

/** Actual stored size and type — the authority once an upload claims to be done. */
export async function headS3Object(key: string): Promise<{ size: number; contentType: string } | null> {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return { size: head.ContentLength ?? 0, contentType: head.ContentType ?? '' };
  } catch {
    return null;
  }
}

/** Promote a staged upload to its permanent key once the record it belongs to exists. */
export async function copyS3Object(fromKey: string, toKey: string): Promise<void> {
  await s3.send(
    new CopyObjectCommand({ Bucket: BUCKET, CopySource: `${BUCKET}/${fromKey}`, Key: toKey })
  );
}
