'use client';

import { useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { redirect } from 'next/navigation';
import { useSession } from '@/context/session';
import { useToast } from '@/context/toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import DocumentList, { Doc } from '@/components/documents/DocumentList';
import { DOCUMENT_CATEGORIES } from '@/lib/documents';
import { ATTACHMENT_ACCEPT, MAX_DIRECT_UPLOAD_BYTES, formatBytes, validateDirectUpload } from '@/lib/uploads';

interface FormValues {
  title: string;
  description: string;
  category: string;
  /** Set when linking to a file hosted elsewhere. */
  fileUrl: string;
  /** Set when a file was uploaded to our bucket; mutually exclusive with fileUrl. */
  stagedKey: string;
  fileName: string;
}

const EMPTY: FormValues = {
  title: '', description: '', category: 'OTHER', fileUrl: '', stagedKey: '', fileName: '',
};

type UploadState = 'idle' | 'uploading' | 'done';

function DocumentForm({
  initial,
  isEdit,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormValues;
  isEdit: boolean;
  onSave: (v: FormValues) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [v, setV] = useState<FormValues>(initial);
  const [upload, setUpload] = useState<UploadState>('idle');
  const [picked, setPicked] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  /**
   * Upload on pick, not on submit: a storage failure then surfaces next to the
   * file with the form still filled in, rather than losing the whole thing at
   * the end. Same flow as the maintenance attachment step.
   */
  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const invalid = validateDirectUpload({ type: file.type, size: file.size, name: file.name });
    if (invalid) { setFileError(invalid); return; }

    setFileError(null);
    setPicked(file);
    setUpload('uploading');
    try {
      const presignRes = await fetch('/api/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name, contentType: file.type, size: file.size, scope: 'documents',
        }),
      });
      const presign = await presignRes.json().catch(() => null);
      if (!presignRes.ok) {
        setUpload('idle');
        setFileError(presign?.error ?? 'Could not prepare the upload.');
        return;
      }

      const put = await fetch(presign.url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!put.ok) {
        setUpload('idle');
        setFileError(`Upload failed (${put.status}). Please try again.`);
        return;
      }

      // The filename shown to residents defaults to the real one, and the title
      // is a reasonable guess when it is still blank.
      setV((prev) => ({
        ...prev,
        stagedKey: presign.key,
        fileName: file.name,
        fileUrl: '',
        title: prev.title || file.name.replace(/\.[^.]+$/, ''),
      }));
      setUpload('done');
    } catch {
      setUpload('idle');
      setFileError('Upload failed. Check your connection and try again.');
    }
  }

  function clearFile() {
    setPicked(null);
    setUpload('idle');
    setFileError(null);
    setV((prev) => ({ ...prev, stagedKey: '', fileName: '' }));
  }

  const canSubmit = isEdit || Boolean(v.stagedKey) || Boolean(v.fileUrl.trim() && v.fileName.trim());
  const set = (k: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center pt-16 px-4 bg-black/30">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-lg p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5">
          {initial.title ? 'Edit document' : 'New document'}
        </h2>
        <form
          onSubmit={(e) => { e.preventDefault(); onSave(v); }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="doc-title">Title</label>
            <input
              id="doc-title"
              required
              value={v.title}
              onChange={set('title')}
              placeholder="e.g. Board Meeting Minutes — March 2026"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="doc-category">Category</label>
            <select
              id="doc-category"
              value={v.category}
              onChange={set('category')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="doc-description">Description <span className="font-normal text-gray-400">(optional)</span></label>
            <textarea
              id="doc-description"
              value={v.description}
              onChange={set('description')}
              rows={3}
              placeholder="Briefly describe the document's purpose…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          {isEdit ? (
            /* PATCH does not accept a new upload, so the file is shown read-only
               rather than offering a control that would silently do nothing. */
            <div>
              <span className="block text-xs font-medium text-gray-700 mb-1">File</span>
              <p className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
                <span className="truncate font-mono text-xs text-gray-900">{v.fileName}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                To replace the file, delete this document and add it again.
              </p>
            </div>
          ) : (
            <div>
              <span className="block text-xs font-medium text-gray-700 mb-1">File</span>

              {upload === 'done' ? (
                <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-gray-900 truncate">{v.fileName}</span>
                    {picked && <span className="block text-xs text-gray-500">{formatBytes(picked.size)}</span>}
                  </span>
                  <button
                    type="button"
                    onClick={clearFile}
                    aria-label={`Remove ${v.fileName}`}
                    className="p-1 text-gray-400 hover:text-red-600 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="doc-file"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 cursor-pointer transition-colors hover:bg-gray-50 hover:border-gray-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500"
                >
                  <Upload className="w-4 h-4 text-gray-500" aria-hidden="true" />
                  {upload === 'uploading' ? 'Uploading…' : 'Choose file'}
                  <input
                    id="doc-file"
                    type="file"
                    accept={ATTACHMENT_ACCEPT}
                    onChange={pickFile}
                    aria-describedby="doc-file-help"
                    className="sr-only"
                  />
                </label>
              )}

              <p id="doc-file-help" className="text-xs text-gray-500 mt-1">
                PDF, Word, text or image, up to {formatBytes(MAX_DIRECT_UPLOAD_BYTES)}. Uploads as soon as you choose it.
              </p>
              {fileError && <p role="alert" className="text-xs text-red-600 mt-1">{fileError}</p>}

              <details className="mt-3">
                <summary className="text-xs text-blue-600 cursor-pointer hover:underline">
                  or link to a file hosted elsewhere
                </summary>
                <div className="space-y-3 mt-2 pl-3 border-l-2 border-gray-100">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="doc-fileurl">File URL</label>
                    <input
                      id="doc-fileurl"
                      value={v.fileUrl}
                      onChange={set('fileUrl')}
                      disabled={upload === 'done'}
                      placeholder="https://cdn.example.com/docs/file.pdf"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="doc-filename">File name <span className="font-normal text-gray-400">(displayed to users)</span></label>
                    <input
                      id="doc-filename"
                      value={v.fileName}
                      onChange={set('fileName')}
                      disabled={upload === 'done'}
                      placeholder="e.g. Board-Minutes-March-2026.pdf"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </div>
                </div>
              </details>
            </div>
          )}
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400">
              Cancel
            </button>
            <button type="submit" disabled={saving || upload === 'uploading' || !canSubmit} className="px-4 py-2 text-sm rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
              {saving ? 'Saving…' : upload === 'uploading' ? 'Waiting for upload…' : 'Save document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminDocumentsPage() {
  const { role } = useSession();
  const { toast } = useToast();

  if (role === 'RESIDENT') { redirect('/resident/documents'); }

  const [formOpen, setFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Doc | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<Doc | null>(null);
  const [saving, setSaving] = useState(false);
  const [listKey, setListKey] = useState(0);

  function refresh() { setListKey((k) => k + 1); }

  async function handleSave(v: FormValues) {
    setSaving(true);
    try {
      const method = editingDoc ? 'PATCH' : 'POST';
      const url = editingDoc ? `/api/documents/${editingDoc.id}` : '/api/documents';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        // The API rejects a payload carrying both, so send only the half in use.
        body: JSON.stringify({
          title: v.title,
          category: v.category,
          description: v.description || undefined,
          fileName: v.fileName,
          ...(v.stagedKey ? { stagedKey: v.stagedKey } : { fileUrl: v.fileUrl }),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast(data.error ?? 'Failed to save document', 'error');
        return;
      }
      toast(editingDoc ? 'Document updated' : 'Document created', 'success');
      setFormOpen(false);
      setEditingDoc(null);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingDoc) return;
    const res = await fetch(`/api/documents/${deletingDoc.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast('Document deleted', 'success');
      refresh();
    } else {
      toast('Failed to delete document', 'error');
    }
    setDeletingDoc(null);
  }

  function openEdit(doc: Doc) {
    setEditingDoc(doc);
    setFormOpen(true);
  }

  function openCreate() {
    setEditingDoc(null);
    setFormOpen(true);
  }

  const headerAction = (
    <button
      onClick={openCreate}
      className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      + New Document
    </button>
  );

  const extraActions = (doc: Doc) => (
    <>
      <button
        onClick={() => openEdit(doc)}
        className="text-xs text-gray-500 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
      >
        Edit
      </button>
      <button
        onClick={() => setDeletingDoc(doc)}
        className="text-xs text-gray-400 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-1"
      >
        Delete
      </button>
    </>
  );

  return (
    <>
      <DocumentList
        key={listKey}
        detailBase="/resident/documents"
        headerAction={headerAction}
        extraActions={extraActions}
        showSort
      />

      {formOpen && (
        <DocumentForm
          initial={
            editingDoc
              ? {
                  title: editingDoc.title,
                  description: editingDoc.description ?? '',
                  category: editingDoc.category,
                  fileUrl: editingDoc.fileUrl ?? '',
                  stagedKey: '',
                  fileName: editingDoc.fileName,
                }
              : EMPTY
          }
          isEdit={Boolean(editingDoc)}
          onSave={handleSave}
          onCancel={() => { setFormOpen(false); setEditingDoc(null); }}
          saving={saving}
        />
      )}

      <ConfirmDialog
        open={!!deletingDoc}
        title="Delete document"
        description={`"${deletingDoc?.title}" will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeletingDoc(null)}
      />
    </>
  );
}
