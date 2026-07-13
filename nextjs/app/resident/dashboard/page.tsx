import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { StatCard } from '@/components/ui/StatCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { getResidentDashboard, formatDollars } from '@/lib/dashboard';
import { violationTypeLabel, residentStatusLabel } from '@/lib/violations';

const QUICK_ACTIONS = [
  { href: '/resident/payments', label: 'Pay Dues', icon: '💰', description: 'View and pay your balance' },
  { href: '/resident/issues', label: 'Submit Issue', icon: '🔨', description: 'Report a maintenance problem' },
  { href: '/resident/documents', label: 'Browse Documents', icon: '📄', description: 'Rules, minutes & forms' },
  { href: '/resident/announcements', label: 'Announcements', icon: '📢', description: "What's happening in the community" },
];

export default async function ResidentDashboardPage() {
  const session = await getSession();

  let data: Awaited<ReturnType<typeof getResidentDashboard>> | null = null;
  try {
    if (session?.id) {
      data = await getResidentDashboard(session.id);
    }
  } catch {
    // show partial UI
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <PageHeader
        title={`Welcome back, ${session?.firstName}`}
        subtitle="Here's what's going on in your community."
      />

      {!data && session && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700" role="alert">
          Dashboard data could not be loaded. Please refresh the page.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Current Balance"
          value={data ? formatDollars(data.balanceCents) : '—'}
          icon="💰"
          color={(data?.balanceCents ?? 0) > 0 ? 'red' : 'green'}
          href="/resident/payments"
        />
        <StatCard
          label="Next Due Date"
          value={data?.nextDueDateLabel ?? '—'}
          icon="📅"
          subtext={data?.nextDueAmountCents ? formatDollars(data.nextDueAmountCents) : 'Quarterly dues'}
        />
        <StatCard
          label="Open Issues"
          value={data?.openIssues ?? '—'}
          icon="🔨"
          href="/resident/issues"
        />
        <StatCard
          label="Arch Requests"
          value={data?.openArchRequests ?? '—'}
          icon="🏗️"
          href="/resident/architectural-requests"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Announcements */}
        <section aria-labelledby="announcements-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="announcements-heading" className="text-base font-semibold text-gray-900">
              Recent Announcements
            </h2>
            <Link href="/resident/announcements" className="text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
              View all
            </Link>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {!data || data.recentAnnouncements.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">No announcements yet.</p>
            ) : (
              data.recentAnnouncements.map((a) => (
                <Link
                  key={a.id}
                  href={`/resident/announcements/${a.id}`}
                  className="block px-4 py-3 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-inset focus:ring-2 focus:ring-blue-500"
                >
                  <p className="text-sm font-medium text-gray-900">{a.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{a.date}</p>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Active Violations */}
        <section aria-labelledby="violations-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="violations-heading" className="text-base font-semibold text-gray-900">
              Community Standards
            </h2>
            {(data?.activeViolations?.length ?? 0) > 0 && (
              <Link href="/resident/violations" className="text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
                View all
              </Link>
            )}
          </div>
          {!data || data.activeViolations.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl">
              <EmptyState
                icon="✅"
                title="You're all clear"
                description="No open community standards notices on your account."
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {data.activeViolations.map((v) => (
                <Link
                  key={v.id}
                  href={`/resident/violations/${v.id}`}
                  className="block px-4 py-3 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-inset focus:ring-2 focus:ring-blue-500"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full font-medium">
                      {residentStatusLabel(v.status)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{violationTypeLabel(v.violationType)} Notice</p>
                  <p className="text-xs text-gray-400 mt-0.5">{v.date}</p>
                </Link>
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
