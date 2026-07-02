'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/context/toast';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { categoryLabel } from '@/lib/issues';

interface Actor { firstName: string; lastName: string; role: string }

interface Comment {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  author: Actor;
}

interface Activity {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  actor: Actor | null;
}

interface Issue {
  id: string;
  category: string;
  title: string;
  description: string;
  location: string;
  priority: string;
  status: string;
  preferredContactMethod: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  resident: { firstName: string; lastName: string };
  assignedTo: { firstName: string; lastName: string } | null;
  vendor: { name: string; contactName: string | null; phone: string | null } | null;
  comments: Comment[];
  activities: Activity[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function actionLabel(action: string) {
  switch (action) {
    case 'created': return 'Issue submitted';
    case 'status_changed': return 'Status updated';
    case 'assigned': return 'Issue assigned';
    case 'unassigned': return 'Assignment removed';
    case 'vendor_assigned': return 'Vendor assigned';
    case 'vendor_removed': return 'Vendor removed';
    case 'due_date_set': return 'Due date updated';
    case 'comment_added': return 'Comment added';
    default: return action.replace(/_/g, ' ');
  }
}

export default function ResidentIssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);

  const loadIssue = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/issues/${id}`);
      if (res.status === 403) throw new Error('You do not have access to this issue.');
      if (!res.ok) throw new Error('Failed to load issue.');
      const json = await res.json();
      setIssue(json.issue);
    } catch (ex) {
      setLoadError(ex instanceof Error ? ex.message : 'Could not load issue.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadIssue(); }, [loadIssue]);

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/issues/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: comment }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to post comment');
      setComment('');
      await loadIssue();
      toast('Comment posted.', 'success');
    } catch (ex) {
      toast(ex instanceof Error ? ex.message : 'Failed to post comment', 'error');
    } finally {
      setPosting(false);
    }
  }

  if (loading) return <LoadingState />;
  if (loadError) return <ErrorState message={loadError} onRetry={loadIssue} />;
  if (!issue) return null;

  const publicComments = issue.comments.filter((c) => !c.isInternal);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/resident/issues" className="hover:text-blue-600 transition-colors">My Issues</Link>
        <span aria-hidden="true">›</span>
        <span className="text-gray-800 truncate">{issue.title}</span>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {categoryLabel(issue.category)}
            </span>
            <StatusBadge status={issue.status} />
            <StatusBadge status={issue.priority} />
          </div>
          <span className="text-xs text-gray-400">#{issue.id.slice(-8).toUpperCase()}</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">{issue.title}</h1>
        <p className="text-sm text-gray-500 mb-4">Location: {issue.location}</p>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{issue.description}</p>
      </div>

      {/* Details sidebar */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Status</p>
          <StatusBadge status={issue.status} />
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Priority</p>
          <StatusBadge status={issue.priority} />
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Submitted</p>
          <p className="text-gray-900">{formatDateShort(issue.createdAt)}</p>
        </div>
        {issue.dueDate && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Expected By</p>
            <p className="text-gray-900">{formatDateShort(issue.dueDate)}</p>
          </div>
        )}
        {issue.assignedTo && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Assigned To</p>
            <p className="text-gray-900">{issue.assignedTo.firstName} {issue.assignedTo.lastName}</p>
          </div>
        )}
        {issue.vendor && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Vendor</p>
            <p className="text-gray-900">{issue.vendor.name}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Contact Preference</p>
          <p className="text-gray-900">{issue.preferredContactMethod}</p>
        </div>
      </div>

      {/* Activity timeline */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Status Timeline</h2>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {issue.activities.map((act) => (
            <div key={act.id} className="flex gap-3 px-4 py-3">
              <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-400 flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{actionLabel(act.action)}</p>
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
          Updates & Comments {publicComments.length > 0 && <span className="text-gray-400 font-normal">({publicComments.length})</span>}
        </h2>
        {publicComments.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 mb-4">
            {publicComments.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900">
                    {c.author.firstName} {c.author.lastName}
                  </span>
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

        {/* Add comment — only if issue is not closed */}
        {issue.status !== 'CLOSED' && (
          <form onSubmit={postComment} className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Add a comment</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Provide additional details or ask a question..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            />
            <button
              type="submit"
              disabled={posting || !comment.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {posting ? 'Posting...' : 'Post Comment'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
