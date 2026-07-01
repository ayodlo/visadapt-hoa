import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { StatCard } from '@/components/ui/StatCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { adminMock, formatDollars } from '@/lib/mock-dashboard';

const QUICK_ACTIONS = [
  { href: '/dashboard/announcements', label: 'Post Announcement', icon: '📢', description: 'Share news with residents' },
  { href: '/dashboard/events', label: 'Create Event', icon: '📅', description: 'Schedule a community event' },
  { href: '/dashboard/maintenance', label: 'Review Issues', icon: '🔧', description: 'Manage open maintenance requests' },
  { href: '/dashboard/users', label: 'Manage Users', icon: '👥', description: 'View and manage resident accounts' },
  { href: '/dashboard/dues', label: 'Dues Overview', icon: '💰', description: 'Track payments and balances' },
  { href: '/dashboard/documents', label: 'Upload Document', icon: '📄', description: 'Share files with the community' },
];

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session || session.role === 'RESIDENT') redirect('/resident/dashboard');

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title={`Admin Dashboard`}
        subtitle={`Welcome, ${session.firstName}. Here's your community at a glance.`}
      />

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Total Residents"
          value={adminMock.totalResidents}
          icon="👥"
          href="/dashboard/users"
          color="blue"
        />
        <StatCard
          label="Unpaid Balance"
          value={formatDollars(adminMock.unpaidBalanceCents)}
          icon="💰"
          href="/dashboard/dues"
          color="red"
        />
        <StatCard
          label="Open Issues"
          value={adminMock.openIssues}
          icon="🔧"
          href="/dashboard/maintenance"
        />
        <StatCard
          label="Overdue Issues"
          value={adminMock.overdueIssues}
          icon="⏰"
          href="/dashboard/maintenance"
          color={adminMock.overdueIssues > 0 ? 'red' : 'default'}
        />
        <StatCard
          label="Arch Requests"
          value={adminMock.openArchRequests}
          icon="🏗️"
        />
        <StatCard
          label="Open Violations"
          value={adminMock.openViolations}
          icon="⚠️"
          color={adminMock.openViolations > 0 ? 'yellow' : 'default'}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Recent Announcements */}
        <section aria-labelledby="admin-announcements-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="admin-announcements-heading" className="text-base font-semibold text-gray-900">
              Recent Announcements
            </h2>
            <Link href="/dashboard/announcements" className="text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
              View all
            </Link>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {adminMock.recentAnnouncements.map((a) => (
              <div key={a.id} className="px-4 py-3">
                <p className="text-sm font-medium text-gray-900">{a.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{a.date}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Summary cards */}
        <section aria-labelledby="admin-summary-heading">
          <h2 id="admin-summary-heading" className="text-base font-semibold text-gray-900 mb-3">
            Needs Attention
          </h2>
          <div className="space-y-3">
            {adminMock.overdueIssues > 0 && (
              <Link
                href="/dashboard/maintenance"
                className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <span className="text-xl" aria-hidden="true">⏰</span>
                <div>
                  <p className="text-sm font-medium text-red-800">
                    {adminMock.overdueIssues} overdue maintenance {adminMock.overdueIssues === 1 ? 'issue' : 'issues'}
                  </p>
                  <p className="text-xs text-red-600">Review and assign</p>
                </div>
              </Link>
            )}
            {adminMock.openViolations > 0 && (
              <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                <span className="text-xl" aria-hidden="true">⚠️</span>
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    {adminMock.openViolations} open {adminMock.openViolations === 1 ? 'violation' : 'violations'}
                  </p>
                  <p className="text-xs text-yellow-600">Pending resolution</p>
                </div>
              </div>
            )}
            {adminMock.openArchRequests > 0 && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <span className="text-xl" aria-hidden="true">🏗️</span>
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    {adminMock.openArchRequests} architectural {adminMock.openArchRequests === 1 ? 'request' : 'requests'} pending
                  </p>
                  <p className="text-xs text-blue-600">Awaiting board review</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Quick Actions */}
      <section aria-labelledby="admin-actions-heading">
        <h2 id="admin-actions-heading" className="text-base font-semibold text-gray-900 mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all text-left group focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <span className="text-2xl mb-2 block" aria-hidden="true">{action.icon}</span>
              <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
                {action.label}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{action.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
