'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { CATEGORY_FILTER_OPTIONS } from '@/lib/documents';

interface Uploader { id: string; firstName: string; lastName: string; }
export interface Doc {
  id: string;
  title: string;
  description: string | null;
  category: string;
  fileUrl: string;
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

interface Props {
  detailBase: string;
  headerAction?: React.ReactNode;
  extraActions?: (doc: Doc) => React.ReactNode;
}

export default function DocumentList({ detailBase, headerAction, extraActions }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, category]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12' });
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
  }, [page, debouncedSearch, category]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="Documents" subtitle={`${total} document${total !== 1 ? 's' : ''} in the library`} action={headerAction} />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by title or description…"
          className="flex-1"
        />
        <FilterSelect
          options={CATEGORY_FILTER_OPTIONS as unknown as { label: string; value: string }[]}
          value={category}
          onChange={setCategory}
          id="category-filter"
        />
      </div>

      {status === 'loading' && <LoadingState rows={5} />}
      {status === 'error' && <ErrorState onRetry={load} />}

      {status === 'idle' && docs.length === 0 && (
        <EmptyState
          icon="📄"
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
                  <span className="text-2xl flex-shrink-0 mt-0.5" aria-hidden="true">📄</span>
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
                      <span>·</span>
                      <span>Uploaded {new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                    >
                      Download
                    </a>
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
