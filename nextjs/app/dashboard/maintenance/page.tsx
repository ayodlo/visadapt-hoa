'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/context/session';
import { useToast } from '@/context/toast';
import { isStaff } from '@/lib/roles';
import { useListControls } from '@/hooks/useListControls';
import { ListToolbar } from '@/components/ui/ListToolbar';
import { MaintenanceRequestForm } from '@/components/maintenance/MaintenanceRequestForm';
import type { ListField } from '@/lib/list-controls';

type Status = 'SUBMITTED' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
interface Submitter { id: string; firstName: string; lastName: string; }
interface Request {
  id: string; title: string; description: string; status: Status; priority: Priority;
  submittedBy: Submitter; createdAt: string;
  requestNumber: string | null;
  _count?: { attachments: number };
}

const FIELDS: ListField<Request>[] = [
  { key: 'requestNumber', label: 'Request #', value: (r) => r.requestNumber ?? '' },
  { key: 'title', label: 'Title', value: (r) => r.title },
  { key: 'description', label: 'Description', value: (r) => r.description, sortable: false },
  { key: 'status', label: 'Status', value: (r) => r.status, text: (r) => r.status.replace('_', ' '), filterable: true },
  { key: 'priority', label: 'Priority', value: (r) => r.priority, filterable: true },
  { key: 'submittedBy', label: 'Submitted by', value: (r) => `${r.submittedBy.firstName} ${r.submittedBy.lastName}`, filterable: true },
  { key: 'createdAt', label: 'Created', type: 'date', value: (r) => r.createdAt, text: (r) => new Date(r.createdAt).toLocaleDateString() },
];

const STATUS_COLORS: Record<Status, string> = {
  SUBMITTED: 'bg-indigo-100 text-indigo-800',
  OPEN: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
};

const PRIORITY_COLORS: Record<Priority, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};

export default function MaintenancePage() {
  const session = useSession();
  const isAdmin = isStaff(session.role);
  const { toast } = useToast();

  const [items, setItems] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM' });
  const [submitting, setSubmitting] = useState(false);
  const controls = useListControls(items, FIELDS);
  const [properties, setProperties] = useState<{ id: string; streetAddress: string; unitNumber: string | null }[]>([]);

  useEffect(() => {
    if (isAdmin) return;
    fetch(`/api/properties?userId=${session.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setProperties(Array.isArray(data) ? data : []))
      .catch(() => setProperties([]));
  }, [isAdmin, session.id]);

  async function load() {
    const res = await fetch('/api/maintenance');
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch('/api/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) { setForm({ title: '', description: '', priority: 'MEDIUM' }); setShowForm(false); load(); }
    setSubmitting(false);
  }

  async function updateStatus(id: string, status: Status) {
    const res = await fetch(`/api/maintenance/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast(body?.error ?? 'Could not update the status.', 'error');
    }
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this request?')) return;
    await fetch(`/api/maintenance/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Maintenance Requests</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">+ New Request</button>
      </div>

      {showForm && (
        isAdmin ? (
          <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-3">
            <input required placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <textarea required placeholder="Description" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p}>{p}</option>)}
            </select>
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">{submitting ? 'Submitting…' : 'Submit'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        ) : (
          <div className="mb-6">
            {/*
              Refresh the list but leave the form mounted: it renders its own
              success screen with the request number, which closing it here
              would destroy before the resident could read it.
            */}
            <MaintenanceRequestForm properties={properties} onSubmitted={load} />
          </div>
        )
      )}

      {loading ? <p className="text-gray-500 text-sm">Loading…</p> : items.length === 0 ? <p className="text-gray-500 text-sm">No requests yet.</p> : (
        <>
        <ListToolbar controls={controls} searchPlaceholder="Search title, description, submitter…" showSort noun="request" />
        {controls.visible.length === 0 ? (
          <p className="text-gray-500 text-sm">No requests match your search.</p>
        ) : (
        <div className="space-y-4">
          {controls.visible.map((item) => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-gray-900">
                      <Link
                        href={`/dashboard/maintenance/${item.id}`}
                        className="hover:text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                      >
                        {item.title}
                      </Link>
                    </h3>
                    {item.requestNumber && (
                      <span className="text-xs font-mono text-gray-500">{item.requestNumber}</span>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[item.status]}`}>{item.status.replace('_', ' ')}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLORS[item.priority]}`}>{item.priority}</span>
                  </div>
                  <p className="text-sm text-gray-500">{item.submittedBy.firstName} {item.submittedBy.lastName} · {new Date(item.createdAt).toLocaleDateString()}</p>
                  <p className="mt-2 text-sm text-gray-700 line-clamp-2">{item.description}</p>
                  <Link
                    href={`/dashboard/maintenance/${item.id}`}
                    className="inline-block mt-2 text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                  >
                    View details{item._count?.attachments ? ` · ${item._count.attachments} file${item._count.attachments === 1 ? '' : 's'}` : ''}
                  </Link>
                </div>
                {isAdmin && (
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <select value={item.status} onChange={(e) => updateStatus(item.id, e.target.value as Status)} className="text-xs border border-gray-300 rounded px-2 py-1">
                      {(['SUBMITTED', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as Status[]).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                    <button onClick={() => handleDelete(item.id)} className="text-xs text-gray-400 hover:text-red-500 transition-colors text-right">Delete</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        )}
        </>
      )}
    </div>
  );
}
