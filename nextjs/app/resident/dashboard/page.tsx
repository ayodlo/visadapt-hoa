import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { StatCard } from '@/components/ui/StatCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { residentMock, formatDollars } from '@/lib/mock-dashboard';

const QUICK_ACTIONS = [
  { href: '/dashboard/dues', label: 'Pay Dues', icon: '💰', description: 'View and pay your balance' },
  { href: '/dashboard/maintenance', label: 'Submit Issue', icon: '🔧', description: 'Report a maintenance problem' },
  { href: '/dashboard/documents', label: 'Browse Documents', icon: '📄', description: 'Rules, minutes & forms' },
  { href: '/dashboard/announcements', label: 'Announcements', icon: '📢', description: "What's happening in the community" },
];

export default async function ResidentDashboardPage() {
  const session = await getSession();

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={`Welcome back, ${session?.firstName} 👋`}
        subtitle="Here's what's going on in your community."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Current Balance"
          value={formatDollars(residentMock.balanceCents)}
          icon="💰"
          color={residentMock.balanceCents > 0 ? 'red' : 'green'}
          href="/dashboard/dues"
        />
        <StatCard
          label="Next Due Date"
          value={residentMock.nextDueDateLabel}
          icon="📅"
          subtext="Quarterly dues"
        />
        <StatCard
          label="Open Issues"
          value={residentMock.openIssues}
          icon="🔧"
          href="/dashboard/maintenance"
        />
        <StatCard
          label="Arch Requests"
          value={residentMock.openArchRequests}
          icon="🏗️"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Recent Announcements */}
        <section aria-labelledby="announcements-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="announcements-heading" className="text-base font-semibold text-gray-900">
              Recent Announcements
            </h2>
            <Link href="/dashboard/announcements" className="text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
              View all
            </Link>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {residentMock.recentAnnouncements.map((a) => (
              <div key={a.id} className="px-4 py-3">
                <p className="text-sm font-medium text-gray-900">{a.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{a.date}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Violations */}
        <section aria-labelledby="violations-heading">
          <h2 id="violations-heading" className="text-base font-semibold text-gray-900 mb-3">
            Recent Violations
          </h2>
          {residentMock.recentViolations.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl">
              <EmptyState
                icon="✅"
                title="You're all clear"
                description="No open violations on your account."
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {residentMock.recentViolations.map((v) => (
                <div key={v.id} className="px-4 py-3">
                  <p className="text-sm text-gray-900">{v.description}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{v.date}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Quick Actions */}
      <section aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading" className="text-base font-semibold text-gray-900 mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
