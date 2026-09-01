import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
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
