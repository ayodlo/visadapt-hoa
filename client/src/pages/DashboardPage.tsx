import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Announcement, CommunityEvent } from '../types';

interface DashboardData {
  stats: {
    openMaintenanceRequests: number;
    inProgressMaintenanceRequests: number;
    activePollsCount: number;
    outstandingDuesCents: number;
  };
  recentAnnouncements: (Announcement & { author: { id: string; name: string; role: string } })[];
  upcomingEvents: (CommunityEvent & { createdBy: { id: string; name: string } })[];
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function formatEventTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function StatCard({
  label, value, sub, to, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  to: string;
  color: string;
}) {
  return (
    <Link
      to={to}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow block"
    >
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </Link>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const isStaff = user?.role === 'ADMIN' || user?.role === 'BOARD_MEMBER';

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.get<DashboardData>('/api/dashboard'),
  });

  const { stats, recentAnnouncements, upcomingEvents } = data ?? {
    stats: { openMaintenanceRequests: 0, inProgressMaintenanceRequests: 0, activePollsCount: 0, outstandingDuesCents: 0 },
    recentAnnouncements: [],
    upcomingEvents: [],
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-sm text-gray-400 mt-1">Here's what's happening in your community.</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400 py-8">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Open Requests"
              value={stats.openMaintenanceRequests}
              sub={stats.inProgressMaintenanceRequests > 0 ? `${stats.inProgressMaintenanceRequests} in progress` : 'none in progress'}
              to="/maintenance"
              color={stats.openMaintenanceRequests > 0 ? 'text-orange-500' : 'text-gray-900'}
            />
            <StatCard
              label={isStaff ? 'Outstanding Dues' : 'Amount Owed'}
              value={formatMoney(stats.outstandingDuesCents)}
              to="/dues"
              color={stats.outstandingDuesCents > 0 ? 'text-red-500' : 'text-green-600'}
            />
            <StatCard
              label="Active Polls"
              value={stats.activePollsCount}
              sub={stats.activePollsCount > 0 ? 'vote now' : 'none open'}
              to="/polls"
              color={stats.activePollsCount > 0 ? 'text-brand-600' : 'text-gray-900'}
            />
            <StatCard
              label="Upcoming Events"
              value={upcomingEvents.length}
              sub={upcomingEvents[0] ? formatEventDate(upcomingEvents[0].startAt) : 'none scheduled'}
              to="/events"
              color="text-gray-900"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Recent Announcements
                </h2>
                <Link to="/announcements" className="text-xs text-brand-600 hover:underline">
                  View all
                </Link>
              </div>
              {recentAnnouncements.length === 0 ? (
                <p className="text-sm text-gray-400">No announcements yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentAnnouncements.map((a) => (
                    <div key={a.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-1">
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">{a.title}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">{a.body}</p>
                      <p className="text-xs text-gray-400">
                        {a.author.name} · {new Date(a.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Upcoming Events
                </h2>
                <Link to="/events" className="text-xs text-brand-600 hover:underline">
                  View all
                </Link>
              </div>
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-gray-400">No upcoming events.</p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((e) => (
                    <div key={e.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-1">
                      <p className="text-sm font-medium text-gray-900">{e.title}</p>
                      <p className="text-xs text-brand-600 font-medium">
                        {formatEventDate(e.startAt)} · {formatEventTime(e.startAt)}
                      </p>
                      {e.location && (
                        <p className="text-xs text-gray-400">{e.location}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
