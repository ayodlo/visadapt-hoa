/**
 * S3 storage preflight check.
 *
 * Exercises the exact operations the app performs — PutObject, a presigned
 * GetObject, DeleteObject — and reports the precise AWS failure for each, so a
 * storage problem can be identified without a deploy cycle or log spelunking.
 *
 * Usage (from nextjs/, values must be exported or prefixed — this does NOT read
 * .env.local automatically, same as every other script here):
 *
 *   set -a; source .env.local; set +a; npx tsx scripts/check-s3.ts
 *
 * Cleans up after itself: the probe object is deleted before exit.
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET } = process.env;

function mask(value: string | undefined): string {
  if (!value) return 'NOT SET';
  if (value.length <= 8) return `set (${value.length} chars)`;
  return `${value.slice(0, 4)}…${value.slice(-4)} (${value.length} chars)`;
}

function describe(error: unknown): string {
  const e = error as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
  const status = e.$metadata?.httpStatusCode ? ` [HTTP ${e.$metadata.httpStatusCode}]` : '';
  return `${e.name ?? 'Error'}${status}: ${e.message ?? String(error)}`;
}

async function main() {
  console.log('--- configuration ---');
  console.log('AWS_ACCESS_KEY_ID    :', mask(AWS_ACCESS_KEY_ID));
  console.log('AWS_SECRET_ACCESS_KEY:', AWS_SECRET_ACCESS_KEY ? `set (${AWS_SECRET_ACCESS_KEY.length} chars)` : 'NOT SET');
  console.log('AWS_REGION           :', AWS_REGION ?? 'NOT SET (defaults to us-east-1)');
  console.log('AWS_S3_BUCKET        :', AWS_S3_BUCKET ?? 'NOT SET');

  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_S3_BUCKET) {
    console.log('\nFAIL: required variables are missing. Nothing else can be checked.');
    process.exitCode = 1;
    return;
  }

  const Bucket = AWS_S3_BUCKET;
  const s3 = new S3Client({
    region: AWS_REGION ?? 'us-east-1',
    credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
  });
  const Key = `preflight/check-${Date.now()}.txt`;
  let uploaded = false;

  console.log('\n--- checks ---');

  try {
    await s3.send(new HeadBucketCommand({ Bucket }));
    console.log('PASS  bucket reachable');
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 403) {
      // HeadBucket needs s3:ListBucket on the bucket itself, which the app never
      // uses. A 403 here says nothing about whether uploads work — keep going.
      console.log('WARN  HeadBucket denied (needs s3:ListBucket) — not required by the app, continuing');
    } else {
      console.log('FAIL  bucket unreachable —', describe(error));
      console.log('      NoSuchBucket / 404 → the bucket does not exist in this account');
      console.log('      PermanentRedirect  → AWS_REGION does not match the bucket region');
      console.log('      InvalidAccessKeyId / SignatureDoesNotMatch → wrong key or secret');
      console.log('      Also check the bucket is General purpose, not a Directory bucket.');
      process.exitCode = 1;
      return;
    }
  }

  try {
    await s3.send(new PutObjectCommand({ Bucket, Key, Body: 'preflight', ContentType: 'text/plain' }));
    uploaded = true;
    console.log('PASS  s3:PutObject   (uploads will work)');
  } catch (error) {
    console.log('FAIL  s3:PutObject   —', describe(error));
    console.log('      AccessDenied → the IAM user has no s3:PutObject on arn:aws:s3:::' + Bucket + '/*');
    process.exitCode = 1;
  }

  if (uploaded) {
    try {
      const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket, Key }), { expiresIn: 60 });
      const res = await fetch(url);
      if (res.ok) console.log('PASS  presigned read (images will display)');
      else console.log(`FAIL  presigned read — HTTP ${res.status}; IAM likely lacks s3:GetObject`);
    } catch (error) {
      console.log('FAIL  presigned read —', describe(error));
    }

    try {
      await s3.send(new DeleteObjectCommand({ Bucket, Key }));
      console.log('PASS  s3:DeleteObject (replacing/removing images will work)');
    } catch (error) {
      console.log('FAIL  s3:DeleteObject —', describe(error));
      console.log('      Probe object left behind:', Key);
    }
  }

  console.log('\nDone.');
}

main();
