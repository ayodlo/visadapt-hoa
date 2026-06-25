'use client';

import { useEffect, useRef, useState } from 'react';

type DocCategory = 'GENERAL' | 'MEETING_MINUTES' | 'RULES_AND_BYLAWS' | 'FINANCIALS' | 'FORMS';
interface Uploader { id: string; firstName: string; lastName: string; }
interface Doc { id: string; name: string; filename: string; mimeType: string; sizeBytes: number; category: DocCategory; uploadedBy: Uploader; createdAt: string; }

const CATEGORIES: DocCategory[] = ['GENERAL', 'MEETING_MINUTES', 'RULES_AND_BYLAWS', 'FINANCIALS', 'FORMS'];

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'GENERAL' as DocCategory });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch('/api/documents');
    if (res.ok) setDocs(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', form.name || file.name);
    fd.append('category', form.category);

    const res = await fetch('/api/documents', { method: 'POST', body: fd });
    if (res.ok) { setForm({ name: '', category: 'GENERAL' }); setFile(null); setShowForm(false); if (fileRef.current) fileRef.current.value = ''; load(); }
    setUploading(false);
  }

  async function handleDownload(id: string) {
    const res = await fetch(`/api/documents/${id}/download`);
    if (res.ok) {
      const { url } = await res.json();
      window.open(url, '_blank');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this document?')) return;
    await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">+ Upload</button>
      </div>

      {showForm && (
        <form onSubmit={handleUpload} className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-3">
          <input ref={fileRef} required type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:text-sm file:font-medium hover:file:bg-blue-100" />
          <input placeholder="Display name (optional)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as DocCategory }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
          <div className="flex gap-2">
            <button type="submit" disabled={uploading || !file} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">{uploading ? 'Uploading…' : 'Upload'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <p className="text-gray-500 text-sm">Loading…</p> : docs.length === 0 ? <p className="text-gray-500 text-sm">No documents yet.</p> : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Name', 'Category', 'Size', 'Uploaded by', 'Date', ''].map((h) => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docs.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{doc.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{doc.category.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-gray-500">{fmtSize(doc.sizeBytes)}</td>
                  <td className="px-4 py-3 text-gray-600">{doc.uploadedBy.firstName} {doc.uploadedBy.lastName}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(doc.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDownload(doc.id)} className="text-xs text-blue-600 hover:underline mr-3">Download</button>
                    <button onClick={() => handleDelete(doc.id)} className="text-xs text-gray-400 hover:text-red-500">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
