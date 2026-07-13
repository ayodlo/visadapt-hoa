'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/context/session';
import { isAdmin as isAdminRole } from '@/lib/roles';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'BOARD_MEMBER' | 'RESIDENT';
// Roles assignable through this UI. SUPER_ADMIN is engineer-only — see prisma/create-super-admin.ts.
const ASSIGNABLE_ROLES: Role[] = ['ADMIN', 'BOARD_MEMBER', 'RESIDENT'];
interface User { id: string; firstName: string; lastName: string; email: string; role: Role; createdAt: string; }

const ROLE_COLORS: Record<Role, string> = {
  SUPER_ADMIN: 'bg-fuchsia-100 text-fuchsia-800',
  ADMIN: 'bg-purple-100 text-purple-800',
  BOARD_MEMBER: 'bg-blue-100 text-blue-800',
  RESIDENT: 'bg-gray-100 text-gray-600',
};

const EMPTY_FORM = { firstName: '', lastName: '', email: '', password: '', role: 'RESIDENT' as Role };

export default function UsersPage() {
  const session = useSession();
  const isAdmin = isAdminRole(session.role);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  async function load() {
    const res = await fetch('/api/users');
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateRole(id: string, role: Role) {
    await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    load();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    await fetch(`/api/users/${id}`, { method: 'DELETE' });
    load();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } else {
      const data = await res.json().catch(() => null);
      setFormError(data?.error ?? 'Could not create user.');
    }
    setSubmitting(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} member{users.length !== 1 ? 's' : ''}</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">+ Add User</button>
        )}
      </div>

      {isAdmin && showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-3">
          {formError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</div>}
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="First name" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input required placeholder="Last name" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <input required type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input required type="password" minLength={8} placeholder="Temporary password (min 8 characters)" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
          </select>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">{submitting ? 'Creating…' : 'Create User'}</button>
            <button type="button" onClick={() => { setShowForm(false); setFormError(''); }} className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <p className="text-gray-500 text-sm">Loading…</p> : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Name', 'Email', 'Role', 'Joined', ''].map((h) => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => {
                // SUPER_ADMIN accounts are engineer-managed only — never editable from this screen.
                const locked = user.role === 'SUPER_ADMIN';
                return (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{user.firstName} {user.lastName}</td>
                  <td className="px-4 py-3 text-gray-600">{user.email}</td>
                  <td className="px-4 py-3">
                    {isAdmin && !locked ? (
                      <select value={user.role} onChange={(e) => updateRole(user.id, e.target.value as Role)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${ROLE_COLORS[user.role]}`}>
                        {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                      </select>
                    ) : (
                      <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${ROLE_COLORS[user.role]}`}>{user.role.replace('_', ' ')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    {isAdmin && !locked && (
                      <button onClick={() => handleDelete(user.id, `${user.firstName} ${user.lastName}`)} className="text-xs text-gray-400 hover:text-red-500">Delete</button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
