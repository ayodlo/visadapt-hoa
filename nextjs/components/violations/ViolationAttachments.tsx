'use client';

import { useCallback, useEffect, useState } from 'react';
import { Paperclip, Trash2, Upload } from 'lucide-react';
import { ATTACHMENT_ACCEPT, MAX_UPLOAD_BYTES, formatBytes, validateAttachment } from '@/lib/uploads';

export interface Attachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  isImage: boolean;
  uploadedBy: string;
  /** Short-lived presigned URL; null if signing failed. */
  url: string | null;
}

interface Props {
  violationId: string;
  /** Only admins may add or remove evidence; board members read only. */
  canEdit: boolean;
}

export function ViolationAttachments({ violationId, canEdit }: Props) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/violations/${violationId}/attachments`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.attachments ?? []);
      setError('');
    } catch {
      setError('Could not load attachments.');
    } finally {
      setLoading(false);
    }
  }, [violationId]);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be re-picked after a failure
    if (!file) return;

    // Same rules the route enforces, so an oversized file never leaves the browser.
    const invalid = validateAttachment({ type: file.type, size: file.size, name: file.name });
    if (invalid) { setError(invalid); return; }

    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`/api/admin/violations/${violationId}/attachments`, { method: 'POST', body });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? 'Upload failed. Please try again.');
        return;
      }
      await load();
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string, fileName: string) {
    if (!confirm(`Remove "${fileName}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/violations/${violationId}/attachments/${id}`, { method: 'DELETE' });
      if (!res.ok) { setError('Could not remove the file.'); return; }
      setItems((prev) => prev.filter((a) => a.id !== id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="violation-evidence-heading" className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 id="violation-evidence-heading" className="text-sm font-semibold text-gray-900">Evidence</h3>
        {canEdit && (
          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 rounded px-1">
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            {busy ? 'Uploading…' : 'Add file'}
            <input
              type="file"
              accept={ATTACHMENT_ACCEPT}
              onChange={handleUpload}
              disabled={busy}
              className="sr-only"
            />
          </label>
        )}
      </div>

      {error && <p role="alert" className="text-xs text-red-600 mb-2">{error}</p>}

      {loading ? (
        <p className="text-xs text-gray-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-gray-500">
          No evidence attached yet.
          {canEdit && ` Images and documents up to ${formatBytes(MAX_UPLOAD_BYTES)}.`}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 border border-gray-200 rounded-lg p-2">
              {a.isImage && a.url ? (
                // Presigned, short-lived, private-bucket URL — next/image would
                // add nothing and would need per-deployment remotePatterns.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt="" className="w-14 h-14 object-cover rounded-md border border-gray-200 flex-shrink-0" />
              ) : (
                <span className="w-14 h-14 rounded-md bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <Paperclip className="w-4 h-4 text-gray-400" aria-hidden="true" />
                </span>
              )}

              <div className="min-w-0 flex-1">
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-blue-600 hover:underline break-all focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                  >
                    {a.fileName}
                  </a>
                ) : (
                  <span className="text-xs font-medium text-gray-500 break-all">{a.fileName} (unavailable)</span>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatBytes(a.sizeBytes)} · {a.uploadedBy} · {new Date(a.createdAt).toLocaleDateString()}
                </p>
              </div>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(a.id, a.fileName)}
                  disabled={busy}
                  aria-label={`Remove ${a.fileName}`}
                  className="text-gray-400 hover:text-red-600 p-1 rounded focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
