'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/session';
import { useToast } from '@/context/toast';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  ISSUE_CATEGORIES,
  ISSUE_PRIORITIES,
  CONTACT_METHODS,
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
  assignedTo: { firstName: string; lastName: string } | null;
  vendor: { name: string } | null;
  _count: { comments: number };
}

function daysAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function SubmitForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    category: 'MAINTENANCE',
    title: '',
    description: '',
    location: '',
    priority: 'MEDIUM',
    preferredContactMethod: 'Email',
  });

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to submit');
      toast('Issue submitted successfully.', 'success');
      onSuccess();
    } catch (ex) {
      toast(ex instanceof Error ? ex.message : 'Submission failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';
  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Category</label>
          <select value={form.category} onChange={(e) => set('category', e.target.value)} className={inputCls} required>
            {ISSUE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Priority</label>
          <select value={form.priority} onChange={(e) => set('priority', e.target.value)} className={inputCls} required>
            {ISSUE_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Title</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="Brief summary of the issue"
          className={inputCls}
          required
          minLength={5}
          maxLength={200}
        />
      </div>
      <div>
        <label className={labelCls}>Location</label>
        <input
          type="text"
          value={form.location}
          onChange={(e) => set('location', e.target.value)}
          placeholder="e.g. Building B, 2nd floor hallway"
          className={inputCls}
          required
        />
      </div>
      <div>
        <label className={labelCls}>Description</label>
        <textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          rows={4}
          placeholder="Describe the issue in detail — when it started, how often it occurs, any safety concerns..."
          className={inputCls}
          required
          minLength={10}
        />
      </div>
      <div>
        <label className={labelCls}>Preferred Contact Method</label>
        <select value={form.preferredContactMethod} onChange={(e) => set('preferredContactMethod', e.target.value)} className={inputCls}>
          {CONTACT_METHODS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>
      <div className="p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300">
        <p className="text-xs text-gray-500">Photo attachment — available in a future update</p>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit Issue'}
      </button>
    </form>
  );
}

export default function ResidentIssuesPage() {
  const session = useSession();
  const router = useRouter();

  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);

  async function loadIssues() {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/issues/me');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setIssues(json.issues);
    } catch {
      setLoadError('Could not load your issues. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session.role !== 'RESIDENT') {
      router.replace('/admin/issues');
      return;
    }
    loadIssues();
  }, [session.role, router]);

  function handleFormSuccess() {
    setShowForm(false);
    loadIssues();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="My Issues"
        subtitle="Report and track community issues you have submitted"
        action={
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {showForm ? 'Cancel' : 'Report an Issue'}
          </button>
        }
      />

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Report a New Issue</h2>
          <SubmitForm onSuccess={handleFormSuccess} />
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={loadIssues} />
      ) : issues.length === 0 ? (
        <EmptyState
          title="No issues reported"
          description="Use the button above to report a problem in the community."
          action={
            !showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Report an Issue
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {issues.map((issue) => (
            <Link
              key={issue.id}
              href={`/resident/issues/${issue.id}`}
              className="block bg-white rounded-xl border border-gray-200 px-4 py-4 hover:border-blue-300 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {categoryLabel(issue.category)}
                    </span>
                    <StatusBadge status={issue.status} />
                    <StatusBadge status={issue.priority} />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate">{issue.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{issue.location}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>Submitted {daysAgo(issue.createdAt)}</span>
                    {issue._count.comments > 0 && <span>{issue._count.comments} comment{issue._count.comments !== 1 ? 's' : ''}</span>}
                    {issue.assignedTo && <span>Assigned to {issue.assignedTo.firstName} {issue.assignedTo.lastName}</span>}
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
      )}
    </div>
  );
}
