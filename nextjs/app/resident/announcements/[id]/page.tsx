'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';

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

function priorityBadge(p: string) {
  if (p === 'EMERGENCY') return 'bg-red-100 text-red-800 border border-red-200';
  if (p === 'IMPORTANT') return 'bg-amber-100 text-amber-800 border border-amber-200';
  return 'bg-gray-100 text-gray-600';
}

function priorityLabel(p: string) {
  if (p === 'EMERGENCY') return 'Emergency';
  if (p === 'IMPORTANT') return 'Important';
  return 'General';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default function ResidentAnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/announcements/${id}`);
      if (res.status === 404) throw new Error('This announcement is no longer available.');
      if (res.status === 403) throw new Error('You do not have access to this announcement.');
      if (!res.ok) throw new Error('Failed to load announcement.');
      const json = await res.json();
      setAnnouncement(json.announcement);

      // Mark as read
      fetch(`/api/announcements/${id}/read`, { method: 'POST' }).catch(() => {});
    } catch (ex) {
      setLoadError(ex instanceof Error ? ex.message : 'Could not load announcement.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState />;
  if (loadError) return <ErrorState message={loadError} />;
  if (!announcement) return null;

  const isEmergency = announcement.priority === 'EMERGENCY';

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/resident/announcements" className="hover:text-blue-600 transition-colors">Announcements</Link>
        <span aria-hidden="true">›</span>
        <span className="text-gray-800 truncate">{announcement.title}</span>
      </div>

      {/* Emergency top bar */}
      {isEmergency && (
        <div className="bg-red-600 text-white rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-xl" aria-hidden="true">🚨</span>
          <p className="text-sm font-semibold">Emergency Notice — Please read carefully</p>
        </div>
      )}

      <article className={`bg-white rounded-xl border p-6 ${isEmergency ? 'border-red-300' : 'border-gray-200'}`}>
        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${priorityBadge(announcement.priority)}`}>
            {priorityLabel(announcement.priority)}
          </span>
          {announcement.isPinned && (
            <span className="text-xs text-gray-500">📌 Pinned</span>
          )}
          {announcement.audience === 'BOARD_MEMBERS' && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Board Members Only</span>
          )}
          {announcement.audience === 'SPECIFIC_LOCATION' && announcement.targetLocation && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{announcement.targetLocation}</span>
          )}
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">{announcement.title}</h1>

        <p className="text-xs text-gray-500 mb-6">
          Posted by {announcement.createdBy.firstName} {announcement.createdBy.lastName} · {formatDate(announcement.publishAt)}
          {announcement.expiresAt && (
            <> · Expires {formatDate(announcement.expiresAt)}</>
          )}
        </p>

        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          {announcement.body}
        </div>
      </article>

      <Link
        href="/resident/announcements"
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to announcements
      </Link>
    </div>
  );
}
