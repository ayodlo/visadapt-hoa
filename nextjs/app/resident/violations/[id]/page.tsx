'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/context/toast';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { violationTypeLabel, residentStatusLabel, APPEALABLE_STATUSES } from '@/lib/violations';

interface Author { firstName: string; lastName: string; role: string }
interface Comment { id: string; body: string; isInternal: boolean; createdAt: string; author: Author }
interface Activity { id: string; action: string; details: string | null; createdAt: string; actor: Author | null }
interface Appeal {
  id: string;
  reason: string;
  status: string;
  outcome: string | null;
  createdAt: string;
  reviewedAt: string | null;
  submittedBy: { firstName: string; lastName: string };
  reviewedBy: { firstName: string; lastName: string } | null;
}

interface Violation {
  id: string;
  violationType: string;
  ruleCitation: string;
  description: string;
  status: string;
  observedAt: string;
  deadline: string | null;
  resolutionSteps: string | null;
  evidenceUrl: string | null;
  createdAt: string;
  resident: { firstName: string; lastName: string; email: string };
  property: { streetAddress: string; unitNumber: string | null; city: string; state: string } | null;
  createdBy: { firstName: string; lastName: string };
  comments: Comment[];
  activities: Activity[];
  appeal: Appeal | null;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function activityLabel(action: string) {
  switch (action) {
    case 'created': return 'Notice created';
    case 'notice_sent': return 'Notice sent to you';
    case 'resident_responded': return 'You submitted a response';
    case 'status_changed': return 'Status updated';
    case 'appeal_filed': return 'Appeal submitted';
    case 'appeal_reviewed': return 'Appeal reviewed';
    case 'comment_added': return 'Comment from staff';
    default: return action.replace(/_/g, ' ');
  }
}

function deadlineBanner(deadline: string | null, status: string) {
  if (!deadline || ['RESOLVED', 'CLOSED'].includes(status)) return null;
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (days < 0) return { cls: 'bg-red-50 border-red-300 text-red-800', text: `Response deadline has passed (${fmtDate(deadline)})` };
  if (days <= 3) return { cls: 'bg-orange-50 border-orange-300 text-orange-800', text: `Deadline is ${days === 0 ? 'today' : `in ${days} day${days > 1 ? 's' : ''}`} — ${fmtDate(deadline)}` };
  return { cls: 'bg-yellow-50 border-yellow-200 text-yellow-800', text: `Please respond by ${fmtDate(deadline)}` };
}

const CLOSED_FOR_RESPONSE = ['RESIDENT_RESPONDED', 'UNDER_REVIEW', 'RESOLVED', 'ESCALATED', 'CLOSED'];
const CLOSED_FINAL = ['RESOLVED', 'CLOSED', 'WITHDRAWN'];

export default function ResidentViolationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();

  const [violation, setViolation] = useState<Violation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [responseText, setResponseText] = useState('');
  const [responding, setResponding] = useState(false);
  const [showResponseForm, setShowResponseForm] = useState(false);

  const [appealReason, setAppealReason] = useState('');
  const [appealing, setAppealing] = useState(false);
  const [showAppealForm, setShowAppealForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/violations/${id}`);
      if (res.status === 403 || res.status === 404) throw new Error('This notice could not be found.');
      if (!res.ok) throw new Error('Failed to load notice.');
      const json = await res.json();
      setViolation(json.violation);
    } catch (ex) {
      setLoadError(ex instanceof Error ? ex.message : 'Could not load notice.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function submitResponse(e: React.FormEvent) {
    e.preventDefault();
    if (responseText.trim().length < 10) { toast('Response must be at least 10 characters.', 'error'); return; }
    setResponding(true);
    try {
      const res = await fetch(`/api/violations/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: responseText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to submit');
      setResponseText('');
      setShowResponseForm(false);
      await load();
      toast('Your response has been submitted.', 'success');
    } catch (ex) {
      toast(ex instanceof Error ? ex.message : 'Failed to submit response', 'error');
    } finally {
      setResponding(false);
    }
  }

  async function submitAppeal(e: React.FormEvent) {
    e.preventDefault();
    if (appealReason.trim().length < 20) { toast('Appeal reason must be at least 20 characters.', 'error'); return; }
    setAppealing(true);
    try {
      const res = await fetch(`/api/violations/${id}/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: appealReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to file appeal');
      setAppealReason('');
      setShowAppealForm(false);
      await load();
      toast('Your appeal has been filed.', 'success');
    } catch (ex) {
      toast(ex instanceof Error ? ex.message : 'Failed to file appeal', 'error');
    } finally {
      setAppealing(false);
    }
  }

  if (loading) return <LoadingState />;
  if (loadError) return <ErrorState message={loadError} />;
  if (!violation) return null;

  const canRespond = violation.status === 'NOTICE_SENT';
  const canAppeal = (APPEALABLE_STATUSES as readonly string[]).includes(violation.status) && !violation.appeal;
  const isFinal = CLOSED_FINAL.includes(violation.status);
  const deadline = deadlineBanner(violation.deadline, violation.status);
  const publicComments = violation.comments.filter((c) => !c.isInternal);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/resident/violations" className="hover:text-blue-600 transition-colors">My Notices</Link>
        <span aria-hidden="true">›</span>
        <span className="text-gray-800">{violationTypeLabel(violation.violationType)} Notice</span>
      </div>

      {/* Deadline banner */}
      {deadline && (
        <div className={`rounded-xl border p-4 flex gap-3 ${deadline.cls}`}>
          <span className="text-lg flex-shrink-0" aria-hidden="true">⏰</span>
          <p className="text-sm font-medium">{deadline.text}</p>
        </div>
      )}

      {/* Appeal outcome banner */}
      {violation.appeal?.status === 'APPROVED' && (
        <div className="bg-green-50 border border-green-300 rounded-xl p-4 flex gap-3">
          <span className="text-xl flex-shrink-0" aria-hidden="true">✅</span>
          <div>
            <p className="text-sm font-semibold text-green-800">Your Appeal Was Approved</p>
            {violation.appeal.outcome && <p className="text-sm text-green-700 mt-0.5">{violation.appeal.outcome}</p>}
          </div>
        </div>
      )}
      {violation.appeal?.status === 'DENIED' && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex gap-3">
          <span className="text-xl flex-shrink-0" aria-hidden="true">❌</span>
          <div>
            <p className="text-sm font-semibold text-red-800">Your Appeal Was Not Approved</p>
            {violation.appeal.outcome && <p className="text-sm text-red-700 mt-0.5">{violation.appeal.outcome}</p>}
          </div>
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
            {violationTypeLabel(violation.violationType)}
          </span>
          <span className="text-xs font-medium border px-2 py-0.5 rounded-full text-gray-600 border-gray-300">
            {residentStatusLabel(violation.status)}
          </span>
          <span className="text-xs text-gray-400 ml-auto">#{violation.id.slice(-8).toUpperCase()}</span>
        </div>

        <h1 className="text-lg font-bold text-gray-900 mb-1">{violationTypeLabel(violation.violationType)} Notice</h1>
        <p className="text-xs text-gray-400 mb-4">Observed {fmtDate(violation.observedAt)}</p>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">What was observed</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{violation.description}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Applicable community rule</p>
            <p className="text-sm text-gray-700 font-medium">{violation.ruleCitation}</p>
          </div>

          {/* Evidence placeholder */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Evidence</p>
            {violation.evidenceUrl ? (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-medium">Photo / document on file</span>
                <span className="text-xs text-gray-400">(contact management office to request a copy)</span>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No photographic evidence on file for this notice.</p>
            )}
          </div>

          {violation.resolutionSteps && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">How to resolve this notice</p>
              <p className="text-sm text-blue-900 whitespace-pre-wrap leading-relaxed">{violation.resolutionSteps}</p>
            </div>
          )}
        </div>
      </div>

      {/* Key details */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Status</p>
          <p className="font-medium text-gray-900">{residentStatusLabel(violation.status)}</p>
        </div>
        {violation.deadline && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Response Deadline</p>
            <p className={`font-medium ${new Date(violation.deadline) < new Date() && !isFinal ? 'text-red-600' : 'text-gray-900'}`}>
              {fmtDate(violation.deadline)}
            </p>
          </div>
        )}
        {violation.property && (
          <div className="col-span-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Property</p>
            <p className="text-gray-900">{violation.property.streetAddress}{violation.property.unitNumber ? ` ${violation.property.unitNumber}` : ''}, {violation.property.city}</p>
          </div>
        )}
        <div className="col-span-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Questions or concerns?</p>
          <p className="text-sm text-gray-600">Contact the management office at <span className="font-medium text-gray-800">management@communityhq.local</span> or call during business hours (Mon–Fri 9 AM–5 PM).</p>
        </div>
      </div>

      {/* Staff comments */}
      {publicComments.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Messages from Management {publicComments.length > 0 && <span className="text-gray-400 font-normal">({publicComments.length})</span>}
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {publicComments.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900">{c.author.firstName} {c.author.lastName}</span>
                  {c.author.role !== 'RESIDENT' && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Staff</span>
                  )}
                  <span className="text-xs text-gray-400">{fmt(c.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Response form */}
      {canRespond && !CLOSED_FOR_RESPONSE.includes(violation.status) && (
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Submit Your Response</h2>
          <p className="text-sm text-gray-500 mb-3">Responding will notify the management office and update your notice status. You may explain your situation, provide context, or confirm you have taken corrective action.</p>
          {!showResponseForm ? (
            <button
              onClick={() => setShowResponseForm(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Write a Response
            </button>
          ) : (
            <form onSubmit={submitResponse} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                rows={5}
                placeholder="Describe the corrective action you have taken, provide relevant context, or ask a question about this notice..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400">{responseText.length} characters (minimum 10)</p>
              <div className="flex gap-2">
                <button type="submit" disabled={responding || responseText.trim().length < 10}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {responding ? 'Submitting…' : 'Submit Response'}
                </button>
                <button type="button" onClick={() => setShowResponseForm(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 focus:outline-none">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* Already responded message */}
      {violation.status === 'RESIDENT_RESPONDED' && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-sm text-sky-800">
          <p className="font-semibold mb-0.5">Response Received</p>
          <p>Your response has been submitted and is under review. The management office will follow up if further action is needed.</p>
        </div>
      )}

      {/* Timeline */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Notice History</h2>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {violation.activities.map((act) => (
            <div key={act.id} className="flex gap-3 px-4 py-3">
              <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-400 flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{activityLabel(act.action)}</p>
                {act.details && <p className="text-sm text-gray-600 mt-0.5">{act.details}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  {act.actor ? `${act.actor.firstName} ${act.actor.lastName}` : 'System'} — {fmt(act.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Appeal section */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Appeal This Notice</h2>

        {violation.appeal ? (
          <div className={`rounded-xl border p-4 ${
            violation.appeal.status === 'APPROVED' ? 'bg-green-50 border-green-300' :
            violation.appeal.status === 'DENIED' ? 'bg-red-50 border-red-300' :
            'bg-indigo-50 border-indigo-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <p className={`text-sm font-semibold ${
                violation.appeal.status === 'APPROVED' ? 'text-green-800' :
                violation.appeal.status === 'DENIED' ? 'text-red-800' : 'text-indigo-800'
              }`}>
                Appeal {violation.appeal.status === 'APPROVED' ? 'Approved' : violation.appeal.status === 'DENIED' ? 'Denied' : violation.appeal.status === 'UNDER_REVIEW' ? 'Under Review' : 'Submitted'}
              </p>
              <span className="text-xs text-gray-400">{fmt(violation.appeal.createdAt)}</span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{violation.appeal.reason}</p>
            {violation.appeal.outcome && (
              <div className="mt-2 pt-2 border-t border-current border-opacity-20">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Board Decision</p>
                <p className="text-sm text-gray-700">{violation.appeal.outcome}</p>
                {violation.appeal.reviewedBy && violation.appeal.reviewedAt && (
                  <p className="text-xs text-gray-400 mt-1">
                    Reviewed by {violation.appeal.reviewedBy.firstName} {violation.appeal.reviewedBy.lastName} on {fmt(violation.appeal.reviewedAt)}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : canAppeal ? (
          <>
            <p className="text-sm text-gray-500 mb-3">
              If you believe this notice was issued in error or have extenuating circumstances, you may submit a formal appeal. Please provide a clear, detailed explanation.
            </p>
            {!showAppealForm ? (
              <button
                onClick={() => setShowAppealForm(true)}
                className="px-4 py-2 border border-blue-300 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                File an Appeal
              </button>
            ) : (
              <form onSubmit={submitAppeal} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Appeal Reason <span className="text-red-500">*</span></label>
                  <textarea
                    value={appealReason}
                    onChange={(e) => setAppealReason(e.target.value)}
                    rows={5}
                    placeholder="Explain why you believe this notice was issued in error or describe any extenuating circumstances. Be as specific as possible..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">{appealReason.length} characters (minimum 20)</p>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={appealing || appealReason.trim().length < 20}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {appealing ? 'Submitting…' : 'Submit Appeal'}
                  </button>
                  <button type="button" onClick={() => setShowAppealForm(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 focus:outline-none">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">
            {isFinal ? 'This notice is closed and is no longer eligible for appeal.' : 'Appeals are not available for this notice at this time.'}
          </p>
        )}
      </section>
    </div>
  );
}
