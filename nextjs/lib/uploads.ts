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

/** Document types accepted as violation evidence alongside images. */
export const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const;

export const ATTACHMENT_MIME_TYPES = [...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES] as const;

/** Accept attributes for file inputs, derived from the same lists. */
export const IMAGE_ACCEPT = IMAGE_MIME_TYPES.join(',');
export const ATTACHMENT_ACCEPT = ATTACHMENT_MIME_TYPES.join(',');

/**
 * Upload ceiling.
 *
 * 4 MB, not 5: Vercel caps serverless request bodies at roughly 4.5 MB, and a
 * file over that limit is rejected by the platform before the route runs — the
 * caller sees an opaque failure instead of a useful message. Staying under it
 * means every rejection comes from our own validation, with a clear reason.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** @deprecated Use MAX_UPLOAD_BYTES — kept so existing imports keep working. */
export const MAX_IMAGE_BYTES = MAX_UPLOAD_BYTES;

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
  return validateSize(file, 'Image');
}

/** Images plus documents — used for violation evidence. */
export function validateAttachment(file: UploadCandidate): string | null {
  if (!(ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Choose an image (JPEG, PNG, WebP, GIF) or a document (PDF, Word, or text file).';
  }
  return validateSize(file, 'File');
}

function validateSize(file: UploadCandidate, noun: string): string | null {
  if (file.size <= 0) return 'That file is empty.';
  if (file.size > MAX_UPLOAD_BYTES) {
    return `${noun} must be ${formatBytes(MAX_UPLOAD_BYTES)} or smaller (that one is ${formatBytes(file.size)}).`;
  }
  return null;
}

/** True when an attachment can be shown inline rather than downloaded. */
export function isImageType(mimeType: string): boolean {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
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

/**
 * Storage key for a violation attachment. Shares the events bucket — a bucket
 * holds arbitrary objects, and the `communities/<id>/…` prefix already separates
 * tenants, so no second bucket or IAM change is needed.
 */
export function violationAttachmentKey(
  communityId: string,
  violationId: string,
  fileName: string,
  unique: string
): string {
  return `communities/${communityId}/violations/${violationId}/${unique}-${sanitizeFileName(fileName)}`;
}

/**
 * Make a user-supplied filename safe as an S3 key segment: strip path
 * separators and anything outside a conservative set, so an upload named
 * "../../secret .pdf" cannot escape its prefix.
 */
export function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? 'file';
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 100);
  return cleaned || 'file';
}

/**
 * Ceiling for browser-direct (presigned) uploads.
 *
 * Larger than MAX_UPLOAD_BYTES because these bytes bypass the application
 * server entirely, so the platform's request-body limit does not apply. Server
 * paths that still receive the file keep the smaller limit.
 */
export const MAX_DIRECT_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Upload scopes permitted to request a presigned URL. */
export const UPLOAD_SCOPES = ['maintenance'] as const;
export type UploadScope = (typeof UPLOAD_SCOPES)[number];

export function isUploadScope(value: string): value is UploadScope {
  return (UPLOAD_SCOPES as readonly string[]).includes(value);
}

/** Same allow-list as attachments, measured against the direct-upload ceiling. */
export function validateDirectUpload(file: UploadCandidate): string | null {
  if (!(ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Choose an image (JPEG, PNG, WebP, GIF) or a document (PDF, Word, or text file).';
  }
  if (file.size <= 0) return 'That file is empty.';
  if (file.size > MAX_DIRECT_UPLOAD_BYTES) {
    return `File must be ${formatBytes(MAX_DIRECT_UPLOAD_BYTES)} or smaller (that one is ${formatBytes(file.size)}).`;
  }
  return null;
}

/**
 * Where a browser-uploaded file lands before the record it belongs to exists.
 *
 * `_staging/` leads the key rather than sitting under the community. An S3
 * lifecycle filter matches a literal prefix with no wildcard, so a per-community
 * staging prefix could not be expired by one rule; leading with `_staging/` lets
 * a single rule expire abandoned uploads for every tenant without touching
 * confirmed attachments — which is why a confirmed upload is copied out of this
 * prefix, never left here. The tenant segment still follows, so per-community
 * bucket policies are unaffected.
 */
export function stagedUploadKey(
  communityId: string,
  scope: UploadScope,
  fileName: string,
  unique: string
): string {
  return `_staging/communities/${communityId}/${scope}/${unique}-${sanitizeFileName(fileName)}`;
}

/**
 * Guard for a client-supplied staged key.
 *
 * The client returns keys the server issued, so they must match the prefix this
 * community and scope would have produced — otherwise a caller could name any
 * object in the bucket and have it attached to their own record.
 */
export function isStagedKeyFor(key: string, communityId: string, scope: UploadScope): boolean {
  const prefix = `_staging/communities/${communityId}/${scope}/`;
  return (
    key.startsWith(prefix) &&
    !key.slice(prefix.length).includes('/') &&
    !key.includes('..')
  );
}

/** Permanent home for a maintenance attachment once its request exists. */
export function maintenanceAttachmentKey(
  communityId: string,
  requestId: string,
  fileName: string,
  unique: string
): string {
  return `communities/${communityId}/maintenance/${requestId}/${unique}-${sanitizeFileName(fileName)}`;
}
