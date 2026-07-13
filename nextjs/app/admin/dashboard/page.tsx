import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { StatCard } from '@/components/ui/StatCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { getAdminDashboard, formatDollars } from '@/lib/dashboard';

const QUICK_ACTIONS = [
  { href: '/admin/announcements', label: 'Post Announcement', icon: '📢', description: 'Share news with residents' },
  { href: '/dashboard/events', label: 'Create Event', icon: '📅', description: 'Schedule a community event' },
  { href: '/admin/issues', label: 'Review Issues', icon: '🔨', description: 'Manage open maintenance requests' },
  { href: '/dashboard/users', label: 'Manage Users', icon: '👥', description: 'View and manage resident accounts' },
  { href: '/admin/payments', label: 'Dues Overview', icon: '💰', description: 'Track payments and balances' },
  { href: '/admin/documents', label: 'Documents', icon: '📄', description: 'Share files with the community' },
];

function activityLabel(action: string): string {
  switch (action) {
    case 'created': return 'submitted';
    case 'status_changed': return 'status updated';
    case 'comment_added': return 'comment added';
    case 'assigned': return 'assigned';
    default: return action.replace(/_/g, ' ');
  }
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session || session.role === 'RESIDENT') redirect('/resident/dashboard');

  let data: Awaited<ReturnType<typeof getAdminDashboard>> | null = null;
  try {
    data = await getAdminDashboard();
  } catch {
    // show partial UI with error banner
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <PageHeader
        title="Admin Dashboard"
        subtitle={`Welcome, ${session.firstName}. Here's your community at a glance.`}
      />

      {!data && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700" role="alert">
          Dashboard data could not be loaded. Please refresh the page.
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Residents"
          value={data?.totalResidents ?? '—'}
          icon="👥"
          href="/dashboard/users"
          color="blue"
        />
        <StatCard
          label="Unpaid Balance"
          value={data ? formatDollars(data.unpaidBalanceCents) : '—'}
          icon="💰"
          href="/admin/payments"
          color={(data?.unpaidBalanceCents ?? 0) > 0 ? 'red' : 'default'}
        />
        <StatCard
          label="Open Issues"
          value={data?.openIssues ?? '—'}
          icon="🔨"
          href="/admin/issues"
        />
        <StatCard
          label="Overdue Issues"
          value={data?.overdueIssues ?? '—'}
          icon="⏰"
          href="/admin/issues"
          color={(data?.overdueIssues ?? 0) > 0 ? 'red' : 'default'}
        />
        <StatCard
          label="Arch Requests"
          value={data?.openArchRequests ?? '—'}
          icon="🏗️"
          href="/admin/architectural-requests"
        />
        <StatCard
          label="Open Violations"
          value={data?.openViolations ?? '—'}
          icon="⚠️"
          href="/admin/violations"
          color={(data?.openViolations ?? 0) > 0 ? 'yellow' : 'default'}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Needs attention */}
        <section aria-labelledby="admin-attention-heading">
          <h2 id="admin-attention-heading" className="text-base font-semibold text-gray-900 mb-3">
            Needs Attention
          </h2>
          <div className="space-y-3">
            {data && data.overdueIssues > 0 && (
              <Link
                href="/admin/issues"
                className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <span className="text-xl" aria-hidden="true">⏰</span>
                <div>
                  <p className="text-sm font-medium text-red-800">
                    {data.overdueIssues} overdue maintenance {data.overdueIssues === 1 ? 'issue' : 'issues'}
                  </p>
                  <p className="text-xs text-red-600">Review and assign immediately</p>
                </div>
              </Link>
            )}
            {data && data.openViolations > 0 && (
              <Link
                href="/admin/violations"
                className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 hover:bg-yellow-100 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                <span className="text-xl" aria-hidden="true">⚠️</span>
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    {data.openViolations} open {data.openViolations === 1 ? 'violation' : 'violations'}
                  </p>
                  <p className="text-xs text-yellow-600">Pending resolution</p>
                </div>
              </Link>
            )}
            {data && data.pendingAppeals > 0 && (
              <Link
                href="/admin/violations"
                className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 hover:bg-indigo-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <span className="text-xl" aria-hidden="true">📋</span>
                <div>
                  <p className="text-sm font-medium text-indigo-800">
                    {data.pendingAppeals} {data.pendingAppeals === 1 ? 'appeal' : 'appeals'} pending review
                  </p>
                  <p className="text-xs text-indigo-600">Resident appeal responses awaiting decision</p>
                </div>
              </Link>
            )}
            {data && data.openArchRequests > 0 && (
              <Link
                href="/admin/architectural-requests"
                className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 hover:bg-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <span className="text-xl" aria-hidden="true">🏗️</span>
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    {data.openArchRequests} architectural {data.openArchRequests === 1 ? 'request' : 'requests'} pending
                  </p>
                  <p className="text-xs text-blue-600">Awaiting review or board decision</p>
                </div>
              </Link>
            )}
            {data && data.overdueIssues === 0 && data.openViolations === 0 && data.pendingAppeals === 0 && data.openArchRequests === 0 && (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <span className="text-xl" aria-hidden="true">✅</span>
                <p className="text-sm font-medium text-green-800">All queues are clear</p>
              </div>
            )}
          </div>
        </section>

        {/* Recent announcements */}
        <section aria-labelledby="admin-announcements-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="admin-announcements-heading" className="text-base font-semibold text-gray-900">
              Recent Announcements
            </h2>
            <Link href="/admin/announcements" className="text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
              View all
            </Link>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {!data || data.recentAnnouncements.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">No announcements yet.</p>
            ) : (
              data.recentAnnouncements.map((a) => (
                <div key={a.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-900">{a.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{a.date}</p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Issue metrics */}
        {data && (
          <section aria-labelledby="admin-issue-metrics-heading">
            <h2 id="admin-issue-metrics-heading" className="text-base font-semibold text-gray-900 mb-3">
              Issue Breakdown
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              {data.avgResolutionDays !== null && (
                <div className="flex items-center justify-between text-sm border-b border-gray-100 pb-3 mb-1">
                  <span className="text-gray-600">Avg. resolution (this month)</span>
                  <span className="font-semibold text-gray-900">{data.avgResolutionDays} days</span>
                </div>
              )}
              {data.issuesByStatus.map((s) => (
                <div key={s.status} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 capitalize">{s.status.replace(/_/g, ' ').toLowerCase()}</span>
                  <span className="font-medium text-gray-900 bg-gray-100 px-2 py-0.5 rounded-full text-xs">{s.count}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Financial summary */}
        {data && (
          <section aria-labelledby="admin-financial-heading">
            <h2 id="admin-financial-heading" className="text-base font-semibold text-gray-900 mb-3">
              Financial Summary
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Total outstanding</span>
                <span className={`font-semibold ${data.unpaidBalanceCents > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatDollars(data.unpaidBalanceCents)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Delinquent accounts</span>
                <span className={`font-medium text-xs px-2 py-0.5 rounded-full ${data.delinquentAccounts > 0 ? 'text-red-700 bg-red-50' : 'text-green-700 bg-green-50'}`}>
                  {data.delinquentAccounts}
                </span>
              </div>
              <Link href="/admin/payments" className="block text-xs text-blue-600 hover:underline pt-1 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
                View full payment report →
              </Link>
            </div>
          </section>
        )}
      </div>

      {/* Recent activity */}
      {data && data.recentActivity.length > 0 && (
        <section aria-labelledby="admin-activity-heading">
          <h2 id="admin-activity-heading" className="text-base font-semibold text-gray-900 mb-3">
            Recent Issue Activity
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {data.recentActivity.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-400 flex-shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800">
                    <span className="font-medium">{a.actorName ?? 'System'}</span>
                    {' '}{activityLabel(a.action)}{' — '}
                    <Link href={`/admin/issues/${a.issueId}`} className="text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
                      {a.issueTitle}
                    </Link>
                  </p>
                  {a.details && <p className="text-xs text-gray-500 mt-0.5">{a.details}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{fmt(a.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
