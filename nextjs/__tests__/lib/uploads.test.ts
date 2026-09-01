import { describe, it, expect } from 'vitest';
import {
  IMAGE_ACCEPT,
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
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
    expect(validateImage({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toMatch(/5.0 MB or smaller/);
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
