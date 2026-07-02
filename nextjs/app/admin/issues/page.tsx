'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/session';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { Pagination } from '@/components/ui/Pagination';
import {
  ISSUE_CATEGORIES,
  ISSUE_STATUSES,
  ISSUE_PRIORITIES,
  categoryLabel,
} from '@/lib/issues';

interface IssueSummary {
  id: string;
  category: string;
  title: string;
  location: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  resident: { id: string; firstName: string; lastName: string };
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  vendor: { id: string; name: string } | null;
  _count: { comments: number };
}

interface ListData {
  issues: IssueSummary[];
  total: number;
  totalPages: number;
  page: number;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  ...ISSUE_STATUSES.map((s) => ({ value: s.value, label: s.label })),
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  ...ISSUE_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  ...ISSUE_PRIORITIES.map((p) => ({ value: p.value, label: p.label })),
];

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Newest First' },
  { value: 'updatedAt', label: 'Recently Updated' },
  { value: 'priority', label: 'Priority' },
];

function daysAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

export default function AdminIssuesPage() {
  const session = useSession();
  const router = useRouter();

  const [data, setData] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchList = useCallback(async (q: string, s: string, c: string, p: string, sort: string, pg: number) => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({ search: q, status: s, category: c, priority: p, sortBy: sort, page: String(pg) });
      const res = await fetch(`/api/admin/issues?${params}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setLoadError('Could not load issues. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session.role === 'RESIDENT') {
      router.replace('/resident/issues');
      return;
    }
    fetchList('', '', '', '', 'createdAt', 1);
  }, [session.role, router, fetchList]);

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchList(val, status, category, priority, sortBy, 1), 300);
  }

  function handleFilter(field: 'status' | 'category' | 'priority' | 'sortBy', val: string) {
    const next = { status, category, priority, sortBy, [field]: val };
    if (field === 'status') setStatus(val);
    else if (field === 'category') setCategory(val);
    else if (field === 'priority') setPriority(val);
    else setSortBy(val);
    setPage(1);
    fetchList(search, next.status, next.category, next.priority, next.sortBy, 1);
  }

  function handlePage(p: number) {
    setPage(p);
    fetchList(search, status, category, priority, sortBy, p);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Issues"
        subtitle="Manage and track community issue reports"
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        <div className="flex-1 min-w-48">
          <SearchInput value={search} onChange={handleSearch} placeholder="Search issues, residents, locations..." />
        </div>
        <FilterSelect value={status} onChange={(v) => handleFilter('status', v)} options={STATUS_OPTIONS} />
        <FilterSelect value={category} onChange={(v) => handleFilter('category', v)} options={CATEGORY_OPTIONS} />
        <FilterSelect value={priority} onChange={(v) => handleFilter('priority', v)} options={PRIORITY_OPTIONS} />
        <FilterSelect value={sortBy} onChange={(v) => handleFilter('sortBy', v)} options={SORT_OPTIONS} />
      </div>

      {data && (
        <p className="text-xs text-gray-500">{data.total} issue{data.total !== 1 ? 's' : ''}</p>
      )}

      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => fetchList(search, status, category, priority, sortBy, page)} />
      ) : !data || data.issues.length === 0 ? (
        <EmptyState title="No issues found" description="Try adjusting your search or filters." />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {data.issues.map((issue) => (
              <Link
                key={issue.id}
                href={`/admin/issues/${issue.id}`}
                className="block px-4 py-3 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                        {categoryLabel(issue.category)}
                      </span>
                      <StatusBadge status={issue.status} />
                      <StatusBadge status={issue.priority} />
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate">{issue.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{issue.location}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
                      <span>{issue.resident.firstName} {issue.resident.lastName}</span>
                      <span>{daysAgo(issue.createdAt)}</span>
                      {issue._count.comments > 0 && <span>{issue._count.comments} comment{issue._count.comments !== 1 ? 's' : ''}</span>}
                      {issue.assignedTo && <span>→ {issue.assignedTo.firstName} {issue.assignedTo.lastName}</span>}
                      {issue.vendor && <span>Vendor: {issue.vendor.name}</span>}
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
          {data.totalPages > 1 && (
            <Pagination page={page} totalPages={data.totalPages} onPageChange={handlePage} />
          )}
        </>
      )}
    </div>
  );
}
