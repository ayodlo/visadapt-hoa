'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/context/toast';
import { useListControls } from '@/hooks/useListControls';
import { ListToolbar } from '@/components/ui/ListToolbar';
import { SortableTh } from '@/components/ui/SortableTh';
import type { ListField } from '@/lib/list-controls';

interface Community {
  id: string;
  name: string;
  createdAt: string;
  _count: { users: number; communityAssignments: number; properties: number };
}

const FIELDS: ListField<Community>[] = [
  { key: 'name', label: 'Name', value: (c) => c.name },
  { key: 'users', label: 'Users', type: 'number', value: (c) => c._count.users },
  { key: 'assignments', label: 'Staff Assignments', type: 'number', value: (c) => c._count.communityAssignments },
  { key: 'properties', label: 'Properties', type: 'number', value: (c) => c._count.properties },
  { key: 'createdAt', label: 'Created', type: 'date', value: (c) => c.createdAt, text: (c) => new Date(c.createdAt).toLocaleDateString() },
];

export default function CommunitiesPage() {
  const { toast } = useToast();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const controls = useListControls(communities, FIELDS);

  async function load() {
    const res = await fetch('/api/admin/communities');
    if (res.ok) setCommunities(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');
    const res = await fetch('/api/admin/communities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setName('');
      setShowForm(false);
      toast('Community created', 'success');
      load();
    } else {
      const data = await res.json().catch(() => null);
      setFormError(data?.error ?? 'Could not create community.');
    }
    setSubmitting(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Communities</h1>
          <p className="text-sm text-gray-500 mt-1">{communities.length} communit{communities.length === 1 ? 'y' : 'ies'}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          + Add Community
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-3">
          {formError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</div>}
          <input
            required
            placeholder="Community name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Creating…' : 'Create Community'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setFormError(''); }} className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? <p className="text-gray-500 text-sm">Loading…</p> : (
        <>
        <ListToolbar controls={controls} searchPlaceholder="Search communities…" noun="community" nounPlural="communities" />
        {controls.visible.length === 0 ? (
          <p className="text-gray-500 text-sm">No communities match your search.</p>
        ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {FIELDS.map((f) => <SortableTh key={f.key} field={f} controls={controls} />)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {controls.visible.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      <Link
                        href={`/dashboard/communities/${c.id}`}
                        className="text-gray-900 hover:text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c._count.users}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c._count.communityAssignments}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c._count.properties}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
        </>
      )}
    </div>
  );
}
