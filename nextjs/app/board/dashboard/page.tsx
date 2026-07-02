import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { StatCard } from '@/components/ui/StatCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { getBoardDashboard, formatDollars } from '@/lib/dashboard';

export default async function BoardDashboardPage() {
  const session = await getSession();
  if (!session || session.role === 'RESIDENT') redirect('/resident/dashboard');

  let data: Awaited<ReturnType<typeof getBoardDashboard>> | null = null;
  try {
    data = await getBoardDashboard();
  } catch {
    // partial UI with error banner
  }

  const resolveRate = data
    ? Math.round((data.resolvedThisMonth / Math.max(1, data.openIssues + data.resolvedThisMonth)) * 100)
    : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <PageHeader
        title="Board Dashboard"
        subtitle={`Welcome, ${session.firstName}. Here's what needs your attention.`}
      />

      {!data && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700" role="alert">
          Dashboard data could not be loaded. Please refresh the page.
        </div>
      )}

      {/* Community metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Open Issues"
          value={data?.openIssues ?? '—'}
          icon="🔨"
          href="/admin/issues"
        />
        <StatCard
          label="Resolved This Month"
          value={data?.resolvedThisMonth ?? '—'}
          icon="✅"
          color="green"
        />
        <StatCard
          label="Arch Requests"
          value={data?.archRequestsNeedingReview ?? '—'}
          icon="🏗️"
          href="/board/architectural-requests"
          color={(data?.archRequestsNeedingReview ?? 0) > 0 ? 'yellow' : 'default'}
        />
        <StatCard
          label="Pending Appeals"
          value={data?.pendingAppeals ?? '—'}
          icon="⚠️"
          href="/board/violations"
          color={(data?.pendingAppeals ?? 0) > 0 ? 'red' : 'default'}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Decision queue */}
        <section aria-labelledby="decision-queue-heading">
          <h2 id="decision-queue-heading" className="text-base font-semibold text-gray-900 mb-3">
            Decision Queue
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl font-bold text-gray-900" aria-label={`${data?.decisionQueueCount ?? 0} items`}>
                {data?.decisionQueueCount ?? '—'}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-900">Items awaiting board action</p>
                <p className="text-xs text-gray-500">Arch requests + violations + appeals</p>
              </div>
            </div>
            <div className="space-y-2">
              {data && data.archRequestsNeedingReview > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Architectural requests</span>
                  <Link
                    href="/board/architectural-requests"
                    className="font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full text-xs hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  >
                    {data.archRequestsNeedingReview} pending
                  </Link>
                </div>
              )}
              {data && data.violationsNeedingReview > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Escalated violations</span>
                  <Link
                    href="/board/violations"
                    className="font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full text-xs hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {data.violationsNeedingReview} escalated
                  </Link>
                </div>
              )}
              {data && data.pendingAppeals > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Pending appeals</span>
                  <Link
                    href="/board/violations"
                    className="font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full text-xs hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {data.pendingAppeals} to review
                  </Link>
                </div>
              )}
              {data && data.decisionQueueCount === 0 && (
                <p className="text-sm text-green-600 font-medium">Queue is clear — no pending decisions.</p>
              )}
            </div>
          </div>
        </section>

        {/* Financial summary */}
        <section aria-labelledby="financial-heading">
          <h2 id="financial-heading" className="text-base font-semibold text-gray-900 mb-3">
            Financial Summary
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            {data ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Total billed</span>
                  <span className="font-medium text-gray-900">{formatDollars(data.financialSummary.totalBilledCents)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Total collected</span>
                  <span className="font-medium text-green-700">{formatDollars(data.financialSummary.totalPaidCents)}</span>
                </div>
                <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-3">
                  <span className="text-gray-600">Outstanding balance</span>
                  <span className={`font-semibold ${data.financialSummary.outstandingCents > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatDollars(Math.max(0, data.financialSummary.outstandingCents))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Delinquent accounts</span>
                  <span className={`font-medium text-xs px-2 py-0.5 rounded-full ${data.financialSummary.delinquentAccounts > 0 ? 'text-red-700 bg-red-50' : 'text-green-700 bg-green-50'}`}>
                    {data.financialSummary.delinquentAccounts}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Loading financial data…</p>
            )}
          </div>
        </section>

        {/* Community issue metrics */}
        <section aria-labelledby="metrics-heading">
          <h2 id="metrics-heading" className="text-base font-semibold text-gray-900 mb-3">
            Community Issue Metrics
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Resolution rate this month</span>
                <span className="font-medium text-gray-900">{resolveRate}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={resolveRate} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${resolveRate}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{data?.openIssues ?? '—'}</p>
                <p className="text-xs text-gray-500">Open</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{data?.resolvedThisMonth ?? '—'}</p>
                <p className="text-xs text-gray-500">Resolved this month</p>
              </div>
            </div>
          </div>
        </section>

        {/* Recent announcements */}
        <section aria-labelledby="board-announcements-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="board-announcements-heading" className="text-base font-semibold text-gray-900">
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
      </div>
    </div>
  );
}
