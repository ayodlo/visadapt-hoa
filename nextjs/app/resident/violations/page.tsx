'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { violationTypeLabel, residentStatusLabel } from '@/lib/violations';

interface ViolationRow {
  id: string;
  violationType: string;
  ruleCitation: string;
  description: string;
  status: string;
  deadline: string | null;
  observedAt: string;
  createdAt: string;
  property: { streetAddress: string; unitNumber: string | null } | null;
  appeal: { id: string; status: string } | null;
  _count: { comments: number };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusConfig(status: string, appealStatus?: string) {
  if (status === 'RESOLVED' || status === 'CLOSED') return { dot: 'bg-green-500', text: 'text-green-700 bg-green-50 border-green-200' };
  if (status === 'ESCALATED') return { dot: 'bg-red-500', text: 'text-red-700 bg-red-50 border-red-200' };
  if (status === 'NOTICE_SENT') return { dot: 'bg-orange-400', text: 'text-orange-700 bg-orange-50 border-orange-200' };
  if (status === 'RESIDENT_RESPONDED') return { dot: 'bg-blue-400', text: 'text-blue-700 bg-blue-50 border-blue-200' };
  if (status === 'UNDER_REVIEW') return { dot: 'bg-yellow-400', text: 'text-yellow-700 bg-yellow-50 border-yellow-200' };
  if (appealStatus === 'APPROVED') return { dot: 'bg-green-500', text: 'text-green-700 bg-green-50 border-green-200' };
  return { dot: 'bg-gray-400', text: 'text-gray-600 bg-gray-50 border-gray-200' };
}

function isPastDeadline(deadline: string | null) {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

export default function ResidentViolationsPage() {
  const [violations, setViolations] = useState<ViolationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/violations/me');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setViolations(json.violations);
    } catch {
      setLoadError('Could not load your notices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeCount = violations.filter((v) => !['RESOLVED', 'CLOSED'].includes(v.status)).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Community Standards Notices"
        subtitle={activeCount > 0 ? `${activeCount} active notice${activeCount > 1 ? 's' : ''}` : 'Your compliance history'}
      />

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">About Community Standards Notices</p>
        <p>If you receive a notice, it means the association has observed something that may need your attention. Each notice includes the relevant rule, steps to resolve the issue, and a deadline. You have the right to respond and, where applicable, to file an appeal.</p>
      </div>

      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : violations.length === 0 ? (
        <EmptyState title="No notices on file" description="You have no community standards notices. Keep up the great work!" />
      ) : (
        <div className="space-y-3">
          {violations.map((v) => {
            const cfg = statusConfig(v.status, v.appeal?.status);
            const pastDeadline = isPastDeadline(v.deadline);
            return (
              <Link
                key={v.id}
                href={`/resident/violations/${v.id}`}
                className="block bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                          {violationTypeLabel(v.violationType)}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
                          {residentStatusLabel(v.status)}
                        </span>
                        {v.appeal && (
                          <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">
                            Appeal {v.appeal.status === 'APPROVED' ? 'Approved' : v.appeal.status === 'DENIED' ? 'Denied' : 'Filed'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{violationTypeLabel(v.violationType)} Notice</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{v.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
                        <span>Observed {formatDate(v.observedAt)}</span>
                        {v.deadline && (
                          <span className={pastDeadline && !['RESOLVED', 'CLOSED'].includes(v.status) ? 'text-red-600 font-medium' : ''}>
                            {pastDeadline && !['RESOLVED', 'CLOSED'].includes(v.status) ? 'Deadline passed: ' : 'Respond by: '}
                            {formatDate(v.deadline)}
                          </span>
                        )}
                        {v._count.comments > 0 && <span>{v._count.comments} comment{v._count.comments > 1 ? 's' : ''}</span>}
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
