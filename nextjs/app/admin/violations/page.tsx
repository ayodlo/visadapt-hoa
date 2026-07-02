'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/context/toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { VIOLATION_TYPES, VIOLATION_STATUSES, violationTypeLabel } from '@/lib/violations';

interface Author { firstName: string; lastName: string; role: string }
interface Comment { id: string; body: string; isInternal: boolean; createdAt: string; author: Author }
interface Activity { id: string; action: string; details: string | null; createdAt: string; actor: Author | null }
interface Appeal {
  id: string; reason: string; status: string; outcome: string | null;
  createdAt: string; reviewedAt: string | null;
  submittedBy: { firstName: string; lastName: string };
  reviewedBy: { firstName: string; lastName: string } | null;
}

interface ViolationRow {
  id: string; violationType: string; description: string; status: string;
  deadline: string | null; createdAt: string; observedAt: string;
  resident: { firstName: string; lastName: string };
  property: { streetAddress: string; unitNumber: string | null } | null;
  appeal: { id: string; status: string } | null;
  _count: { comments: number };
}

interface ViolationDetail extends ViolationRow {
  ruleCitation: string; resolutionSteps: string | null; evidenceUrl: string | null;
  resident: { id: string; firstName: string; lastName: string; email: string };
  property: { streetAddress: string; unitNumber: string | null; city: string; state: string } | null;
  createdBy: { firstName: string; lastName: string };
  comments: Comment[]; activities: Activity[]; appeal: Appeal | null;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function activityLabel(a: string) {
  switch (a) {
    case 'created': return 'Violation created';
    case 'notice_sent': return 'Notice sent to resident';
    case 'resident_responded': return 'Resident submitted response';
    case 'status_changed': return 'Status updated';
    case 'appeal_filed': return 'Resident filed appeal';
    case 'appeal_reviewed': return 'Appeal reviewed';
    case 'comment_added': return 'Comment added';
    default: return a.replace(/_/g, ' ');
  }
}

type PanelMode = 'list' | 'create' | 'detail';

export default function AdminViolationsPage() {
  const { toast } = useToast();
  const [violations, setViolations] = useState<ViolationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [appealFilter, setAppealFilter] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mode, setMode] = useState<PanelMode>('list');
  const [selected, setSelected] = useState<ViolationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Edit state
  const [newStatus, setNewStatus] = useState('');
  const [deadline, setDeadline] = useState('');
  const [resolutionSteps, setResolutionSteps] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);

  // Appeal state
  const [appealStatus, setAppealStatus] = useState('');
  const [appealOutcome, setAppealOutcome] = useState('');
  const [savingAppeal, setSavingAppeal] = useState(false);
  const [confirmAppeal, setConfirmAppeal] = useState<string | null>(null);

  // Create form state
  const [residents, setResidents] = useState<{ id: string; firstName: string; lastName: string; email: string }[]>([]);
  const [createForm, setCreateForm] = useState({
    residentId: '', violationType: '', ruleCitation: '', description: '',
    observedAt: '', deadline: '', resolutionSteps: '', sendNow: false,
  });
  const [creating, setCreating] = useState(false);

  const fetchList = useCallback(async (s: string, st: string, ty: string, ap: boolean, pg: number) => {
    setLoading(true); setLoadError('');
    try {
      const p = new URLSearchParams();
      if (s) p.set('search', s); if (st) p.set('status', st); if (ty) p.set('type', ty);
      if (ap) p.set('hasAppeal', 'true'); p.set('page', String(pg));
      const res = await fetch(`/api/admin/violations?${p}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setViolations(json.violations); setTotal(json.total); setTotalPages(json.totalPages);
    } catch { setLoadError('Failed to load violations.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchList(search, statusFilter, typeFilter, appealFilter, page); }, [fetchList, search, statusFilter, typeFilter, appealFilter, page]);

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(j => setResidents((j.users ?? []).filter((u: {role:string}) => u.role === 'RESIDENT'))).catch(() => {});
  }, []);

  function handleSearch(v: string) {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setPage(1), 400);
  }

  async function openDetail(id: string) {
    setDetailLoading(true); setSelected(null); setMode('detail');
    try {
      const res = await fetch(`/api/admin/violations/${id}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      const v = json.violation;
      setSelected(v);
      setNewStatus(''); setComment(''); setIsInternal(false);
      setDeadline(v.deadline ? v.deadline.slice(0, 10) : '');
      setResolutionSteps(v.resolutionSteps ?? '');
      setEvidenceUrl(v.evidenceUrl ?? '');
      setAppealStatus(''); setAppealOutcome(v.appeal?.outcome ?? '');
    } catch { toast('Failed to load violation details.', 'error'); setMode('list'); }
    finally { setDetailLoading(false); }
  }

  async function saveChanges(overrideStatus?: string) {
    if (!selected) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      const s = overrideStatus ?? newStatus;
      if (s) payload.status = s;
      if (deadline !== (selected.deadline?.slice(0, 10) ?? '')) payload.deadline = deadline ? new Date(deadline).toISOString() : null;
      if (resolutionSteps !== (selected.resolutionSteps ?? '')) payload.resolutionSteps = resolutionSteps || null;
      if (evidenceUrl !== (selected.evidenceUrl ?? '')) payload.evidenceUrl = evidenceUrl || null;
      if (comment.trim()) { payload.comment = comment.trim(); payload.isInternal = isInternal; }

      const res = await fetch(`/api/admin/violations/${selected.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to save');
      setSelected(json.violation); setNewStatus(''); setComment(''); setIsInternal(false);
      setConfirmSend(false);
      toast(overrideStatus === 'NOTICE_SENT' ? 'Notice sent to resident.' : 'Changes saved.', 'success');
      fetchList(search, statusFilter, typeFilter, appealFilter, page);
    } catch (ex) { toast(ex instanceof Error ? ex.message : 'Failed to save', 'error'); }
    finally { setSaving(false); }
  }

  async function saveAppealDecision() {
    if (!selected || !appealStatus) return;
    setSavingAppeal(true);
    try {
      const res = await fetch(`/api/admin/violations/${selected.id}/appeal`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: appealStatus, outcome: appealOutcome || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      setSelected((prev) => prev ? { ...prev, appeal: json.appeal } : prev);
      setAppealStatus(''); setConfirmAppeal(null);
      toast('Appeal decision recorded.', 'success');
      fetchList(search, statusFilter, typeFilter, appealFilter, page);
    } catch (ex) { toast(ex instanceof Error ? ex.message : 'Failed to save appeal', 'error'); }
    finally { setSavingAppeal(false); }
  }

  async function handleCreate() {
    if (!createForm.residentId || !createForm.violationType || !createForm.ruleCitation || !createForm.description || !createForm.observedAt) {
      toast('Please fill in all required fields.', 'error'); return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/violations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residentId: createForm.residentId, violationType: createForm.violationType,
          ruleCitation: createForm.ruleCitation, description: createForm.description,
          observedAt: new Date(createForm.observedAt).toISOString(),
          deadline: createForm.deadline ? new Date(createForm.deadline).toISOString() : undefined,
          resolutionSteps: createForm.resolutionSteps || undefined,
          sendNow: createForm.sendNow,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to create');
      toast(createForm.sendNow ? 'Violation created and notice sent.' : 'Violation draft created.', 'success');
      setMode('list');
      fetchList(search, statusFilter, typeFilter, appealFilter, page);
      setCreateForm({ residentId: '', violationType: '', ruleCitation: '', description: '', observedAt: '', deadline: '', resolutionSteps: '', sendNow: false });
    } catch (ex) { toast(ex instanceof Error ? ex.message : 'Failed to create', 'error'); }
    finally { setCreating(false); }
  }

  const isDraft = selected?.status === 'DRAFT';

  return (
    <div className="flex h-full min-h-0 gap-0">
      {/* List panel */}
      <div className={`flex flex-col min-h-0 ${mode !== 'list' ? 'hidden lg:flex lg:w-80 xl:w-96 flex-shrink-0 border-r border-gray-200' : 'flex-1'}`}>
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-gray-200">
          <PageHeader
            title="Violations"
            subtitle={`${total} total`}
            action={
              <button onClick={() => setMode('create')}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                + New
              </button>
            }
          />
          <div className="mt-3 space-y-2">
            <input type="search" placeholder="Search resident or description…" value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-2">
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Statuses</option>
                {VIOLATION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Types</option>
                {VIOLATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
              <input type="checkbox" checked={appealFilter} onChange={(e) => { setAppealFilter(e.target.checked); setPage(1); }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              Show only with appeals
            </label>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? <LoadingState rows={5} /> : loadError ? (
            <div className="p-4"><ErrorState message={loadError} onRetry={() => fetchList(search, statusFilter, typeFilter, appealFilter, page)} /></div>
          ) : violations.length === 0 ? (
            <div className="p-4"><EmptyState title="No violations" description="No records match your filters." /></div>
          ) : (
            <div className="divide-y divide-gray-100">
              {violations.map((v) => (
                <button key={v.id} onClick={() => openDetail(v.id)}
                  className={`w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-inset focus:ring-2 focus:ring-blue-500 ${selected?.id === v.id ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{violationTypeLabel(v.violationType)}</span>
                    <StatusBadge status={v.status} />
                    {v.appeal && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">Appeal</span>}
                  </div>
                  <p className="text-sm font-medium text-gray-900">{v.resident.firstName} {v.resident.lastName}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{v.description}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>{fmtDate(v.observedAt)}</span>
                    {v.deadline && <span>Due {fmtDate(v.deadline)}</span>}
                    {v._count.comments > 0 && <span>{v._count.comments} note{v._count.comments !== 1 ? 's' : ''}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-t border-gray-200 text-sm">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="text-blue-600 disabled:text-gray-300 font-medium">Previous</button>
            <span className="text-gray-500">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="text-blue-600 disabled:text-gray-300 font-medium">Next</button>
          </div>
        )}
      </div>

      {/* Create panel */}
      {mode === 'create' && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-5 py-5 space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setMode('list')} className="text-sm text-blue-600 hover:text-blue-800 font-medium focus:outline-none">← Back</button>
              <h2 className="text-lg font-semibold text-gray-900">New Violation</h2>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Resident <span className="text-red-500">*</span></label>
                  <select value={createForm.residentId} onChange={e => setCreateForm(f => ({ ...f, residentId: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select resident…</option>
                    {residents.map(r => <option key={r.id} value={r.id}>{r.firstName} {r.lastName} — {r.email}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Violation Type <span className="text-red-500">*</span></label>
                  <select value={createForm.violationType} onChange={e => setCreateForm(f => ({ ...f, violationType: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select type…</option>
                    {VIOLATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date Observed <span className="text-red-500">*</span></label>
                  <input type="date" value={createForm.observedAt} onChange={e => setCreateForm(f => ({ ...f, observedAt: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Response Deadline</label>
                  <input type="date" value={createForm.deadline} onChange={e => setCreateForm(f => ({ ...f, deadline: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Rule Citation <span className="text-red-500">*</span></label>
                <input type="text" value={createForm.ruleCitation} onChange={e => setCreateForm(f => ({ ...f, ruleCitation: e.target.value }))}
                  placeholder="e.g. CC&Rs Section 5.3 — Parking Regulations"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
                <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  rows={4} placeholder="Describe what was observed in detail, including location, date, and any relevant context…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Resolution Steps</label>
                <textarea value={createForm.resolutionSteps} onChange={e => setCreateForm(f => ({ ...f, resolutionSteps: e.target.value }))}
                  rows={3} placeholder="Describe what the resident needs to do to resolve this violation…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Evidence placeholder */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">Evidence</p>
                <div className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-2.5 bg-gray-50">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs text-gray-500">Photo / document upload coming soon. Evidence reference can be added after creation.</span>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={createForm.sendNow} onChange={e => setCreateForm(f => ({ ...f, sendNow: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-gray-700">Send notice to resident immediately</span>
              </label>

              <div className="flex gap-2 pt-1">
                <button onClick={handleCreate} disabled={creating}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {creating ? 'Creating…' : createForm.sendNow ? 'Create & Send Notice' : 'Save as Draft'}
                </button>
                <button onClick={() => setMode('list')} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 focus:outline-none">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {mode === 'detail' && selected && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-5 py-5 space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setMode('list')} className="lg:hidden text-sm text-blue-600 font-medium focus:outline-none">← Back</button>
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{violationTypeLabel(selected.violationType)}</span>
                <StatusBadge status={selected.status} />
                {selected.appeal && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">Appeal: {selected.appeal.status.replace(/_/g, ' ')}</span>}
                <span className="text-xs text-gray-400 ml-auto">#{selected.id.slice(-8).toUpperCase()}</span>
              </div>
            </div>

            {detailLoading && <LoadingState />}

            {/* Resident / property */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Resident</p>
                <p className="font-medium text-gray-900">{selected.resident.firstName} {selected.resident.lastName}</p>
                <p className="text-xs text-gray-500">{selected.resident.email}</p>
              </div>
              {selected.property && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Property</p>
                  <p className="text-xs text-gray-900">{selected.property.streetAddress}{selected.property.unitNumber ? ` ${selected.property.unitNumber}` : ''}<br />{selected.property.city}, {selected.property.state}</p>
                </div>
              )}
              <div><p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Observed</p><p>{fmtDate(selected.observedAt)}</p></div>
              {selected.deadline && <div><p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Deadline</p><p>{fmtDate(selected.deadline)}</p></div>}
              <div className="col-span-2"><p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Rule Citation</p><p className="text-sm font-medium text-gray-800">{selected.ruleCitation}</p></div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Description</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.description}</p>
              {selected.resolutionSteps && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Resolution Steps</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.resolutionSteps}</p>
                </div>
              )}
              {selected.evidenceUrl && (
                <div className="mt-2 text-xs text-blue-600 font-medium">Evidence on file: {selected.evidenceUrl}</div>
              )}
            </div>

            {/* Admin actions */}
            {!['RESOLVED', 'CLOSED'].includes(selected.status) && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900">Manage Violation</h3>

                {isDraft && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
                    <span className="text-sm text-amber-800">This violation is a draft. Send the notice to make it visible to the resident.</span>
                    <button onClick={() => setConfirmSend(true)} disabled={saving}
                      className="ml-auto px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 focus:outline-none flex-shrink-0">
                      Send Notice
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {!isDraft && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Update Status</label>
                      <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Keep current</option>
                        {VIOLATION_STATUSES.filter(s => s.value !== 'DRAFT' && s.value !== selected.status).map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Response Deadline</label>
                    <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Resolution Steps</label>
                  <textarea value={resolutionSteps} onChange={e => setResolutionSteps(e.target.value)} rows={3}
                    placeholder="Describe what the resident must do to resolve this…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Evidence Reference</label>
                  <input type="text" value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)}
                    placeholder="e.g. photo-2026-07-02-001.jpg or CCTV timestamp"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Add Note</label>
                  <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
                    placeholder="Add a note for the resident or an internal staff note…"
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isInternal ? 'bg-amber-50 border-amber-300' : 'border-gray-300'}`} />
                  <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
                    <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-xs text-gray-600">Internal note (hidden from resident)</span>
                  </label>
                </div>

                <button onClick={() => saveChanges()} disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            )}

            {/* Appeal review */}
            {selected.appeal && (
              <div className="bg-white rounded-xl border border-indigo-200 p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  Appeal Filed
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{selected.appeal.status.replace(/_/g, ' ')}</span>
                </h3>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Resident&#39;s Appeal Reason</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.appeal.reason}</p>
                  <p className="text-xs text-gray-400 mt-1">Submitted {fmt(selected.appeal.createdAt)} by {selected.appeal.submittedBy.firstName} {selected.appeal.submittedBy.lastName}</p>
                </div>
                {selected.appeal.outcome && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Decision Notes</p>
                    <p className="text-sm text-gray-700">{selected.appeal.outcome}</p>
                    {selected.appeal.reviewedBy && <p className="text-xs text-gray-400 mt-1">by {selected.appeal.reviewedBy.firstName} {selected.appeal.reviewedBy.lastName}{selected.appeal.reviewedAt ? ` on ${fmt(selected.appeal.reviewedAt)}` : ''}</p>}
                  </div>
                )}

                {!['APPROVED', 'DENIED'].includes(selected.appeal.status) && (
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-700">Record Appeal Decision</p>
                    <div className="flex gap-2 flex-wrap">
                      {['UNDER_REVIEW', 'APPROVED', 'DENIED'].map(s => (
                        <button key={s} onClick={() => setAppealStatus(s)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors focus:outline-none ${
                            appealStatus === s
                              ? s === 'APPROVED' ? 'bg-green-600 text-white border-green-600'
                                : s === 'DENIED' ? 'bg-red-600 text-white border-red-600'
                                : 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}>
                          {s === 'UNDER_REVIEW' ? 'Mark Under Review' : s === 'APPROVED' ? 'Approve Appeal' : 'Deny Appeal'}
                        </button>
                      ))}
                    </div>
                    {appealStatus && (
                      <textarea value={appealOutcome} onChange={e => setAppealOutcome(e.target.value)} rows={3}
                        placeholder="Record the decision rationale or outcome notes…"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    )}
                    {appealStatus && (
                      <button
                        onClick={() => (appealStatus === 'APPROVED' || appealStatus === 'DENIED') ? setConfirmAppeal(appealStatus) : saveAppealDecision()}
                        disabled={savingAppeal}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {savingAppeal ? 'Saving…' : 'Save Decision'}
                      </button>
                    )}
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
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">{activityLabel(act.action)}</p>
                      {act.details && <p className="text-sm text-gray-600 mt-0.5">{act.details}</p>}
                      <p className="text-xs text-gray-400 mt-1">{act.actor ? `${act.actor.firstName} ${act.actor.lastName}` : 'System'} — {fmt(act.createdAt)}</p>
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
                  {selected.comments.map(c => (
                    <div key={c.id} className={`px-4 py-3 ${c.isInternal ? 'bg-amber-50' : ''}`}>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium text-gray-900">{c.author.firstName} {c.author.lastName}</span>
                        {c.author.role !== 'RESIDENT' && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Staff</span>}
                        {c.isInternal && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Internal</span>}
                        <span className="text-xs text-gray-400">{fmt(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-400">No comments yet.</p>}
            </section>
          </div>
        </div>
      )}

      {mode === 'list' && !loading && violations.length > 0 && (
        <div className="hidden lg:flex flex-1 items-center justify-center text-sm text-gray-400">
          Select a violation to review
        </div>
      )}

      <ConfirmDialog open={confirmSend} title="Send Notice to Resident"
        description="This will make the violation visible to the resident. Are you sure you want to send the notice now?"
        confirmLabel="Send Notice" onConfirm={() => saveChanges('NOTICE_SENT')} onCancel={() => setConfirmSend(false)} />

      <ConfirmDialog open={!!confirmAppeal}
        title={confirmAppeal === 'APPROVED' ? 'Approve Appeal' : 'Deny Appeal'}
        description={confirmAppeal === 'APPROVED'
          ? 'Approving this appeal will resolve the violation and notify the resident.'
          : 'Are you sure you want to deny this appeal? This decision is final.'}
        confirmLabel={confirmAppeal === 'APPROVED' ? 'Approve' : 'Deny'}
        destructive={confirmAppeal === 'DENIED'}
        onConfirm={saveAppealDecision}
        onCancel={() => setConfirmAppeal(null)} />
    </div>
  );
}
