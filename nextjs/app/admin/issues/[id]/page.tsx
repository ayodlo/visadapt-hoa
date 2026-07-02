'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/context/toast';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  ISSUE_STATUSES,
  ISSUE_PRIORITIES,
  categoryLabel,
} from '@/lib/issues';

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
  resident: { id: string; firstName: string; lastName: string; email: string };
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  vendor: { id: string; name: string; contactName: string | null; phone: string | null } | null;
  comments: Comment[];
  activities: Activity[];
}

interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface Vendor {
  id: string;
  name: string;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysOld(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  return `${days} day${days !== 1 ? 's' : ''} old`;
}

function actionLabel(action: string) {
  switch (action) {
    case 'created': return 'Issue submitted';
    case 'status_changed': return 'Status updated';
    case 'assigned': return 'Assigned';
    case 'unassigned': return 'Assignment removed';
    case 'vendor_assigned': return 'Vendor assigned';
    case 'vendor_removed': return 'Vendor removed';
    case 'due_date_set': return 'Due date updated';
    case 'comment_added': return 'Comment added';
    default: return action.replace(/_/g, ' ');
  }
}

export default function AdminIssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  // Edit panel state
  const [editStatus, setEditStatus] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [editVendor, setEditVendor] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Comment state
  const [commentBody, setCommentBody] = useState('');
  const [commentInternal, setCommentInternal] = useState(false);
  const [posting, setPosting] = useState(false);

  async function loadVendors() {
    try {
      const res = await fetch('/api/admin/vendors');
      if (!res.ok) return;
      const json = await res.json();
      setVendors(json.vendors ?? []);
    } catch {
      // Vendors not critical — just don't show the dropdown
    }
  }

  const loadIssue = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/issues/${id}`);
      if (!res.ok) throw new Error('Failed to load issue.');
      const json = await res.json();
      const iss: Issue = json.issue;
      setIssue(iss);
      setEditStatus(iss.status);
      setEditPriority(iss.priority);
      setEditAssignedTo(iss.assignedTo?.id ?? '');
      setEditVendor(iss.vendor?.id ?? '');
      setEditDueDate(iss.dueDate ? iss.dueDate.split('T')[0] : '');
    } catch (ex) {
      setLoadError(ex instanceof Error ? ex.message : 'Could not load issue.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadIssue();
    // Load admins for assignment dropdown (flat array from /api/users)
    fetch('/api/users')
      .then((r) => r.json())
      .then((users: AdminUser[]) => {
        setAdmins(users.filter((u) => u.role === 'ADMIN' || u.role === 'BOARD_MEMBER'));
      })
      .catch(() => {});
    loadVendors();
  }, [loadIssue]);

  async function handleSave() {
    if (!issue) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (editStatus !== issue.status) body.status = editStatus;
      if (editPriority !== issue.priority) body.priority = editPriority;
      if (editAssignedTo !== (issue.assignedTo?.id ?? '')) body.assignedToId = editAssignedTo || null;
      if (editVendor !== (issue.vendor?.id ?? '')) body.vendorId = editVendor || null;
      const newDue = editDueDate ? new Date(editDueDate + 'T12:00:00Z').toISOString() : null;
      const oldDue = issue.dueDate ? issue.dueDate.split('T')[0] : '';
      if (editDueDate !== oldDue) body.dueDate = newDue;

      if (Object.keys(body).length === 0) {
        toast('No changes to save.', 'info');
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/admin/issues/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to save');
      toast('Issue updated.', 'success');
      await loadIssue();
    } catch (ex) {
      toast(ex instanceof Error ? ex.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handlePostComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/admin/issues/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentBody, isInternal: commentInternal }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to post comment');
      setCommentBody('');
      await loadIssue();
      toast(commentInternal ? 'Internal note added.' : 'Comment posted.', 'success');
    } catch (ex) {
      toast(ex instanceof Error ? ex.message : 'Failed to post comment', 'error');
    } finally {
      setPosting(false);
    }
  }

  if (loading) return <LoadingState />;
  if (loadError) return <ErrorState message={loadError} onRetry={loadIssue} />;
  if (!issue) return null;

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/issues" className="hover:text-blue-600 transition-colors">Issues</Link>
        <span aria-hidden="true">›</span>
        <span className="text-gray-800 truncate">{issue.title}</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left — issue details, timeline, comments */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Header */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {categoryLabel(issue.category)}
                </span>
                <StatusBadge status={issue.status} />
                <StatusBadge status={issue.priority} />
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">#{issue.id.slice(-8).toUpperCase()}</p>
                <p className="text-xs text-gray-400">{daysOld(issue.createdAt)}</p>
              </div>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">{issue.title}</h1>
            <p className="text-sm text-gray-500 mb-1">Location: {issue.location}</p>
            <p className="text-sm text-gray-500 mb-4">
              Submitted by {issue.resident.firstName} {issue.resident.lastName} ({issue.resident.email}) on {formatDateShort(issue.createdAt)}
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{issue.description}</p>
            <p className="text-xs text-gray-400 mt-3">Preferred contact: {issue.preferredContactMethod}</p>
          </div>

          {/* Timeline */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Activity History</h2>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {issue.activities.map((act) => (
                <div key={act.id} className="flex gap-3 px-4 py-3">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-400 flex-shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{actionLabel(act.action)}</p>
                    {act.details && <p className="text-sm text-gray-600 mt-0.5">{act.details}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      {act.actor ? `${act.actor.firstName} ${act.actor.lastName}` : 'System'} — {formatDateTime(act.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Comments */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Comments</h2>
            {issue.comments.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 mb-4">
                {issue.comments.map((c) => (
                  <div key={c.id} className={`px-4 py-3 ${c.isInternal ? 'bg-amber-50' : ''}`}>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {c.author.firstName} {c.author.lastName}
                      </span>
                      {c.author.role !== 'RESIDENT' && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Staff</span>
                      )}
                      {c.isInternal && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Internal Note</span>
                      )}
                      <span className="text-xs text-gray-400">{formatDateTime(c.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handlePostComment} className="bg-white rounded-xl border border-gray-200 p-4">
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                rows={3}
                placeholder={commentInternal ? 'Internal note visible to staff only...' : 'Write a comment visible to the resident...'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commentInternal}
                    onChange={(e) => setCommentInternal(e.target.checked)}
                    className="rounded"
                  />
                  Internal note only
                </label>
                <button
                  type="submit"
                  disabled={posting || !commentBody.trim()}
                  className="ml-auto px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {posting ? 'Posting...' : commentInternal ? 'Add Note' : 'Post Comment'}
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Right — management panel */}
        <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Manage Issue</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Status</label>
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className={inputCls}>
                  {ISSUE_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Priority</label>
                <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)} className={inputCls}>
                  {ISSUE_PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Assigned To</label>
                <select value={editAssignedTo} onChange={(e) => setEditAssignedTo(e.target.value)} className={inputCls}>
                  <option value="">Unassigned</option>
                  {admins.map((a) => (
                    <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                  ))}
                </select>
              </div>
              {vendors.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Vendor</label>
                  <select value={editVendor} onChange={(e) => setEditVendor(e.target.value)} className={inputCls}>
                    <option value="">No Vendor</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Due Date</label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            {/* Current summary */}
            <div className="mt-5 pt-5 border-t border-gray-100 space-y-2 text-sm">
              {issue.dueDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Due</span>
                  <span className="text-gray-900">{formatDateShort(issue.dueDate)}</span>
                </div>
              )}
              {issue.vendor && (
                <div>
                  <p className="text-gray-500 mb-0.5">Vendor</p>
                  <p className="text-gray-900 font-medium">{issue.vendor.name}</p>
                  {issue.vendor.contactName && <p className="text-gray-500 text-xs">{issue.vendor.contactName}</p>}
                  {issue.vendor.phone && <p className="text-gray-500 text-xs">{issue.vendor.phone}</p>}
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Last Updated</span>
                <span className="text-gray-900 text-xs">{formatDateShort(issue.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
