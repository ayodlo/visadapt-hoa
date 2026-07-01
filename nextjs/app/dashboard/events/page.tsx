'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/context/session';

interface Creator { id: string; firstName: string; lastName: string; }
interface Event { id: string; title: string; description?: string; location?: string; startAt: string; endAt?: string; createdBy: Creator; }

export default function EventsPage() {
  const { role } = useSession();
  const isAdmin = role === 'ADMIN' || role === 'BOARD_MEMBER';

  const [items, setItems] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', location: '', startAt: '', endAt: '' });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await fetch('/api/events');
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload: Record<string, string> = { title: form.title, startAt: new Date(form.startAt).toISOString() };
    if (form.description) payload.description = form.description;
    if (form.location) payload.location = form.location;
    if (form.endAt) payload.endAt = new Date(form.endAt).toISOString();

    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) { setForm({ title: '', description: '', location: '', startAt: '', endAt: '' }); setShowForm(false); load(); }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this event?')) return;
    await fetch(`/api/events/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">+ New</button>
        )}
      </div>

      {isAdmin && showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-3">
          <input required placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input placeholder="Location" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <textarea placeholder="Description" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-gray-500 mb-1">Start</label><input required type="datetime-local" value={form.startAt} onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">End (optional)</label><input type="datetime-local" value={form.endAt} onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">{submitting ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <p className="text-gray-500 text-sm">Loading…</p> : items.length === 0 ? <p className="text-gray-500 text-sm">No events yet.</p> : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {new Date(item.startAt).toLocaleString()}{item.endAt ? ` – ${new Date(item.endAt).toLocaleString()}` : ''}
                    {item.location ? ` · ${item.location}` : ''}
                  </p>
                </div>
                {isAdmin && (
                  <button onClick={() => handleDelete(item.id)} className="text-xs text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">Delete</button>
                )}
              </div>
              {item.description && <p className="mt-3 text-sm text-gray-700">{item.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
