'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/context/toast';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { requestTypeLabel } from '@/lib/architectural-requests';

interface Author { firstName: string; lastName: string; role: string }
interface Comment { id: string; body: string; createdAt: string; author: Author }
interface Activity { id: string; action: string; details: string | null; createdAt: string; actor: Author | null }

interface ArchRequest {
  id: string;
  requestType: string;
  description: string;
  status: string;
  desiredStartDate: string | null;
  governingRuleReference: string | null;
  decisionReason: string | null;
  createdAt: string;
  updatedAt: string;
  resident: { firstName: string; lastName: string };
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
    case 'updated': return 'Request details updated';
    case 'withdrawn': return 'Request withdrawn';
    case 'status_changed': return 'Status updated';
    case 'rule_referenced': return 'Governing rule referenced';
    case 'comment_added': return 'Comment added';
    default: return action.replace(/_/g, ' ');
  }
}

const WITHDRAW_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION'];
const EDIT_STATUSES = ['DRAFT', 'NEEDS_MORE_INFORMATION'];

export default function ResidentArchRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();

  const [request, setRequest] = useState<ArchRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/architectural-requests/${id}`);
      if (res.status === 403) throw new Error('You do not have access to this request.');
      if (res.status === 404) throw new Error('Request not found.');
      if (!res.ok) throw new Error('Failed to load request.');
      const json = await res.json();
      setRequest(json.request);
    } catch (ex) {
      setLoadError(ex instanceof Error ? ex.message : 'Could not load request.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/architectural-requests/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: comment }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to post comment');
      setComment('');
      await load();
      toast('Comment posted.', 'success');
    } catch (ex) {
      toast(ex instanceof Error ? ex.message : 'Failed to post comment', 'error');
    } finally {
      setPosting(false);
    }
  }

  async function handleWithdraw() {
    setWithdrawing(true);
    try {
      const res = await fetch(`/api/architectural-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdraw: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to withdraw');
      setWithdrawOpen(false);
      await load();
      toast('Request withdrawn.', 'success');
    } catch (ex) {
      toast(ex instanceof Error ? ex.message : 'Failed to withdraw', 'error');
    } finally {
      setWithdrawing(false);
    }
  }

  async function saveEdit(submitNow = false) {
    const setter = submitNow ? setSubmitting : setSaving;
    setter(true);
    try {
      const res = await fetch(`/api/architectural-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: editDesc, submitNow }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to save');
      setEditing(false);
      await load();
      toast(submitNow ? 'Request submitted for review.' : 'Changes saved.', 'success');
    } catch (ex) {
      toast(ex instanceof Error ? ex.message : 'Failed to save', 'error');
    } finally {
      setter(false);
    }
  }

  if (loading) return <LoadingState />;
  if (loadError) return <ErrorState message={loadError} />;
  if (!request) return null;

  const canEdit = EDIT_STATUSES.includes(request.status);
  const canWithdraw = WITHDRAW_STATUSES.includes(request.status);
  const isDraft = request.status === 'DRAFT';
  const needsInfo = request.status === 'NEEDS_MORE_INFORMATION';
  const isDecided = request.status === 'APPROVED' || request.status === 'DENIED';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/resident/architectural-requests" className="hover:text-blue-600 transition-colors">My Requests</Link>
        <span aria-hidden="true">›</span>
        <span className="text-gray-800">{requestTypeLabel(request.requestType)} Request</span>
      </div>

      {/* Needs more info banner */}
      {needsInfo && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex gap-3">
          <span className="text-xl flex-shrink-0" aria-hidden="true">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">Action Required — More Information Needed</p>
            <p className="text-sm text-amber-700 mt-0.5">The reviewer has requested additional information. Please review the comments below and provide a response or update your request description.</p>
          </div>
        </div>
      )}

      {/* Approved / Denied banner */}
      {isDecided && (
        <div className={`rounded-xl p-4 flex gap-3 ${request.status === 'APPROVED' ? 'bg-green-50 border border-green-300' : 'bg-red-50 border border-red-300'}`}>
          <span className="text-xl flex-shrink-0" aria-hidden="true">{request.status === 'APPROVED' ? '✅' : '❌'}</span>
          <div>
            <p className={`text-sm font-semibold ${request.status === 'APPROVED' ? 'text-green-800' : 'text-red-800'}`}>
              Request {request.status === 'APPROVED' ? 'Approved' : 'Denied'}
            </p>
            {request.decisionReason && (
              <p className={`text-sm mt-0.5 ${request.status === 'APPROVED' ? 'text-green-700' : 'text-red-700'}`}>
                {request.decisionReason}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-gray-100 text-gray-700 font-medium px-2 py-0.5 rounded-full">
              {requestTypeLabel(request.requestType)}
            </span>
            <StatusBadge status={request.status} />
          </div>
          <span className="text-xs text-gray-400">#{request.id.slice(-8).toUpperCase()}</span>
        </div>

        {editing ? (
          <div className="space-y-3">
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button onClick={() => saveEdit(false)} disabled={saving || submitting} className="px-3 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              {isDraft && (
                <button onClick={() => saveEdit(true)} disabled={saving || submitting} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {submitting ? 'Submitting…' : 'Save & Submit'}
                </button>
              )}
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{request.description}</p>
            {canEdit && (
              <button
                onClick={() => { setEditDesc(request.description); setEditing(true); }}
                className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium focus:outline-none"
              >
                Edit description
              </button>
            )}
          </>
        )}
      </div>

      {/* Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Status</p>
          <StatusBadge status={request.status} />
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Type</p>
          <p className="text-gray-900">{requestTypeLabel(request.requestType)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Submitted</p>
          <p className="text-gray-900">{formatDateShort(request.createdAt)}</p>
        </div>
        {request.desiredStartDate && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Desired Start</p>
            <p className="text-gray-900">{formatDateShort(request.desiredStartDate)}</p>
          </div>
        )}
        {request.property && (
          <div className="col-span-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Property</p>
            <p className="text-gray-900">
              {request.property.streetAddress}{request.property.unitNumber ? ` ${request.property.unitNumber}` : ''}, {request.property.city}
            </p>
          </div>
        )}
        {request.governingRuleReference && (
          <div className="col-span-2 sm:col-span-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Governing Rule Reference</p>
            <p className="text-gray-700 text-xs">{request.governingRuleReference}</p>
          </div>
        )}
      </div>

      {/* Attachments placeholder */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Supporting Documents</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {['Site Plan / Plot Diagram', 'Elevation Drawing or Photo', 'Material / Color Samples', 'Contractor Quote or Bid'].map((label) => (
            <div key={label} className="flex items-center gap-2 border border-dashed border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50">
              <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs text-gray-400">{label} — not uploaded</span>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Request Timeline</h2>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {request.activities.map((act) => (
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
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          Reviewer Comments {request.comments.length > 0 && <span className="text-gray-400 font-normal">({request.comments.length})</span>}
        </h2>
        {request.comments.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 mb-4">
            {request.comments.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900">{c.author.firstName} {c.author.lastName}</span>
                  {c.author.role !== 'RESIDENT' && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Staff</span>
                  )}
                  <span className="text-xs text-gray-400">{formatDate(c.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* Reply — allowed when not closed */}
        {!['WITHDRAWN', 'APPROVED', 'DENIED'].includes(request.status) && (
          <form onSubmit={postComment} className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Add a response</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Provide additional details, answer reviewer questions, or clarify your request..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            />
            <button
              type="submit"
              disabled={posting || !comment.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {posting ? 'Sending…' : 'Send Response'}
            </button>
          </form>
        )}
      </section>

      {/* Withdraw */}
      {canWithdraw && (
        <div className="border-t border-gray-200 pt-4">
          <button
            onClick={() => setWithdrawOpen(true)}
            className="text-sm text-red-600 hover:text-red-800 font-medium focus:outline-none"
          >
            Withdraw this request
          </button>
        </div>
      )}

      <ConfirmDialog
        open={withdrawOpen}
        title="Withdraw Request"
        description="Are you sure you want to withdraw this request? This action cannot be undone. You will need to submit a new request if you still want to proceed with this project."
        confirmLabel={withdrawing ? 'Withdrawing…' : 'Withdraw'}
        destructive
        onConfirm={handleWithdraw}
        onCancel={() => setWithdrawOpen(false)}
      />
    </div>
  );
}
