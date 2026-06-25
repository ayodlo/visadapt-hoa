import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function DashboardPage() {
  const session = await getSession();

  const [announcements, events, maintenance] = await Promise.all([
    prisma.announcement.count(),
    prisma.event.count(),
    prisma.maintenanceRequest.count({ where: { status: 'OPEN' } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Welcome back, {session?.firstName}
      </h1>
      <p className="text-gray-500 mb-8">Here&apos;s what&apos;s happening in your community.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Announcements" value={announcements} icon="📢" />
        <StatCard label="Upcoming Events" value={events} icon="📅" />
        <StatCard label="Open Requests" value={maintenance} icon="🔧" />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-3xl font-bold text-gray-900">{value}</span>
      </div>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}
