import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CommunityEvent, fullName } from '../types';
import { Pagination } from '../components/Pagination';

interface EventsResponse {
  events: CommunityEvent[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function formatEventDate(startAt: string, endAt?: string) {
  const start = new Date(startAt);
  const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (!endAt) return `${dateStr} · ${startTime}`;

  const end = new Date(endAt);
  const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${dateStr} · ${startTime} – ${endTime}`;
}

function isPast(startAt: string) {
  return new Date(startAt) < new Date();
}

function EventCard({ event, canManage }: { event: CommunityEvent; canManage: boolean }) {
  const queryClient = useQueryClient();
  const { mutate: remove, isPending } = useMutation({
    mutationFn: () => apiClient.delete(`/api/events/${event.id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });

  const past = isPast(event.startAt);

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-5 space-y-2 ${past ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-semibold text-gray-900">{event.title}</h2>
          <p className="text-xs text-brand-600 font-medium">{formatEventDate(event.startAt, event.endAt)}</p>
          {event.location && (
            <p className="text-xs text-gray-400">📍 {event.location}</p>
          )}
        </div>
        {canManage && (
          <button
            onClick={() => remove()}
            disabled={isPending}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50 shrink-0"
          >
            Remove
          </button>
        )}
      </div>
      {event.description && (
        <p className="text-sm text-gray-600 whitespace-pre-wrap">{event.description}</p>
      )}
      <p className="text-xs text-gray-400">Added by {fullName(event.createdBy)}</p>
    </div>
  );
}

export function EventsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'BOARD_MEMBER';
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['events', page],
    queryFn: () => apiClient.get<EventsResponse>(`/api/events?page=${page}&limit=10`),
    placeholderData: keepPreviousData,
  });

  const upcoming = data?.events.filter((e) => !isPast(e.startAt)) ?? [];
  const past = data?.events.filter((e) => isPast(e.startAt)) ?? [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        {canManage && (
          <Link
            to="/events/new"
            className="bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors"
          >
            + New Event
          </Link>
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-gray-400 text-center py-12">Loading events…</p>
      )}
      {isError && (
        <p className="text-sm text-red-500 text-center py-12">Failed to load events.</p>
      )}

      {data && upcoming.length === 0 && past.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-12">
          No events scheduled.{canManage && ' Create the first one!'}
        </p>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-4">
          {upcoming.map((e) => (
            <EventCard key={e.id} event={e} canManage={canManage} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Past</h2>
          {past.map((e) => (
            <EventCard key={e.id} event={e} canManage={canManage} />
          ))}
        </div>
      )}

      {data?.pagination && (
        <Pagination pagination={data.pagination} onChange={setPage} />
      )}
    </div>
  );
}
