'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { CATEGORY_FILTER_OPTIONS } from '@/lib/documents';
import { formatBytes } from '@/lib/uploads';

interface Uploader { id: string; firstName: string; lastName: string; }
export interface Doc {
  id: string;
  title: string;
  description: string | null;
  category: string;
  fileUrl: string | null;
  storageKey?: string | null;
  sizeBytes?: number | null;
  fileName: string;
  uploadedBy: Uploader;
  createdAt: string;
}

interface ApiResponse {
  documents: Doc[];
  total: number;
  page: number;
  totalPages: number;
}

/** Server-side sort options — keys must match the API's whitelist. */
const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Upload date' },
  { value: 'title', label: 'Title' },
  { value: 'category', label: 'Category' },
  { value: 'fileName', label: 'File name' },
];

interface Props {
  detailBase: string;
  headerAction?: React.ReactNode;
  extraActions?: (doc: Doc) => React.ReactNode;
  /**
   * Opt-in sort controls. Off by default so the resident and board views that
   * share this component are unchanged.
   */
  showSort?: boolean;
}

export default function DocumentList({ detailBase, headerAction, extraActions, showSort = false }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Any change to what's being shown returns to the first page, or the user
  // can land on a page number that no longer exists.
  useEffect(() => { setPage(1); }, [debouncedSearch, category, sort, dir]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12', sort, dir });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (category) params.set('category', category);
      const res = await fetch(`/api/documents?${params}`);
      if (!res.ok) throw new Error();
      const data: ApiResponse = await res.json();
      setDocs(data.documents);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }, [page, debouncedSearch, category, sort, dir]);

  useEffect(() => { load(); }, [load]);

  /**
   * Downloads go through the API rather than linking at a stored URL: an
   * uploaded file lives in a private bucket and its presigned URL is minted per
   * request. Same-tab navigation, not window.open — the signed URL carries
   * Content-Disposition: attachment, so the browser saves the file without
   * leaving the page, and nothing gets caught by a popup blocker.
   */
  async function download(doc: Doc) {
    setDownloading(doc.id);
    try {
      const res = await fetch(`/api/documents/${doc.id}/download`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        setDownloadError(data?.error ?? 'Could not prepare that download.');
        return;
      }
      window.location.assign(data.url);
    } catch {
      setDownloadError('Could not prepare that download. Check your connection.');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="Documents" subtitle={`${total} document${total !== 1 ? 's' : ''} in the library`} action={headerAction} />

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mb-6">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={showSort ? 'Search title, description, file name…' : 'Search by title or description…'}
          className="flex-1 sm:min-w-[16rem]"
        />
        <FilterSelect
          options={CATEGORY_FILTER_OPTIONS as unknown as { label: string; value: string }[]}
          value={category}
          onChange={setCategory}
          id="category-filter"
        />
        {showSort && (
          <div className="flex items-center gap-2">
            <FilterSelect
              label="Sort"
              id="document-sort"
              options={SORT_OPTIONS}
              value={sort}
              onChange={setSort}
            />
            <button
              type="button"
              onClick={() => setDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              aria-label={`Sort ${dir === 'asc' ? 'descending' : 'ascending'}`}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-nowrap"
            >
              {dir === 'asc' ? '↑ Asc' : '↓ Desc'}
            </button>
          </div>
        )}
      </div>

      {status === 'loading' && <LoadingState rows={5} />}
      {status === 'error' && <ErrorState onRetry={load} />}

      {downloadError && (
        <p role="alert" className="text-sm text-red-600 mb-3">{downloadError}</p>
      )}

      {status === 'idle' && docs.length === 0 && (
        <EmptyState
          icon={<FileText className="w-10 h-10 text-gray-400" />}
          title="No documents found"
          description={debouncedSearch || category ? 'Try adjusting your search or filter.' : 'No documents have been uploaded yet.'}
        />
      )}

      {status === 'idle' && docs.length > 0 && (
        <>
          <div className="space-y-3 mb-6">
            {docs.map((doc) => (
              <div key={doc.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all">
                <div className="flex items-start gap-4">
                  <FileText className="w-6 h-6 flex-shrink-0 mt-0.5 text-gray-400" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Link
                        href={`${detailBase}/${doc.id}`}
                        className="text-sm font-semibold text-gray-900 hover:text-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                      >
                        {doc.title}
                      </Link>
                      <StatusBadge status={doc.category} />
                    </div>
                    {doc.description && (
                      <p className="text-xs text-gray-500 line-clamp-2 mb-2">{doc.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                      <span>{doc.fileName}</span>
                      {doc.sizeBytes ? (
                        <>
                          <span>·</span>
                          <span>{formatBytes(doc.sizeBytes)}</span>
                        </>
                      ) : null}
                      <span>·</span>
                      <span>Uploaded {new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => download(doc)}
                      disabled={downloading === doc.id}
                      className="text-xs text-blue-600 hover:underline disabled:opacity-50 disabled:no-underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                    >
                      {downloading === doc.id ? 'Preparing…' : 'Download'}
                    </button>
                    {extraActions?.(doc)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
