import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CommunityDocument, DocumentCategory } from '../types';
import { Pagination } from '../components/Pagination';

const API_BASE = import.meta.env.VITE_API_URL ?? '';
const TOKEN_KEY = 'chq_token';

interface DocumentsResponse {
  documents: CommunityDocument[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  GENERAL: 'General',
  MEETING_MINUTES: 'Meeting Minutes',
  RULES_AND_BYLAWS: 'Rules & Bylaws',
  FINANCIALS: 'Financials',
  FORMS: 'Forms',
};

const CATEGORY_BADGE: Record<DocumentCategory, string> = {
  GENERAL: 'bg-gray-100 text-gray-600',
  MEETING_MINUTES: 'bg-blue-100 text-blue-700',
  RULES_AND_BYLAWS: 'bg-purple-100 text-purple-700',
  FINANCIALS: 'bg-green-100 text-green-700',
  FORMS: 'bg-orange-100 text-orange-700',
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType: string) {
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.startsWith('image/')) return '🖼';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('word')) return '📝';
  return '📎';
}

function UploadForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('GENERAL');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError('Choose a file'); return; }
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', name || file.name);
      fd.append('category', category);
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${API_BASE}/api/documents`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Upload failed');
      }
      await queryClient.invalidateQueries({ queryKey: ['documents'] });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
      <h2 className="font-semibold text-gray-900">Upload Document</h2>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            if (f && !name) setName(f.name.replace(/\.[^.]+$/, ''));
          }}
        />
        {file
          ? <p className="text-sm font-medium text-gray-900">{file.name} <span className="text-gray-400">({formatBytes(file.size)})</span></p>
          : <p className="text-sm text-gray-400">Click to choose a file — PDF, Word, Excel, image, or text (max 10 MB)</p>
        }
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Display name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. HOA Rules 2026"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DocumentCategory)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {(Object.keys(CATEGORY_LABELS) as DocumentCategory[]).map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
          Cancel
        </button>
        <button
          type="submit"
          disabled={uploading}
          className="bg-brand-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </form>
  );
}

function downloadFile(doc: CommunityDocument) {
  const token = localStorage.getItem(TOKEN_KEY);
  fetch(`${API_BASE}/api/documents/${doc.id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then((res) => res.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: doc.name });
      a.click();
      URL.revokeObjectURL(url);
    });
}

export function DocumentsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'BOARD_MEMBER';
  const [showUpload, setShowUpload] = useState(false);
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['documents', page, categoryFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (categoryFilter) params.set('category', categoryFilter);
      return apiClient.get<DocumentsResponse>(`/api/documents?${params}`);
    },
    placeholderData: keepPreviousData,
  });

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/documents/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });

  const grouped = data?.documents.reduce<Partial<Record<DocumentCategory, CommunityDocument[]>>>((acc, doc) => {
    (acc[doc.category] ??= []).push(doc);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <div className="flex items-center gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All categories</option>
            {(Object.keys(CATEGORY_LABELS) as DocumentCategory[]).map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
          {canManage && !showUpload && (
            <button
              onClick={() => setShowUpload(true)}
              className="bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors"
            >
              + Upload
            </button>
          )}
        </div>
      </div>

      {showUpload && <UploadForm onDone={() => setShowUpload(false)} />}

      {isLoading && <p className="text-sm text-gray-400 text-center py-12">Loading documents…</p>}
      {isError && <p className="text-sm text-red-500 text-center py-12">Failed to load documents.</p>}

      {data?.documents.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-12">
          No documents yet.{canManage && ' Upload the first one!'}
        </p>
      )}

      {grouped && (Object.keys(CATEGORY_LABELS) as DocumentCategory[])
        .filter((cat) => grouped[cat]?.length)
        .map((cat) => (
          <section key={cat} className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {CATEGORY_LABELS[cat]}
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
              {grouped[cat]!.map((doc) => (
                <div key={doc.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <span className="text-xl shrink-0">{fileIcon(doc.mimeType)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatBytes(doc.sizeBytes)} · {doc.uploadedBy.name} · {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${CATEGORY_BADGE[doc.category]}`}>
                    {CATEGORY_LABELS[doc.category]}
                  </span>
                  <button
                    onClick={() => downloadFile(doc)}
                    className="text-sm text-brand-600 hover:text-brand-700 font-medium shrink-0"
                  >
                    Download
                  </button>
                  {canManage && (
                    <button
                      onClick={() => remove(doc.id)}
                      className="text-sm text-gray-400 hover:text-red-500 transition-colors shrink-0"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

      {data?.pagination && (
        <Pagination pagination={data.pagination} onChange={setPage} />
      )}
    </div>
  );
}
