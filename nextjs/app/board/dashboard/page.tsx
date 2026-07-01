import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { StatCard } from '@/components/ui/StatCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { boardMock } from '@/lib/mock-dashboard';

export default async function BoardDashboardPage() {
  const session = await getSession();
  if (!session || session.role === 'RESIDENT') redirect('/resident/dashboard');

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Board Dashboard"
        subtitle={`Welcome, ${session.firstName}. Here's what needs your attention.`}
      />

      {/* Community metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Open Issues"
          value={boardMock.openIssues}
          icon="🔧"
          href="/dashboard/maintenance"
        />
        <StatCard
          label="Resolved This Month"
          value={boardMock.resolvedThisMonth}
          icon="✅"
          color="green"
        />
        <StatCard
          label="Arch Requests"
          value={boardMock.archRequestsNeedingReview}
          icon="🏗️"
          color={boardMock.archRequestsNeedingReview > 0 ? 'yellow' : 'default'}
        />
        <StatCard
          label="Violations"
          value={boardMock.violationsNeedingReview}
          icon="⚠️"
          color={boardMock.violationsNeedingReview > 0 ? 'red' : 'default'}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Decision queue */}
        <section aria-labelledby="decision-queue-heading">
          <h2 id="decision-queue-heading" className="text-base font-semibold text-gray-900 mb-3">
            Decision Queue
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl font-bold text-gray-900">{boardMock.decisionQueueCount}</span>
              <div>
                <p className="text-sm font-medium text-gray-900">Items awaiting board vote</p>
                <p className="text-xs text-gray-500">Arch requests + violations</p>
              </div>
            </div>
            <div className="space-y-2">
              {boardMock.archRequestsNeedingReview > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Architectural requests</span>
                  <span className="font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full text-xs">
                    {boardMock.archRequestsNeedingReview} pending
                  </span>
                </div>
              )}
              {boardMock.violationsNeedingReview > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Violations</span>
                  <span className="font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full text-xs">
                    {boardMock.violationsNeedingReview} needing review
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-4 border-t border-gray-100 pt-3">
              Full decision workflow coming in a future sprint.
            </p>
          </div>
        </section>

        {/* Financial summary placeholder */}
        <section aria-labelledby="financial-heading">
          <h2 id="financial-heading" className="text-base font-semibold text-gray-900 mb-3">
            Financial Summary
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">YTD Revenue</span>
                <span className="font-medium text-gray-400">—</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">YTD Expenses</span>
                <span className="font-medium text-gray-400">—</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Reserve Fund</span>
                <span className="font-medium text-gray-400">—</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Delinquent Accounts</span>
                <span className="font-medium text-gray-400">—</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-4 border-t border-gray-100 pt-3">
              Financial reporting coming in a future sprint.
            </p>
          </div>
        </section>

        {/* Recent announcements */}
        <section aria-labelledby="board-announcements-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="board-announcements-heading" className="text-base font-semibold text-gray-900">
              Recent Announcements
            </h2>
            <Link href="/dashboard/announcements" className="text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
              View all
            </Link>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {boardMock.recentAnnouncements.map((a) => (
              <div key={a.id} className="px-4 py-3">
                <p className="text-sm font-medium text-gray-900">{a.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{a.date}</p>
              </div>
            ))}
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
                <span className="font-medium text-gray-900">
                  {Math.round((boardMock.resolvedThisMonth / (boardMock.openIssues + boardMock.resolvedThisMonth)) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{
                    width: `${Math.round((boardMock.resolvedThisMonth / (boardMock.openIssues + boardMock.resolvedThisMonth)) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{boardMock.openIssues}</p>
                <p className="text-xs text-gray-500">Open</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{boardMock.resolvedThisMonth}</p>
                <p className="text-xs text-gray-500">Resolved this month</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
