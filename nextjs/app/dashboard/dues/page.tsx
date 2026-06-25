'use client';

import { useEffect, useState } from 'react';

type DuesStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED';
interface User { id: string; firstName: string; lastName: string; email: string; }
interface DuesRecord { id: string; label: string; amountCents: number; dueDate: string; status: DuesStatus; paidAt?: string; notes?: string; user: User; }

const STATUS_COLORS: Record<DuesStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800',
  WAIVED: 'bg-gray-100 text-gray-600',
};

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function DuesPage() {
  const [records, setRecords] = useState<DuesRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ userId: '', label: '', amountCents: '', dueDate: '' });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const [duesRes, usersRes] = await Promise.all([fetch('/api/dues'), fetch('/api/users')]);
    if (duesRes.ok) setRecords(await duesRes.json());
    if (usersRes.ok) setUsers(await usersRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch('/api/dues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: form.userId,
        label: form.label,
        amountCents: Math.round(parseFloat(form.amountCents) * 100),
        dueDate: new Date(form.dueDate).toISOString(),
      }),
    });
    if (res.ok) { setForm({ userId: '', label: '', amountCents: '', dueDate: '' }); setShowForm(false); load(); }
    setSubmitting(false);
  }

  async function updateStatus(id: string, status: DuesStatus) {
    await fetch(`/api/dues/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this record?')) return;
    await fetch(`/api/dues/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dues</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">+ New Record</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-3">
          <select required value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select resident…</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>)}
          </select>
          <input required placeholder="Label (e.g. Q1 2026 HOA Dues)" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="grid grid-cols-2 gap-3">
            <input required type="number" step="0.01" min="0" placeholder="Amount ($)" value={form.amountCents} onChange={(e) => setForm((f) => ({ ...f, amountCents: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input required type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">{submitting ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <p className="text-gray-500 text-sm">Loading…</p> : records.length === 0 ? <p className="text-gray-500 text-sm">No dues records yet.</p> : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Resident', 'Label', 'Amount', 'Due Date', 'Status', ''].map((h) => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.user.firstName} {r.user.lastName}</td>
                  <td className="px-4 py-3 text-gray-600">{r.label}</td>
                  <td className="px-4 py-3 font-medium">{fmt(r.amountCents)}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(r.dueDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <select value={r.status} onChange={(e) => updateStatus(r.id, e.target.value as DuesStatus)} className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLORS[r.status]}`}>
                      {(['PENDING', 'PAID', 'OVERDUE', 'WAIVED'] as DuesStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right"><button onClick={() => handleDelete(r.id)} className="text-xs text-gray-400 hover:text-red-500">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
