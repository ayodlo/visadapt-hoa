'use client';

import { useEffect, useState } from 'react';

interface Author { id: string; firstName: string; lastName: string; }
interface Announcement { id: string; title: string; body: string; author: Author; createdAt: string; }

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '' });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await fetch('/api/announcements');
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ title: '', body: '' });
      setShowForm(false);
      load();
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this announcement?')) return;
    await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          + New
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-3">
          <input required placeholder="Title" value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <textarea required placeholder="Body" rows={4} value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="flex gap-2">
            <button type="submit" disabled={submitting}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Posting…' : 'Post'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500 text-sm">No announcements yet.</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {item.author.firstName} {item.author.lastName} · {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => handleDelete(item.id)}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">Delete</button>
              </div>
              <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">{item.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
