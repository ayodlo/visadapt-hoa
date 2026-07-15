'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/context/session';
import { useToast } from '@/context/toast';

interface Community {
  id: string;
  name: string;
}

export default function CommunitySwitcher({ className = '' }: { className?: string }) {
  const session = useSession();
  const { toast } = useToast();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [activeCommunityId, setActiveCommunityId] = useState<string>('');
  const [switching, setSwitching] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (session.role === 'RESIDENT') return;
    fetch('/api/community/mine')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setCommunities(data.communities);
          setActiveCommunityId(data.activeCommunityId ?? '');
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [session.role]);

  if (session.role === 'RESIDENT' || !loaded || communities.length === 0) return null;

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const communityId = e.target.value;
    setSwitching(true);
    const res = await fetch('/api/community/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ communityId }),
    });
    if (res.ok) {
      // Full reload, not router.refresh(): most dashboard pages are client
      // components that fetch their own data once on mount, so a soft
      // refresh (which only re-renders Server Components) would leave them
      // showing the previous community's data after switching.
      window.location.reload();
      return;
    }
    toast('Could not switch community', 'error');
    setSwitching(false);
  }

  return (
    <div className={className}>
      <label htmlFor="community-switcher" className="sr-only">
        Active community
      </label>
      <select
        id="community-switcher"
        value={activeCommunityId}
        onChange={handleChange}
        disabled={switching || communities.length === 1}
        className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {communities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
