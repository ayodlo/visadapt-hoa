'use client';

import { useState } from 'react';
import { redirect } from 'next/navigation';
import { useSession } from '@/context/session';
import { useToast } from '@/context/toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import DocumentList, { Doc } from '@/components/documents/DocumentList';
import { DOCUMENT_CATEGORIES } from '@/lib/documents';

interface FormValues {
  title: string;
  description: string;
  category: string;
  fileUrl: string;
  fileName: string;
}

const EMPTY: FormValues = { title: '', description: '', category: 'OTHER', fileUrl: '', fileName: '' };

function DocumentForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormValues;
  onSave: (v: FormValues) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [v, setV] = useState<FormValues>(initial);
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
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="doc-fileurl">File URL</label>
            <input
              id="doc-fileurl"
              required
              value={v.fileUrl}
              onChange={set('fileUrl')}
              placeholder="https://cdn.example.com/docs/file.pdf"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="doc-filename">File name <span className="font-normal text-gray-400">(displayed to users)</span></label>
            <input
              id="doc-filename"
              required
              value={v.fileName}
              onChange={set('fileName')}
              placeholder="e.g. Board-Minutes-March-2026.pdf"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
              {saving ? 'Saving…' : 'Save document'}
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
        body: JSON.stringify({ ...v, description: v.description || undefined }),
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
      />

      {formOpen && (
        <DocumentForm
          initial={
            editingDoc
              ? {
                  title: editingDoc.title,
                  description: editingDoc.description ?? '',
                  category: editingDoc.category,
                  fileUrl: editingDoc.fileUrl,
                  fileName: editingDoc.fileName,
                }
              : EMPTY
          }
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
