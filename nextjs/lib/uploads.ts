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
