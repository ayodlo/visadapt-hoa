'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/context/toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { REQUEST_TYPES, REQUEST_STATUSES, requestTypeLabel } from '@/lib/architectural-requests';

interface Author { firstName: string; lastName: string; role: string }
interface Comment { id: string; body: string; isInternal: boolean; createdAt: string; author: Author }
interface Activity { id: string; action: string; details: string | null; createdAt: string; actor: Author | null }

interface ArchRequestRow {
  id: string;
  requestType: string;
  description: string;
  status: string;
  desiredStartDate: string | null;
  createdAt: string;
  resident: { firstName: string; lastName: string };
  property: { streetAddress: string; unitNumber: string | null } | null;
  _count: { comments: number };
}

interface ArchRequestDetail extends ArchRequestRow {
  governingRuleReference: string | null;
  decisionReason: string | null;
  resident: { id: string; firstName: string; lastName: string; email: string };
  property: { streetAddress: string; unitNumber: string | null; city: string; state: string } | null;
  comments: Comment[];
  activities: Activity[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function activityLabel(action: string) {
  switch (action) {
    case 'created': return 'Request created';
    case 'submitted': return 'Request submitted for review';
    case 'updated': return 'Request details updated by resident';
    case 'withdrawn': return 'Request withdrawn';
    case 'status_changed': return 'Status updated';
    case 'rule_referenced': return 'Governing rule referenced';
    case 'comment_added': return 'Comment added';
    default: return action.replace(/_/g, ' ');
  }
}

const DECISION_STATUSES = ['APPROVED', 'DENIED', 'NEEDS_MORE_INFORMATION'];

export default function AdminArchRequestsPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<ArchRequestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detail panel
  const [selected, setSelected] = useState<ArchRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [ruleRef, setRuleRef] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDecision, setConfirmDecision] = useState<string | null>(null);

  const fetchList = useCallback(async (s: string, st: string, ty: string, pg: number) => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams();
      if (s) params.set('search', s);
      if (st) params.set('status', st);
      if (ty) params.set('type', ty);
      params.set('page', String(pg));
      const res = await fetch(`/api/admin/architectural-requests?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setRequests(json.requests);
      setTotal(json.total);
      setTotalPages(json.totalPages);
    } catch {
      setLoadError('Failed to load requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchList(search, statusFilter, typeFilter, page); }, [fetchList, search, statusFilter, typeFilter, page]);

  function handleSearch(val: string) {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); }, 400);
  }

  function handleFilter(key: 'status' | 'type', val: string) {
    if (key === 'status') setStatusFilter(val);
    else setTypeFilter(val);
    setPage(1);
  }

  async function openDetail(id: string) {
    setDetailLoading(true);
    setSelected(null);
    try {
      const res = await fetch(`/api/admin/architectural-requests/${id}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setSelected(json.request);
      setNewStatus('');
      setRuleRef(json.request.governingRuleReference ?? '');
      setDecisionReason(json.request.decisionReason ?? '');
      setComment('');
      setIsInternal(false);
    } catch {
      toast('Failed to load request details.', 'error');
    } finally {
      setDetailLoading(false);
    }
  }

  async function saveChanges() {
    if (!selected) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (newStatus) payload.status = newStatus;
      if (ruleRef !== (selected.governingRuleReference ?? '')) payload.governingRuleReference = ruleRef || null;
      if (decisionReason !== (selected.decisionReason ?? '')) payload.decisionReason = decisionReason || null;
      if (comment.trim()) { payload.comment = comment.trim(); payload.isInternal = isInternal; }

      const res = await fetch(`/api/admin/architectural-requests/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to save');
      setSelected(json.request);
      setNewStatus('');
      setComment('');
      setIsInternal(false);
      setConfirmDecision(null);
      toast('Changes saved.', 'success');
      fetchList(search, statusFilter, typeFilter, page);
    } catch (ex) {
      toast(ex instanceof Error ? ex.message : 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  const needsConfirm = newStatus === 'APPROVED' || newStatus === 'DENIED';

  return (
    <div className="flex h-full min-h-0 gap-0">
      {/* List panel */}
      <div className={`flex flex-col min-h-0 ${selected ? 'hidden lg:flex lg:w-80 xl:w-96 flex-shrink-0 border-r border-gray-200' : 'flex-1'}`}>
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-gray-200">
          <PageHeader title="Architectural Requests" subtitle={`${total} total`} />
          <div className="mt-4 space-y-2">
            <input
              type="search"
              placeholder="Search resident or description…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 flex-wrap">
              <select
                value={statusFilter}
                onChange={(e) => handleFilter('status', e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                {REQUEST_STATUSES.filter((s) => s.value !== 'DRAFT').map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={(e) => handleFilter('type', e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                {REQUEST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <LoadingState rows={5} />
          ) : loadError ? (
            <div className="p-4"><ErrorState message={loadError} onRetry={() => fetchList(search, statusFilter, typeFilter, page)} /></div>
          ) : requests.length === 0 ? (
            <div className="p-4"><EmptyState title="No requests" description="No requests match your filters." /></div>
          ) : (
            <div className="divide-y divide-gray-100">
              {requests.map((r) => (
                <button
                  key={r.id}
                  onClick={() => openDetail(r.id)}
                  className={`w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-inset focus:ring-2 focus:ring-blue-500 ${selected?.id === r.id ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                      {requestTypeLabel(r.requestType)}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {r.resident.firstName} {r.resident.lastName}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{r.description}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>{formatDateShort(r.createdAt)}</span>
                    {r._count.comments > 0 && <span>{r._count.comments} comment{r._count.comments !== 1 ? 's' : ''}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-t border-gray-200 text-sm">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-blue-600 disabled:text-gray-300 font-medium focus:outline-none"
            >
              Previous
            </button>
            <span className="text-gray-500">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-blue-600 disabled:text-gray-300 font-medium focus:outline-none"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-5 py-5 space-y-6">
            {/* Detail header */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelected(null)}
                className="lg:hidden text-sm text-blue-600 hover:text-blue-800 font-medium focus:outline-none"
              >
                ← Back
              </button>
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                  {requestTypeLabel(selected.requestType)}
                </span>
                <StatusBadge status={selected.status} />
                <span className="text-xs text-gray-400 ml-auto">#{selected.id.slice(-8).toUpperCase()}</span>
              </div>
            </div>

            {detailLoading && <LoadingState />}

            {/* Resident + property */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Resident</p>
                <p className="font-medium text-gray-900">{selected.resident.firstName} {selected.resident.lastName}</p>
                <p className="text-xs text-gray-500">{selected.resident.email}</p>
              </div>
              {selected.property && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Property</p>
                  <p className="text-gray-900 text-xs">
                    {selected.property.streetAddress}{selected.property.unitNumber ? ` ${selected.property.unitNumber}` : ''}<br />
                    {selected.property.city}, {selected.property.state}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Submitted</p>
                <p className="text-gray-900">{formatDateShort(selected.createdAt)}</p>
              </div>
              {selected.desiredStartDate && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Desired Start</p>
                  <p className="text-gray-900">{formatDateShort(selected.desiredStartDate)}</p>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Description</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selected.description}</p>
            </div>

            {/* Admin actions */}
            {!['APPROVED', 'DENIED', 'WITHDRAWN'].includes(selected.status) && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900">Review Actions</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Update Status</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Keep current ({selected.status.replace(/_/g, ' ')})</option>
                      {REQUEST_STATUSES.filter((s) => !['DRAFT', 'WITHDRAWN'].includes(s.value) && s.value !== selected.status).map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Governing Rule Reference</label>
                    <input
                      type="text"
                      value={ruleRef}
                      onChange={(e) => setRuleRef(e.target.value)}
                      placeholder="e.g. CC&Rs Section 7.2.4"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {DECISION_STATUSES.includes(newStatus) && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Decision Reason {(newStatus === 'APPROVED' || newStatus === 'DENIED') && <span className="text-red-500">*</span>}
                    </label>
                    <textarea
                      value={decisionReason}
                      onChange={(e) => setDecisionReason(e.target.value)}
                      rows={3}
                      placeholder={newStatus === 'NEEDS_MORE_INFORMATION' ? 'Explain what information is needed…' : 'Explain the decision…'}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Add Comment</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="Add a note for the resident or an internal note…"
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isInternal ? 'bg-amber-50 border-amber-300' : 'border-gray-300'}`}
                  />
                  <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-600">Internal note (not visible to resident)</span>
                  </label>
                </div>

                <button
                  onClick={() => needsConfirm ? setConfirmDecision(newStatus) : saveChanges()}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            )}

            {/* Governing rule + decision reason (read-only for decided) */}
            {(selected.governingRuleReference || selected.decisionReason) && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                {selected.governingRuleReference && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Governing Rule</p>
                    <p className="text-sm text-gray-700">{selected.governingRuleReference}</p>
                  </div>
                )}
                {selected.decisionReason && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Decision Reason</p>
                    <p className="text-sm text-gray-700">{selected.decisionReason}</p>
                  </div>
                )}
              </div>
            )}

            {/* Timeline */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Activity Timeline</h3>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {selected.activities.map((act) => (
                  <div key={act.id} className="flex gap-3 px-4 py-3">
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-400 flex-shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">{activityLabel(act.action)}</p>
                      {act.details && <p className="text-sm text-gray-600 mt-0.5">{act.details}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        {act.actor ? `${act.actor.firstName} ${act.actor.lastName}` : 'System'} — {formatDate(act.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Comments */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Comments {selected.comments.length > 0 && <span className="text-gray-400 font-normal">({selected.comments.length})</span>}
              </h3>
              {selected.comments.length > 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {selected.comments.map((c) => (
                    <div key={c.id} className={`px-4 py-3 ${c.isInternal ? 'bg-amber-50' : ''}`}>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium text-gray-900">{c.author.firstName} {c.author.lastName}</span>
                        {c.author.role !== 'RESIDENT' && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Staff</span>
                        )}
                        {c.isInternal && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Internal</span>
                        )}
                        <span className="text-xs text-gray-400">{formatDate(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No comments yet.</p>
              )}
            </section>
          </div>
        </div>
      )}

      {!selected && !loading && requests.length > 0 && (
        <div className="hidden lg:flex flex-1 items-center justify-center text-sm text-gray-400">
          Select a request to review
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDecision}
        title={confirmDecision === 'APPROVED' ? 'Approve Request' : 'Deny Request'}
        description={confirmDecision === 'APPROVED'
          ? 'Are you sure you want to approve this request? The resident will be notified.'
          : 'Are you sure you want to deny this request? Please ensure you have provided a decision reason.'}
        confirmLabel={confirmDecision === 'APPROVED' ? 'Approve' : 'Deny'}
        destructive={confirmDecision === 'DENIED'}
        onConfirm={saveChanges}
        onCancel={() => setConfirmDecision(null)}
      />
    </div>
  );
}
