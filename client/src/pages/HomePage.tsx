import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Announcement } from '../types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  return (
    <article className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-900">{announcement.title}</h2>
        <time className="text-xs text-gray-400 whitespace-nowrap pt-1">
          {formatDate(announcement.createdAt)}
        </time>
      </div>
      <p className="text-sm text-gray-600 whitespace-pre-wrap">{announcement.body}</p>
      <p className="text-xs text-gray-400">
        Posted by <span className="font-medium text-gray-500">{announcement.author.name}</span>
      </p>
    </article>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const canPost = user?.role === 'ADMIN' || user?.role === 'BOARD_MEMBER';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => apiClient.get<{ announcements: Announcement[] }>('/api/announcements'),
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
        {canPost && (
          <Link
            to="/announcements/new"
            className="bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors"
          >
            + New Announcement
          </Link>
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-gray-400 text-center py-12">Loading announcements…</p>
      )}

      {isError && (
        <p className="text-sm text-red-500 text-center py-12">
          Failed to load announcements. Please try again.
        </p>
      )}

      {data?.announcements.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-12">
          No announcements yet.{canPost && ' Create the first one!'}
        </p>
      )}

      {data?.announcements.map((a) => (
        <AnnouncementCard key={a.id} announcement={a} />
      ))}
    </div>
  );
}
