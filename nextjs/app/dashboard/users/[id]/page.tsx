'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/context/session';
import { useToast } from '@/context/toast';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'BOARD_MEMBER' | 'RESIDENT';

interface CommunityRef { communityId: string; community: { name: string } }
interface UserDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  createdAt: string;
  communityId: string | null;
  community: { name: string } | null;
  communityAssignments: CommunityRef[];
}
interface Community { id: string; name: string }
interface Property {
  id: string;
  streetAddress: string;
  unitNumber: string | null;
  city: string;
  state: string;
  zipCode: string;
}

const EMPTY_PROPERTY = { streetAddress: '', unitNumber: '', city: '', state: '', zipCode: '' };

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const session = useSession();
  const { toast } = useToast();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [allCommunities, setAllCommunities] = useState<Community[]>([]);
  const [selectedCommunityIds, setSelectedCommunityIds] = useState<string[]>([]);
  const [savingCommunities, setSavingCommunities] = useState(false);

  const [properties, setProperties] = useState<Property[]>([]);
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [propertyForm, setPropertyForm] = useState(EMPTY_PROPERTY);
  const [propertySubmitting, setPropertySubmitting] = useState(false);
  const [propertyError, setPropertyError] = useState('');

  async function loadUser() {
    const res = await fetch(`/api/users/${params.id}`);
    if (res.ok) {
      const data: UserDetail = await res.json();
      setUser(data);
      setSelectedCommunityIds(data.communityAssignments.map((a) => a.communityId));
    } else {
      router.push('/dashboard/users');
    }
    setLoading(false);
  }

  async function loadProperties() {
    const res = await fetch(`/api/properties?userId=${params.id}`);
    if (res.ok) setProperties(await res.json());
  }

  useEffect(() => { loadUser(); }, [params.id]);

  useEffect(() => {
    if (session.role === 'SUPER_ADMIN') {
      fetch('/api/admin/communities')
        .then((res) => (res.ok ? res.json() : []))
        .then((data: Community[]) => setAllCommunities(data));
    }
  }, [session.role]);

  useEffect(() => {
    if (user?.role === 'RESIDENT') loadProperties();
  }, [user?.role, params.id]);

  function toggleCommunity(id: string) {
    setSelectedCommunityIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function saveCommunities() {
    if (selectedCommunityIds.length === 0) {
      toast('At least one community is required', 'error');
      return;
    }
    setSavingCommunities(true);
    const res = await fetch(`/api/users/${params.id}/communities`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ communityIds: selectedCommunityIds }),
    });
    if (res.ok) {
      toast('Community assignments updated', 'success');
      loadUser();
    } else {
      const data = await res.json().catch(() => null);
      toast(data?.error ?? 'Could not update assignments', 'error');
    }
    setSavingCommunities(false);
  }

  async function handleAddProperty(e: React.FormEvent) {
    e.preventDefault();
    setPropertySubmitting(true);
    setPropertyError('');
    const res = await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: params.id, ...propertyForm }),
    });
    if (res.ok) {
      setPropertyForm(EMPTY_PROPERTY);
      setShowPropertyForm(false);
      loadProperties();
    } else {
      const data = await res.json().catch(() => null);
      setPropertyError(data?.error ?? 'Could not add property.');
    }
    setPropertySubmitting(false);
  }

  async function handleDeleteProperty(id: string, address: string) {
    if (!confirm(`Remove ${address}? This cannot be undone.`)) return;
    await fetch(`/api/properties/${id}`, { method: 'DELETE' });
    loadProperties();
  }

  if (loading) return <p className="text-gray-500 text-sm">Loading…</p>;
  if (!user) return null;

  const isStaffUser = user.role === 'ADMIN' || user.role === 'BOARD_MEMBER';

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/users" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
        ← Back to Users
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h1 className="text-xl font-bold text-gray-900">{user.firstName} {user.lastName}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
        <p className="text-xs text-gray-400 mt-2">{user.role.replace('_', ' ')} · Joined {new Date(user.createdAt).toLocaleDateString()}</p>
      </div>

      {user.role === 'RESIDENT' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Community</h2>
          <p className="text-sm text-gray-600">{user.community?.name ?? '—'}</p>
        </div>
      )}

      {isStaffUser && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Community Assignments</h2>
          {session.role === 'SUPER_ADMIN' ? (
            <>
              <div className="space-y-2 mb-4">
                {allCommunities.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={selectedCommunityIds.includes(c.id)}
                      onChange={() => toggleCommunity(c.id)}
                      className="rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                    {c.name}
                  </label>
                ))}
              </div>
              <button
                onClick={saveCommunities}
                disabled={savingCommunities}
                className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingCommunities ? 'Saving…' : 'Save Assignments'}
              </button>
            </>
          ) : (
            <ul className="space-y-1">
              {user.communityAssignments.map((a) => (
                <li key={a.communityId} className="text-sm text-gray-600">{a.community.name}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {user.role === 'RESIDENT' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Properties</h2>
            <button onClick={() => setShowPropertyForm(!showPropertyForm)} className="text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
              + Add Property
            </button>
          </div>

          {showPropertyForm && (
            <form onSubmit={handleAddProperty} className="space-y-3 mb-4 border border-gray-200 rounded-lg p-4">
              {propertyError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{propertyError}</div>}
              <input required placeholder="Street address" value={propertyForm.streetAddress} onChange={(e) => setPropertyForm((f) => ({ ...f, streetAddress: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input placeholder="Unit number (optional)" value={propertyForm.unitNumber} onChange={(e) => setPropertyForm((f) => ({ ...f, unitNumber: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="grid grid-cols-3 gap-3">
                <input required placeholder="City" value={propertyForm.city} onChange={(e) => setPropertyForm((f) => ({ ...f, city: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input required placeholder="State" value={propertyForm.state} onChange={(e) => setPropertyForm((f) => ({ ...f, state: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input required placeholder="Zip code" value={propertyForm.zipCode} onChange={(e) => setPropertyForm((f) => ({ ...f, zipCode: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={propertySubmitting} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {propertySubmitting ? 'Adding…' : 'Add Property'}
                </button>
                <button type="button" onClick={() => { setShowPropertyForm(false); setPropertyError(''); }} className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {properties.length === 0 ? (
            <p className="text-sm text-gray-400">No properties on file.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {properties.map((p) => (
                <li key={p.id} className="py-2.5 flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    {p.streetAddress}{p.unitNumber ? ` #${p.unitNumber}` : ''}, {p.city}, {p.state} {p.zipCode}
                  </span>
                  <button onClick={() => handleDeleteProperty(p.id, p.streetAddress)} className="text-xs text-gray-400 hover:text-red-500">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
