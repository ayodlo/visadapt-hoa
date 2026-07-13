'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/session';
import { isStaff } from '@/lib/roles';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';

interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'EMERGENCY';
  audience: string;
  targetLocation: string | null;
  isPinned: boolean;
  publishAt: string;
  expiresAt: string | null;
  isRead: boolean;
  createdBy: { firstName: string; lastName: string };
}

const PRIORITY_FILTERS = [
  { value: '', label: 'All' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'IMPORTANT', label: 'Important' },
  { value: 'NORMAL', label: 'General' },
] as const;

function priorityConfig(p: string) {
  if (p === 'EMERGENCY') return { label: 'Emergency', cls: 'bg-red-100 text-red-800 border border-red-200', bar: 'bg-red-500' };
  if (p === 'IMPORTANT') return { label: 'Important', cls: 'bg-amber-100 text-amber-800 border border-amber-200', bar: 'bg-amber-500' };
  return { label: null, cls: '', bar: '' };
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(diff / 86400000);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function AnnouncementCard({ a, onClick }: { a: Announcement; onClick?: () => void }) {
  const pc = priorityConfig(a.priority);
  const isEmergency = a.priority === 'EMERGENCY';

  return (
    <Link
      href={`/resident/announcements/${a.id}`}
      onClick={onClick}
      className={`block rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        isEmergency
          ? 'border-red-300 bg-red-50 hover:border-red-400 hover:shadow-sm'
          : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
      }`}
    >
      {isEmergency && <div className="h-1 rounded-t-xl bg-red-500" />}
      {a.priority === 'IMPORTANT' && !isEmergency && <div className="h-0.5 rounded-t-xl bg-amber-400" />}
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              {pc.label && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pc.cls}`}>
                  {pc.label}
                </span>
              )}
              {a.isPinned && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <span aria-hidden="true">📌</span> Pinned
                </span>
              )}
              {a.audience === 'BOARD_MEMBERS' && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Board Only</span>
              )}
              {a.audience === 'SPECIFIC_LOCATION' && a.targetLocation && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a.targetLocation}</span>
              )}
            </div>
            <p className={`text-sm font-semibold leading-snug ${a.isRead ? 'text-gray-600' : 'text-gray-900'}`}>
              {!a.isRead && <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1.5 mb-px align-middle" aria-label="Unread" />}
              {a.title}
            </p>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.body}</p>
          </div>
          <div className="flex flex-col items-end flex-shrink-0 gap-1">
            <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(a.publishAt)}</span>
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function ResidentAnnouncementsPage() {
  const session = useSession();
  const router = useRouter();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [priority, setPriority] = useState('');

  const load = useCallback(async (p: string) => {
    setLoading(true);
    setLoadError('');
    try {
      const params = p ? `?priority=${p}` : '';
      const res = await fetch(`/api/announcements${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setAnnouncements(json.announcements);
    } catch {
      setLoadError('Could not load announcements. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isStaff(session.role)) {
      router.replace('/admin/announcements');
      return;
    }
    load('');
  }, [session.role, router, load]);

  function handlePriorityFilter(p: string) {
    setPriority(p);
    load(p);
  }

  const pinned = announcements.filter((a) => a.isPinned);
  const unpinned = announcements.filter((a) => !a.isPinned);
  const emergencies = announcements.filter((a) => a.priority === 'EMERGENCY');
  const unreadCount = announcements.filter((a) => !a.isRead).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Announcements"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'Community updates and notices'}
      />

      {/* Emergency banner */}
      {emergencies.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex gap-3">
          <span className="text-2xl flex-shrink-0" aria-hidden="true">🚨</span>
          <div>
            <p className="text-sm font-semibold text-red-800">{emergencies.length} Emergency Notice{emergencies.length > 1 ? 's' : ''}</p>
            <p className="text-sm text-red-700">{emergencies[0].title}</p>
          </div>
        </div>
      )}

      {/* Priority filter */}
      <div className="flex gap-2 flex-wrap">
        {PRIORITY_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handlePriorityFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              priority === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => load(priority)} />
      ) : announcements.length === 0 ? (
        <EmptyState title="No announcements" description="Check back later for community updates." />
      ) : (
        <div className="space-y-6">
          {/* Pinned */}
          {pinned.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pinned</h2>
              <div className="space-y-3">
                {pinned.map((a) => <AnnouncementCard key={a.id} a={a} />)}
              </div>
            </section>
          )}

          {/* Feed */}
          {unpinned.length > 0 && (
            <section>
              {pinned.length > 0 && (
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Latest</h2>
              )}
              <div className="space-y-3">
                {unpinned.map((a) => <AnnouncementCard key={a.id} a={a} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
