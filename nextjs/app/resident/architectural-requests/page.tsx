'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/context/toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { REQUEST_TYPES, requestTypeLabel, requestStatusLabel } from '@/lib/architectural-requests';

interface ArchRequest {
  id: string;
  requestType: string;
  description: string;
  status: string;
  desiredStartDate: string | null;
  createdAt: string;
  property: { streetAddress: string; unitNumber: string | null } | null;
  _count: { comments: number };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type FormData = {
  requestType: string;
  description: string;
  desiredStartDate: string;
};

function SubmitForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormData>({ requestType: '', description: '', desiredStartDate: '' });
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function save(submitNow: boolean) {
    if (!form.requestType) { toast('Please select a request type.', 'error'); return; }
    if (form.description.length < 20) { toast('Description must be at least 20 characters.', 'error'); return; }

    const setter = submitNow ? setSubmitting : setSaving;
    setter(true);
    try {
      const res = await fetch('/api/architectural-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: form.requestType,
          description: form.description,
          desiredStartDate: form.desiredStartDate ? new Date(form.desiredStartDate).toISOString() : null,
          submitNow,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to save request');
      toast(submitNow ? 'Request submitted for review.' : 'Draft saved.', 'success');
      onSuccess();
    } catch (ex) {
      toast(ex instanceof Error ? ex.message : 'Failed to save', 'error');
    } finally {
      setter(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h2 className="text-base font-semibold text-gray-900">New Architectural Request</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Request Type <span className="text-red-500">*</span></label>
          <select
            value={form.requestType}
            onChange={(e) => setForm((f) => ({ ...f, requestType: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select type…</option>
            {REQUEST_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Desired Start Date</label>
          <input
            type="date"
            value={form.desiredStartDate}
            onChange={(e) => setForm((f) => ({ ...f, desiredStartDate: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Project Description <span className="text-red-500">*</span>
        </label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={5}
          placeholder="Describe the work you plan to do. Include materials, dimensions, colors, contractor information, and how the project complies with community standards..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">{form.description.length} characters (minimum 20)</p>
      </div>

      {/* Attachment placeholders */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Supporting Documents</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {['Site Plan / Plot Diagram', 'Elevation Drawing or Photo', 'Material / Color Samples', 'Contractor Quote or Bid'].map((label) => (
            <div key={label} className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-2.5 bg-gray-50">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="text-xs text-gray-500">{label} <span className="text-gray-400">(upload coming soon)</span></span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button
          onClick={() => save(false)}
          disabled={saving || submitting}
          className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save as Draft'}
        </button>
        <button
          onClick={() => save(true)}
          disabled={saving || submitting}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit for Review'}
        </button>
      </div>
    </div>
  );
}

export default function ResidentArchRequestsPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<ArchRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/architectural-requests/me');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setRequests(json.requests);
    } catch {
      setLoadError('Could not load your requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleFormSuccess() {
    setShowForm(false);
    load();
  }

  void toast;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Architectural Requests"
        subtitle="Submit and track exterior modification requests"
        action={
          !showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              + New Request
            </button>
          ) : (
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
          )
        }
      />

      {showForm && <SubmitForm onSuccess={handleFormSuccess} />}

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">Before you start</p>
        <p>All exterior modifications require board approval before work begins. Review the <span className="font-medium">CC&Rs and Architectural Guidelines</span> in the Documents section. Allow up to 30 days for a decision.</p>
      </div>

      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : requests.length === 0 ? (
        <EmptyState
          title="No requests yet"
          description="Submit an architectural request to get started."
        />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Link
              key={r.id}
              href={`/resident/architectural-requests/${r.id}`}
              className="block bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                        {requestTypeLabel(r.requestType)}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate">{requestTypeLabel(r.requestType)} Request</p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>Submitted {formatDate(r.createdAt)}</span>
                      {r.desiredStartDate && <span>Start by {formatDate(r.desiredStartDate)}</span>}
                      {r._count.comments > 0 && (
                        <span>{r._count.comments} comment{r._count.comments > 1 ? 's' : ''}</span>
                      )}
                    </div>
                    {r.status === 'NEEDS_MORE_INFORMATION' && (
                      <p className="mt-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md inline-block">
                        Action needed — reviewer has requested more information
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center pb-4">
        Request status: {requestStatusLabel('DRAFT')} → {requestStatusLabel('SUBMITTED')} → {requestStatusLabel('UNDER_REVIEW')} → Decision
      </p>
    </div>
  );
}
