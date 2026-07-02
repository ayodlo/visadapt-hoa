'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/session';
import { useToast } from '@/context/toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'EMERGENCY';
  audience: 'ALL_RESIDENTS' | 'BOARD_MEMBERS' | 'SPECIFIC_LOCATION';
  targetLocation: string | null;
  isPinned: boolean;
  publishAt: string;
  expiresAt: string | null;
  createdAt: string;
  createdBy: { firstName: string; lastName: string };
  _count: { reads: number };
}

interface ListData {
  announcements: Announcement[];
  total: number;
  totalPages: number;
  page: number;
}

type FormData = {
  title: string;
  body: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'EMERGENCY';
  audience: 'ALL_RESIDENTS' | 'BOARD_MEMBERS' | 'SPECIFIC_LOCATION';
  targetLocation: string;
  isPinned: boolean;
  publishAt: string;
  expiresAt: string;
};

const EMPTY_FORM: FormData = {
  title: '',
  body: '',
  priority: 'NORMAL',
  audience: 'ALL_RESIDENTS',
  targetLocation: '',
  isPinned: false,
  publishAt: new Date().toISOString().slice(0, 16),
  expiresAt: '',
};

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'IMPORTANT', label: 'Important' },
  { value: 'EMERGENCY', label: 'Emergency' },
];

const AUDIENCE_OPTIONS = [
  { value: '', label: 'All Audiences' },
  { value: 'ALL_RESIDENTS', label: 'All Residents' },
  { value: 'BOARD_MEMBERS', label: 'Board Members' },
  { value: 'SPECIFIC_LOCATION', label: 'Specific Location' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'expired', label: 'Expired' },
  { value: 'pinned', label: 'Pinned' },
];

function priorityBadge(p: string) {
  if (p === 'EMERGENCY') return 'bg-red-100 text-red-800';
  if (p === 'IMPORTANT') return 'bg-amber-100 text-amber-800';
  return 'bg-gray-100 text-gray-600';
}

function audienceLabel(a: string) {
  if (a === 'ALL_RESIDENTS') return 'All Residents';
  if (a === 'BOARD_MEMBERS') return 'Board Only';
  return 'Location';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function announcementStatus(a: Announcement) {
  const now = new Date();
  if (new Date(a.publishAt) > now) return { label: 'Scheduled', cls: 'text-blue-600 bg-blue-50 border-blue-200' };
  if (a.expiresAt && new Date(a.expiresAt) < now) return { label: 'Expired', cls: 'text-gray-500 bg-gray-50 border-gray-200' };
  return { label: 'Active', cls: 'text-green-700 bg-green-50 border-green-200' };
}

// Live preview card
function PreviewCard({ form }: { form: FormData }) {
  const isEmergency = form.priority === 'EMERGENCY';
  const isImportant = form.priority === 'IMPORTANT';

  return (
    <div className={`rounded-xl border overflow-hidden ${isEmergency ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      {isEmergency && <div className="h-1 bg-red-500" />}
      {isImportant && <div className="h-0.5 bg-amber-400" />}
      <div className="p-4">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {form.priority !== 'NORMAL' && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${priorityBadge(form.priority)}`}>
              {form.priority === 'EMERGENCY' ? 'Emergency' : 'Important'}
            </span>
          )}
          {form.isPinned && <span className="text-xs text-gray-500">📌 Pinned</span>}
          {form.audience === 'BOARD_MEMBERS' && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Board Only</span>
          )}
          {form.audience === 'SPECIFIC_LOCATION' && form.targetLocation && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{form.targetLocation}</span>
          )}
        </div>
        <p className="text-sm font-semibold text-gray-900 mb-1">{form.title || <span className="text-gray-400 italic">Announcement title</span>}</p>
        <p className="text-xs text-gray-500 mb-2">Published {form.publishAt ? formatDate(form.publishAt) : 'now'}</p>
        <p className="text-xs text-gray-700 line-clamp-4 whitespace-pre-wrap">{form.body || <span className="text-gray-400 italic">Announcement body...</span>}</p>
      </div>
    </div>
  );
}

// Create / Edit form
function AnnouncementForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormData;
  onSave: (data: FormData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormData>(initial);

  function set<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1';

  return (
    <div className="flex flex-col xl:flex-row gap-6">
      {/* Form fields */}
      <form
        onSubmit={(e) => { e.preventDefault(); onSave(form); }}
        className="flex-1 space-y-4"
      >
        <div>
          <label className={labelCls}>Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Announcement title"
            className={inputCls}
            required
            maxLength={300}
          />
        </div>

        <div>
          <label className={labelCls}>Body</label>
          <textarea
            value={form.body}
            onChange={(e) => set('body', e.target.value)}
            rows={6}
            placeholder="Full announcement text..."
            className={inputCls}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Priority</label>
            <select value={form.priority} onChange={(e) => set('priority', e.target.value as FormData['priority'])} className={inputCls}>
              <option value="NORMAL">Normal</option>
              <option value="IMPORTANT">Important</option>
              <option value="EMERGENCY">Emergency</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Audience</label>
            <select value={form.audience} onChange={(e) => set('audience', e.target.value as FormData['audience'])} className={inputCls}>
              <option value="ALL_RESIDENTS">All Residents</option>
              <option value="BOARD_MEMBERS">Board Members Only</option>
              <option value="SPECIFIC_LOCATION">Specific Location</option>
            </select>
          </div>
        </div>

        {form.audience === 'SPECIFIC_LOCATION' && (
          <div>
            <label className={labelCls}>Target Location</label>
            <input
              type="text"
              value={form.targetLocation}
              onChange={(e) => set('targetLocation', e.target.value)}
              placeholder="e.g. Building A, Unit 3, North Parking"
              className={inputCls}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Publish At</label>
            <input
              type="datetime-local"
              value={form.publishAt}
              onChange={(e) => set('publishAt', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Expires At (optional)</label>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => set('expiresAt', e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isPinned}
            onChange={(e) => set('isPinned', e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-gray-700">Pin to top of feed</span>
        </label>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : initial.title ? 'Save Changes' : 'Publish'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Preview */}
      <div className="xl:w-72 flex-shrink-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Preview</p>
        <PreviewCard form={form} />
      </div>
    </div>
  );
}

export default function AdminAnnouncementsPage() {
  const session = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [data, setData] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [audience, setAudience] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  const fetchList = useCallback(async (q: string, p: string, a: string, s: string, pg: number) => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({ search: q, priority: p, audience: a, status: s, page: String(pg) });
      const res = await fetch(`/api/admin/announcements?${params}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setLoadError('Could not load announcements. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session.role === 'RESIDENT') {
      router.replace('/resident/announcements');
      return;
    }
    fetchList('', '', '', 'all', 1);
  }, [session.role, router, fetchList]);

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchList(val, priority, audience, status, 1), 300);
  }

  function handleFilter(field: 'priority' | 'audience' | 'status', val: string) {
    const next = { priority, audience, status, [field]: val };
    if (field === 'priority') setPriority(val);
    else if (field === 'audience') setAudience(val);
    else setStatus(val);
    setPage(1);
    fetchList(search, next.priority, next.audience, next.status, 1);
  }

  function handlePage(p: number) {
    setPage(p);
    fetchList(search, priority, audience, status, p);
  }

  function openCreate() {
    setEditing(null);
    setMode('create');
  }

  function openEdit(a: Announcement) {
    setEditing(a);
    setMode('edit');
  }

  async function handleSave(form: FormData) {
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        body: form.body,
        priority: form.priority,
        audience: form.audience,
        targetLocation: form.targetLocation || null,
        isPinned: form.isPinned,
        publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : new Date().toISOString(),
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      };

      const isEdit = mode === 'edit' && editing;
      const res = await fetch(
        isEdit ? `/api/admin/announcements/${editing.id}` : '/api/admin/announcements',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      toast(isEdit ? 'Announcement updated.' : 'Announcement published.', 'success');
      setMode('list');
      fetchList(search, priority, audience, status, page);
    } catch (ex) {
      toast(ex instanceof Error ? ex.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/admin/announcements/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast('Announcement deleted.', 'success');
      setDeleteTarget(null);
      fetchList(search, priority, audience, status, page);
    } catch (ex) {
      toast(ex instanceof Error ? ex.message : 'Delete failed', 'error');
    }
  }

  if (mode !== 'list') {
    const initial: FormData = editing
      ? {
          title: editing.title,
          body: editing.body,
          priority: editing.priority,
          audience: editing.audience,
          targetLocation: editing.targetLocation ?? '',
          isPinned: editing.isPinned,
          publishAt: editing.publishAt ? new Date(editing.publishAt).toISOString().slice(0, 16) : '',
          expiresAt: editing.expiresAt ? new Date(editing.expiresAt).toISOString().slice(0, 16) : '',
        }
      : EMPTY_FORM;

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader
          title={mode === 'edit' ? 'Edit Announcement' : 'New Announcement'}
          subtitle={mode === 'edit' ? `Editing: ${editing?.title}` : 'Create a new community announcement'}
        />
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <AnnouncementForm
            initial={initial}
            onSave={handleSave}
            onCancel={() => setMode('list')}
            saving={saving}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Announcements"
        subtitle="Manage community announcements and notices"
        action={
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            + New Announcement
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        <div className="flex-1 min-w-44">
          <SearchInput value={search} onChange={handleSearch} placeholder="Search announcements..." />
        </div>
        <FilterSelect value={status} onChange={(v) => handleFilter('status', v)} options={STATUS_OPTIONS} />
        <FilterSelect value={priority} onChange={(v) => handleFilter('priority', v)} options={PRIORITY_OPTIONS} />
        <FilterSelect value={audience} onChange={(v) => handleFilter('audience', v)} options={AUDIENCE_OPTIONS} />
      </div>

      {data && (
        <p className="text-xs text-gray-500">{data.total} announcement{data.total !== 1 ? 's' : ''}</p>
      )}

      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => fetchList(search, priority, audience, status, page)} />
      ) : !data || data.announcements.length === 0 ? (
        <EmptyState
          title="No announcements found"
          description="Try adjusting filters or create a new announcement."
          action={
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              + New Announcement
            </button>
          }
        />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {data.announcements.map((a) => {
              const st = announcementStatus(a);
              return (
                <div key={a.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityBadge(a.priority)}`}>
                        {a.priority === 'NORMAL' ? 'Normal' : a.priority === 'IMPORTANT' ? 'Important' : 'Emergency'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${st.cls}`}>{st.label}</span>
                      {a.isPinned && <span className="text-xs text-gray-400">📌</span>}
                      <span className="text-xs text-gray-400">{audienceLabel(a.audience)}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate">{a.title}</p>
                    <div className="text-xs text-gray-400 mt-0.5 flex gap-3">
                      <span>By {a.createdBy.firstName} {a.createdBy.lastName}</span>
                      <span>{formatDate(a.publishAt)}</span>
                      <span>{a._count.reads} read{a._count.reads !== 1 ? 's' : ''}</span>
                      {a.expiresAt && <span>Expires {formatDate(a.expiresAt)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEdit(a)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(a)}
                      className="text-xs text-gray-400 hover:text-red-500 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {data.totalPages > 1 && (
            <Pagination page={page} totalPages={data.totalPages} onPageChange={handlePage} />
          )}
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete announcement?"
        description={`"${deleteTarget?.title}" will be permanently removed and all residents will lose access to it.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
