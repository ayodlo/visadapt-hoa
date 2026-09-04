import { describe, it, expect } from 'vitest';
import {
  ATTACHMENT_MIME_TYPES,
  IMAGE_ACCEPT,
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_UPLOAD_BYTES,
  isImageType,
  sanitizeFileName,
  validateAttachment,
  validateDirectUpload,
  violationAttachmentKey,
  MAX_DIRECT_UPLOAD_BYTES,
  isUploadScope,
  stagedUploadKey,
  isStagedKeyFor,
  maintenanceAttachmentKey,
  documentKey,
  contentDispositionAttachment,
  eventImageKey,
  extensionFor,
  formatBytes,
  validateImage,
} from '@/lib/uploads';

describe('validateImage', () => {
  it('accepts every supported image type', () => {
    for (const type of IMAGE_MIME_TYPES) {
      expect(validateImage({ type, size: 1024 })).toBeNull();
    }
  });

  it('rejects non-images, including plausible near-misses', () => {
    expect(validateImage({ type: 'application/pdf', size: 1024 })).toMatch(/JPEG, PNG, WebP, or GIF/);
    expect(validateImage({ type: 'image/svg+xml', size: 1024 })).not.toBeNull();
    expect(validateImage({ type: '', size: 1024 })).not.toBeNull();
  });

  it('rejects an empty file', () => {
    expect(validateImage({ type: 'image/png', size: 0 })).toMatch(/empty/);
  });

  it('accepts a file exactly at the limit but not one byte over', () => {
    expect(validateImage({ type: 'image/png', size: MAX_IMAGE_BYTES })).toBeNull();
    expect(validateImage({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toMatch(/4.0 MB or smaller/);
  });

  it('reports the offending size in the message', () => {
    const message = validateImage({ type: 'image/png', size: 8 * 1024 * 1024 });
    expect(message).toContain('8.0 MB');
  });
});

describe('formatBytes', () => {
  it('scales units', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('extensionFor', () => {
  it('normalises jpeg to jpg', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg');
  });

  it('derives the extension from the subtype otherwise', () => {
    expect(extensionFor('image/png')).toBe('png');
    expect(extensionFor('image/webp')).toBe('webp');
  });
});

describe('eventImageKey', () => {
  it('namespaces by community and event', () => {
    expect(eventImageKey('c1', 'e1', 'image/png', 'abc')).toBe('communities/c1/events/e1/abc.png');
  });

  it('produces a distinct key per upload so a replacement never collides', () => {
    const a = eventImageKey('c1', 'e1', 'image/png', 'first');
    const b = eventImageKey('c1', 'e1', 'image/png', 'second');
    expect(a).not.toBe(b);
  });

  it('keeps different communities on separate prefixes', () => {
    expect(eventImageKey('c2', 'e1', 'image/jpeg', 'x')).toMatch(/^communities\/c2\//);
  });
});

describe('IMAGE_ACCEPT', () => {
  it('is derived from the same list the validator uses', () => {
    for (const type of IMAGE_MIME_TYPES) expect(IMAGE_ACCEPT).toContain(type);
  });
});

describe('validateAttachment', () => {
  it('accepts images and documents alike', () => {
    for (const type of ATTACHMENT_MIME_TYPES) {
      expect(validateAttachment({ type, size: 1024 })).toBeNull();
    }
    expect(validateAttachment({ type: 'application/pdf', size: 2048 })).toBeNull();
  });

  it('rejects types outside the allowed set', () => {
    expect(validateAttachment({ type: 'application/zip', size: 1024 })).toMatch(/image .* or a document/i);
    expect(validateAttachment({ type: 'image/svg+xml', size: 1024 })).not.toBeNull();
  });

  it('shares the 4 MB ceiling with images', () => {
    expect(validateAttachment({ type: 'application/pdf', size: MAX_UPLOAD_BYTES })).toBeNull();
    expect(validateAttachment({ type: 'application/pdf', size: MAX_UPLOAD_BYTES + 1 })).toMatch(/4.0 MB or smaller/);
  });

  it('rejects empty files', () => {
    expect(validateAttachment({ type: 'application/pdf', size: 0 })).toMatch(/empty/);
  });
});

describe('MAX_UPLOAD_BYTES', () => {
  it('stays under Vercel\'s ~4.5 MB request body cap', () => {
    expect(MAX_UPLOAD_BYTES).toBeLessThan(4.5 * 1024 * 1024);
    expect(MAX_IMAGE_BYTES).toBe(MAX_UPLOAD_BYTES);
  });
});

describe('isImageType', () => {
  it('separates inline-renderable images from documents', () => {
    expect(isImageType('image/png')).toBe(true);
    expect(isImageType('application/pdf')).toBe(false);
  });
});

describe('sanitizeFileName', () => {
  it('strips path separators so a key cannot escape its prefix', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName(String.raw`C:\evil\notes.pdf`)).toBe('notes.pdf');
  });

  it('replaces characters that are unsafe in a key', () => {
    expect(sanitizeFileName('my photo (1).png')).toBe('my_photo__1_.png');
  });

  it('never returns an empty segment', () => {
    expect(sanitizeFileName('...')).toBe('file');
    expect(sanitizeFileName('')).toBe('file');
  });

  it('caps absurdly long names', () => {
    expect(sanitizeFileName('a'.repeat(300)).length).toBeLessThanOrEqual(100);
  });
});

describe('violationAttachmentKey', () => {
  it('namespaces by community and violation, under the shared bucket', () => {
    expect(violationAttachmentKey('c1', 'v1', 'photo.jpg', 'abc')).toBe(
      'communities/c1/violations/v1/abc-photo.jpg'
    );
  });

  it('keeps events and violations on separate prefixes in the same bucket', () => {
    const ev = eventImageKey('c1', 'e1', 'image/png', 'x');
    const vi = violationAttachmentKey('c1', 'v1', 'a.png', 'x');
    expect(ev.startsWith('communities/c1/events/')).toBe(true);
    expect(vi.startsWith('communities/c1/violations/')).toBe(true);
  });

  it('sanitizes the supplied filename', () => {
    expect(violationAttachmentKey('c1', 'v1', '../secret.pdf', 'u')).toBe(
      'communities/c1/violations/v1/u-secret.pdf'
    );
  });
});

describe('direct (presigned) uploads', () => {
  it('allows a larger ceiling than server-relayed uploads', () => {
    expect(MAX_DIRECT_UPLOAD_BYTES).toBeGreaterThan(MAX_UPLOAD_BYTES);
    expect(validateDirectUpload({ type: 'image/png', size: 10 * 1024 * 1024 })).toBeNull();
  });

  it('still refuses disallowed types and oversized or empty files', () => {
    expect(validateDirectUpload({ type: 'application/zip', size: 1024 })).not.toBeNull();
    expect(validateDirectUpload({ type: 'image/png', size: 0 })).toMatch(/empty/);
    expect(validateDirectUpload({ type: 'image/png', size: MAX_DIRECT_UPLOAD_BYTES + 1 })).toMatch(/25.0 MB or smaller/);
  });

  it('only recognises the scopes that may request a URL', () => {
    expect(isUploadScope('maintenance')).toBe(true);
    expect(isUploadScope('documents')).toBe(true);
    expect(isUploadScope('violations')).toBe(false);
    expect(isUploadScope('')).toBe(false);
  });
});

describe('stagedUploadKey / isStagedKeyFor', () => {
  it('round-trips a key it generated', () => {
    const key = stagedUploadKey('c1', 'maintenance', 'photo.jpg', 'u1');
    expect(key).toBe('_staging/communities/c1/maintenance/u1-photo.jpg');
    expect(isStagedKeyFor(key, 'c1', 'maintenance')).toBe(true);
  });

  it('starts with the literal prefix the bucket lifecycle rule filters on', () => {
    // The S3 rule matches the prefix `_staging/` with no wildcard, so this
    // ordering is what makes abandoned uploads expirable. Reordering the
    // segments would silently stop the rule from ever matching.
    expect(stagedUploadKey('c1', 'maintenance', 'photo.jpg', 'u1')).toMatch(/^_staging\//);
  });

  it('rejects a key belonging to another community', () => {
    const key = stagedUploadKey('c2', 'maintenance', 'photo.jpg', 'u1');
    expect(isStagedKeyFor(key, 'c1', 'maintenance')).toBe(false);
  });

  it('rejects keys outside the staging prefix, including real attachments', () => {
    expect(isStagedKeyFor('communities/c1/maintenance/r1/u-photo.jpg', 'c1', 'maintenance')).toBe(false);
    expect(isStagedKeyFor(violationAttachmentKey('c1', 'v1', 'a.png', 'u'), 'c1', 'maintenance')).toBe(false);
    expect(isStagedKeyFor(eventImageKey('c1', 'e1', 'image/png', 'u'), 'c1', 'maintenance')).toBe(false);
  });

  it('rejects traversal and nested paths', () => {
    expect(isStagedKeyFor('_staging/communities/c1/maintenance/../../secret', 'c1', 'maintenance')).toBe(false);
    expect(isStagedKeyFor('_staging/communities/c1/maintenance/sub/dir.png', 'c1', 'maintenance')).toBe(false);
  });

  it('rejects a prefix-lookalike community id', () => {
    // "c1x" must not satisfy a check for community "c1".
    const key = stagedUploadKey('c1x', 'maintenance', 'a.png', 'u');
    expect(isStagedKeyFor(key, 'c1', 'maintenance')).toBe(false);
  });

  it('sanitises the filename in the staged key', () => {
    expect(stagedUploadKey('c1', 'maintenance', '../evil name.png', 'u')).toBe(
      '_staging/communities/c1/maintenance/u-evil_name.png'
    );
  });
});

describe('maintenanceAttachmentKey', () => {
  it('lands outside the staging prefix so lifecycle rules cannot expire it', () => {
    const key = maintenanceAttachmentKey('c1', 'r1', 'photo.jpg', 'u1');
    expect(key).toBe('communities/c1/maintenance/r1/u1-photo.jpg');
    expect(key).not.toContain('_staging');
    expect(isStagedKeyFor(key, 'c1', 'maintenance')).toBe(false);
  });
});

describe('documentKey', () => {
  it('is tenant-prefixed and lands outside the staging prefix', () => {
    const key = documentKey('c1', 'Budget 2026.pdf', 'u1');
    expect(key).toBe('communities/c1/documents/u1-Budget_2026.pdf');
    expect(key).not.toContain('_staging');
    expect(isStagedKeyFor(key, 'c1', 'documents')).toBe(false);
  });

  it('sanitises a filename that tries to escape the prefix', () => {
    expect(documentKey('c1', '../../secret .pdf', 'u')).toBe('communities/c1/documents/u-secret_.pdf');
  });

  it('round-trips a staged documents key through the guard', () => {
    const staged = stagedUploadKey('c1', 'documents', 'Budget 2026.pdf', 'u1');
    expect(staged).toBe('_staging/communities/c1/documents/u1-Budget_2026.pdf');
    expect(isStagedKeyFor(staged, 'c1', 'documents')).toBe(true);
    // A documents key must not satisfy the maintenance scope check.
    expect(isStagedKeyFor(staged, 'c1', 'maintenance')).toBe(false);
  });
});

describe('contentDispositionAttachment', () => {
  it('keeps spaces intact in the quoted filename', () => {
    // The bug this replaced emitted "Budget%202026.pdf", which browsers saved
    // under that literal name.
    const value = contentDispositionAttachment('Budget 2026.pdf');
    expect(value).toBe(
      'attachment; filename="Budget 2026.pdf"; filename*=UTF-8\'\'Budget%202026.pdf'
    );
  });

  it('keeps a non-ASCII name in filename* and degrades the quoted fallback', () => {
    const value = contentDispositionAttachment('r\u00e9sum\u00e9.pdf');
    expect(value).toContain('filename="r_sum_.pdf"');
    expect(value).toContain("filename*=UTF-8''r%C3%A9sum%C3%A9.pdf");
  });

  it('cannot be broken out of the quoted string', () => {
    const quoted = contentDispositionAttachment('ev"il-name.pdf').match(/filename="([^"]*)"/);
    expect(quoted?.[1]).toBe('ev_il-name.pdf');
  });

  it('treats a backslash as a path separator, like the key sanitiser does', () => {
    expect(contentDispositionAttachment('C:\\docs\\budget.pdf')).toContain('filename="budget.pdf"');
  });

  it('strips a path so the browser cannot be steered out of its download folder', () => {
    expect(contentDispositionAttachment('../../etc/passwd')).toContain('filename="passwd"');
  });

  it('falls back to a usable name when nothing survives', () => {
    expect(contentDispositionAttachment('')).toContain('filename="download"');
  });
});
