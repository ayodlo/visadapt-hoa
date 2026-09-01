/**
 * Shared upload validation. Pure and dependency-free, so both the API route and
 * the browser form can enforce the same rules and a user never gets as far as a
 * request that the server was always going to reject.
 */

export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

/** Accept attribute for a file input, derived from the same list. */
export const IMAGE_ACCEPT = IMAGE_MIME_TYPES.join(',');

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface UploadCandidate {
  type: string;
  size: number;
  name?: string;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Returns an error message, or null when the file is acceptable.
 * Message strings are user-facing on both sides.
 */
export function validateImage(file: UploadCandidate): string | null {
  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Choose a JPEG, PNG, WebP, or GIF image.';
  }
  if (file.size <= 0) return 'That file is empty.';
  if (file.size > MAX_IMAGE_BYTES) {
    return `Image must be ${formatBytes(MAX_IMAGE_BYTES)} or smaller (that one is ${formatBytes(file.size)}).`;
  }
  return null;
}

/** Filename extension for a validated image MIME type. */
export function extensionFor(mimeType: string): string {
  return mimeType === 'image/jpeg' ? 'jpg' : mimeType.replace('image/', '');
}

/**
 * Storage key for an event's image. Namespaced by community so a bucket policy
 * or lifecycle rule can target a tenant, and suffixed so a replacement upload
 * never collides with the object it replaces.
 */
export function eventImageKey(communityId: string, eventId: string, mimeType: string, unique: string): string {
  return `communities/${communityId}/events/${eventId}/${unique}.${extensionFor(mimeType)}`;
}
