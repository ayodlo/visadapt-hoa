import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The demo community is open to anyone, so it must not be a way to put
 * arbitrary files in the bucket. The presign route is the gate for every
 * direct upload (documents, maintenance); the multipart routes check too.
 */

const h = vi.hoisted(() => ({
  demo: true,
  getPresignedUploadUrl: vi.fn(async () => 'https://bucket.example/signed'),
}));

vi.mock('@/lib/auth', () => ({ getSession: vi.fn(async () => ({ id: 'u1', role: 'ADMIN', communityId: null })) }));
vi.mock('@/lib/community', () => ({
  getActiveCommunityId: vi.fn(async () => 'c1'),
  isDemoCommunity: vi.fn(async () => h.demo),
}));
vi.mock('@/lib/s3', () => ({ getPresignedUploadUrl: h.getPresignedUploadUrl }));

import { POST as presign } from '@/app/api/uploads/presign/route';

const request = () =>
  new NextRequest('http://localhost/api/uploads/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: 'rules.pdf', contentType: 'application/pdf', size: 1000, scope: 'documents' }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('AWS_S3_BUCKET', 'test-bucket');
});

describe('uploads in the demo community', () => {
  it('refuses to sign an upload', async () => {
    h.demo = true;
    const res = await presign(request());
    expect(res.status).toBe(403);
    expect(h.getPresignedUploadUrl).not.toHaveBeenCalled();
  });

  it('still signs uploads for a normal community', async () => {
    h.demo = false;
    const res = await presign(request());
    expect(res.status).toBe(200);
    expect(h.getPresignedUploadUrl).toHaveBeenCalledOnce();
  });
});

describe('demo documents', () => {
  it('every document the demo seeds points at a file in public/demo-documents', () => {
    const seed = readFileSync(path.join(process.cwd(), 'lib/demo-seed.ts'), 'utf8');
    const files = [...seed.matchAll(/fileName: '([^']+\.pdf)'/g)].map((m) => m[1]);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(existsSync(path.join(process.cwd(), 'public/demo-documents', f)), f).toBe(true);
    }
  });
});
