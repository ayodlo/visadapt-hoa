'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/context/toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { violationTypeLabel } from '@/lib/violations';

interface Author { firstName: string; lastName: string }
interface Activity { id: string; action: string; details: string | null; createdAt: string; actor: Author | null }
interface Comment { id: string; body: string; isInternal: boolean; createdAt: string; author: Author & { role: string } }
interface Appeal {
  id: string; reason: string; status: string; outcome: string | null;
  createdAt: string; reviewedAt: string | null;
  submittedBy: Author;
  reviewedBy: Author | null;
}
interface ViolationDetail {
  id: string; violationType: string; description: string; status: string;
  ruleCitation: string; resolutionSteps: string | null; evidenceUrl: string | null;
  deadline: string | null; observedAt: string; createdAt: string;
  resident: { id: string; firstName: string; lastName: string; email: string };
  property: { streetAddress: string; unitNumber: string | null; city: string; state: string } | null;
  createdBy: Author;
  comments: Comment[];
  activities: Activity[];
  appeal: Appeal | null;
  _count: { comments: number };
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function actLabel(a: string) {
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

type Tab = 'escalated' | 'appeals';

export default function BoardViolationsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('appeals');
  const [violations, setViolations] = useState<ViolationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [selected, setSelected] = useState<ViolationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [appealDecision, setAppealDecision] = useState('');
  const [appealOutcome, setAppealOutcome] = useState('');
  const [savingAppeal, setSavingAppeal] = useState(false);
  const [confirmAppeal, setConfirmAppeal] = useState<string | null>(null);

  const [violationStatus, setViolationStatus] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  const fetchViolations = useCallback(async (t: Tab) => {
    setLoading(true); setLoadError('');
    try {
      const params = t === 'escalated' ? 'status=ESCALATED' : 'hasAppeal=true&status=NOTICE_SENT&status=RESIDENT_RESPONDED&status=UNDER_REVIEW&status=ESCALATED';
      const res = await fetch(`/api/admin/violations?${t === 'escalated' ? 'status=ESCALATED' : 'hasAppeal=true'}&limit=50`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      const rows: ViolationDetail[] = json.violations;
      if (t === 'appeals') {
        setViolations(rows.filter(v => v.appeal && !['APPROVED', 'DENIED', 'WITHDRAWN'].includes(v.appeal.status)));
      } else {
        setViolations(rows.filter(v => v.status === 'ESCALATED'));
      }
      // suppress unused-var for params
      void params;
    } catch { setLoadError('Failed to load violations.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchViolations(tab); setSelected(null); }, [fetchViolations, tab]);

  async function openDetail(id: string) {
    setDetailLoading(true); setSelected(null);
    try {
      const res = await fetch(`/api/admin/violations/${id}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setSelected(json.violation);
      setAppealDecision(''); setAppealOutcome(json.violation.appeal?.outcome ?? '');
      setViolationStatus('');
    } catch { toast('Failed to load violation.', 'error'); }
    finally { setDetailLoading(false); }
  }

  async function saveAppealDecision() {
    if (!selected || !appealDecision) return;
    setSavingAppeal(true);
    try {
      const res = await fetch(`/api/admin/violations/${selected.id}/appeal`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: appealDecision, outcome: appealOutcome || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      setSelected(prev => prev ? { ...prev, appeal: json.appeal } : prev);
      setAppealDecision(''); setConfirmAppeal(null);
      toast('Appeal decision recorded.', 'success');
      fetchViolations(tab);
    } catch (ex) { toast(ex instanceof Error ? ex.message : 'Failed', 'error'); }
    finally { setSavingAppeal(false); }
  }

  async function saveViolationStatus() {
    if (!selected || !violationStatus) return;
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/admin/violations/${selected.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: violationStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      setSelected(json.violation); setViolationStatus('');
      toast('Status updated.', 'success');
      fetchViolations(tab);
    } catch (ex) { toast(ex instanceof Error ? ex.message : 'Failed to update status', 'error'); }
    finally { setSavingStatus(false); }
  }

  const pendingAppeals = violations.filter(v => v.appeal && !['APPROVED', 'DENIED', 'WITHDRAWN'].includes(v.appeal.status)).length;
  const escalatedCount = violations.filter(v => v.status === 'ESCALATED').length;

  return (
    <div className="flex h-full min-h-0">
      {/* List panel */}
      <div className={`flex flex-col min-h-0 ${selected ? 'hidden lg:flex lg:w-80 xl:w-96 flex-shrink-0 border-r border-gray-200' : 'flex-1'}`}>
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-gray-200">
          <PageHeader title="Board: Violations" subtitle="Escalated cases and appeal review" />
          <div className="mt-3 flex border border-gray-200 rounded-lg overflow-hidden text-sm font-medium">
            <button onClick={() => setTab('appeals')}
              className={`flex-1 py-2 text-center transition-colors focus:outline-none ${tab === 'appeals' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Appeals {pendingAppeals > 0 && tab !== 'appeals' && <span className="ml-1 text-xs bg-indigo-100 text-indigo-700 px-1.5 rounded-full">{pendingAppeals}</span>}
            </button>
            <button onClick={() => setTab('escalated')}
              className={`flex-1 py-2 text-center transition-colors focus:outline-none ${tab === 'escalated' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Escalated {escalatedCount > 0 && tab !== 'escalated' && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 rounded-full">{escalatedCount}</span>}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? <LoadingState rows={5} /> : loadError ? (
            <div className="p-4"><ErrorState message={loadError} onRetry={() => fetchViolations(tab)} /></div>
          ) : violations.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={tab === 'appeals' ? 'No pending appeals' : 'No escalated violations'}
                description={tab === 'appeals' ? 'All appeals have been resolved.' : 'No violations are currently escalated.'}
              />
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {violations.map((v) => (
                <button key={v.id} onClick={() => openDetail(v.id)}
                  className={`w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-inset focus:ring-2 focus:ring-blue-500 ${selected?.id === v.id ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{violationTypeLabel(v.violationType)}</span>
                    <StatusBadge status={v.status} />
                    {v.appeal && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">Appeal: {v.appeal.status.replace(/_/g, ' ')}</span>}
                  </div>
                  <p className="text-sm font-medium text-gray-900">{v.resident.firstName} {v.resident.lastName}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{v.description}</p>
                  {v.deadline && <p className="text-xs text-gray-400 mt-1">Deadline: {fmtDate(v.deadline)}</p>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-5 py-5 space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelected(null)} className="lg:hidden text-sm text-blue-600 font-medium focus:outline-none">← Back</button>
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{violationTypeLabel(selected.violationType)}</span>
                <StatusBadge status={selected.status} />
                {selected.appeal && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">Appeal: {selected.appeal.status.replace(/_/g, ' ')}</span>}
                <span className="text-xs text-gray-400 ml-auto">#{selected.id.slice(-8).toUpperCase()}</span>
              </div>
            </div>

            {detailLoading && <LoadingState />}

            {/* Overview */}
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
              <div className="col-span-2"><p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Rule Citation</p><p className="font-medium text-gray-800">{selected.ruleCitation}</p></div>
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
            </div>

            {/* Board: update violation status (escalated only) */}
            {selected.status === 'ESCALATED' && (
              <div className="bg-white rounded-xl border border-red-200 p-5 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Escalated Violation — Board Action</h3>
                <p className="text-sm text-gray-600">This violation has been escalated for board review. You may update the status or coordinate with management.</p>
                <div className="flex gap-2 flex-wrap">
                  {['UNDER_REVIEW', 'RESOLVED', 'CLOSED'].map(s => (
                    <button key={s} onClick={() => setViolationStatus(v => v === s ? '' : s)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors focus:outline-none ${
                        violationStatus === s
                          ? s === 'RESOLVED' || s === 'CLOSED' ? 'bg-green-600 text-white border-green-600' : 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}>
                      {s === 'UNDER_REVIEW' ? 'Move to Under Review' : s === 'RESOLVED' ? 'Mark Resolved' : 'Close'}
                    </button>
                  ))}
                </div>
                {violationStatus && (
                  <button onClick={saveViolationStatus} disabled={savingStatus}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {savingStatus ? 'Saving…' : 'Save Status'}
                  </button>
                )}
              </div>
            )}

            {/* Appeal review */}
            {selected.appeal && (
              <div className={`bg-white rounded-xl border p-5 space-y-4 ${['APPROVED', 'DENIED'].includes(selected.appeal.status) ? 'border-gray-200' : 'border-indigo-200'}`}>
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  Resident Appeal
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    selected.appeal.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                    selected.appeal.status === 'DENIED' ? 'bg-red-100 text-red-700' :
                    'bg-indigo-100 text-indigo-700'
                  }`}>
                    {selected.appeal.status.replace(/_/g, ' ')}
                  </span>
                </h3>

                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Appeal Reason</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.appeal.reason}</p>
                  <p className="text-xs text-gray-400 mt-1">Filed {fmt(selected.appeal.createdAt)} by {selected.appeal.submittedBy.firstName} {selected.appeal.submittedBy.lastName}</p>
                </div>

                {selected.appeal.outcome && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Decision Notes</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.appeal.outcome}</p>
                    {selected.appeal.reviewedBy && (
                      <p className="text-xs text-gray-400 mt-1">
                        by {selected.appeal.reviewedBy.firstName} {selected.appeal.reviewedBy.lastName}
                        {selected.appeal.reviewedAt ? ` — ${fmt(selected.appeal.reviewedAt)}` : ''}
                      </p>
                    )}
                  </div>
                )}

                {!['APPROVED', 'DENIED', 'WITHDRAWN'].includes(selected.appeal.status) && (
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-700">Board Decision</p>
                    <div className="flex gap-2 flex-wrap">
                      {(['UNDER_REVIEW', 'APPROVED', 'DENIED'] as const).map(s => (
                        <button key={s} onClick={() => setAppealDecision(d => d === s ? '' : s)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors focus:outline-none ${
                            appealDecision === s
                              ? s === 'APPROVED' ? 'bg-green-600 text-white border-green-600'
                                : s === 'DENIED' ? 'bg-red-600 text-white border-red-600'
                                : 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}>
                          {s === 'UNDER_REVIEW' ? 'Mark Under Review' : s === 'APPROVED' ? 'Approve Appeal' : 'Deny Appeal'}
                        </button>
                      ))}
                    </div>
                    {appealDecision && (
                      <>
                        {(appealDecision === 'APPROVED' || appealDecision === 'DENIED') && (
                          <div className={`rounded-lg p-3 text-xs ${appealDecision === 'APPROVED' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            {appealDecision === 'APPROVED'
                              ? 'Approving this appeal will automatically mark the violation as Resolved.'
                              : 'Denying this appeal is a final board decision and cannot be undone.'}
                          </div>
                        )}
                        <textarea value={appealOutcome} onChange={e => setAppealOutcome(e.target.value)} rows={3}
                          placeholder="Record the board's rationale for this decision…"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <button
                          onClick={() => (appealDecision === 'APPROVED' || appealDecision === 'DENIED') ? setConfirmAppeal(appealDecision) : saveAppealDecision()}
                          disabled={savingAppeal}
                          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                          {savingAppeal ? 'Saving…' : 'Record Decision'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Public comments from resident */}
            {selected.comments.filter(c => !c.isInternal).length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Resident Comments</h3>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {selected.comments.filter(c => !c.isInternal).map(c => (
                    <div key={c.id} className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium text-gray-900">{c.author.firstName} {c.author.lastName}</span>
                        {c.author.role !== 'RESIDENT' && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Staff</span>}
                        <span className="text-xs text-gray-400">{fmt(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Activity timeline */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Activity Timeline</h3>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {selected.activities.map(act => (
                  <div key={act.id} className="flex gap-3 px-4 py-3">
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">{actLabel(act.action)}</p>
                      {act.details && <p className="text-sm text-gray-600 mt-0.5">{act.details}</p>}
                      <p className="text-xs text-gray-400 mt-1">{act.actor ? `${act.actor.firstName} ${act.actor.lastName}` : 'System'} — {fmt(act.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {!selected && !loading && violations.length > 0 && (
        <div className="hidden lg:flex flex-1 items-center justify-center text-sm text-gray-400">
          Select a violation to review
        </div>
      )}

      <ConfirmDialog open={!!confirmAppeal}
        title={confirmAppeal === 'APPROVED' ? 'Approve Appeal' : 'Deny Appeal'}
        description={confirmAppeal === 'APPROVED'
          ? 'Approving this appeal will automatically resolve the violation. This is a final board decision.'
          : 'Are you sure you want to deny this appeal? This is a final board decision and cannot be undone.'}
        confirmLabel={confirmAppeal === 'APPROVED' ? 'Approve Appeal' : 'Deny Appeal'}
        destructive={confirmAppeal === 'DENIED'}
        onConfirm={saveAppealDecision}
        onCancel={() => setConfirmAppeal(null)} />
    </div>
  );
}
