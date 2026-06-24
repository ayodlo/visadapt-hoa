import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { DuesRecord, DuesStatus } from '../types';
import { Pagination } from '../components/Pagination';

interface DuesResponse {
  records: DuesRecord[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const STATUS_LABELS: Record<DuesStatus, string> = {
  PENDING: 'Pending',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  WAIVED: 'Waived',
};

const STATUS_BADGE: Record<DuesStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-600',
  WAIVED: 'bg-gray-100 text-gray-500',
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function StatusCell({ record, canManage }: { record: DuesRecord; canManage: boolean }) {
  const queryClient = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationFn: (status: DuesStatus) =>
      apiClient.patch(`/api/dues/${record.id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dues'] }),
  });

  if (!canManage) {
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[record.status]}`}>
        {STATUS_LABELS[record.status]}
      </span>
    );
  }

  return (
    <select
      value={record.status}
      disabled={isPending}
      onChange={(e) => mutate(e.target.value as DuesStatus)}
      className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
    >
      {(Object.keys(STATUS_LABELS) as DuesStatus[]).map((s) => (
        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
      ))}
    </select>
  );
}

export function DuesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const canManage = isAdmin || user?.role === 'BOARD_MEMBER';
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dues', page, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (statusFilter) params.set('status', statusFilter);
      return apiClient.get<DuesResponse>(`/api/dues?${params}`);
    },
    placeholderData: keepPreviousData,
  });

  const totalOwed = data?.records
    .filter((r) => r.status === 'PENDING' || r.status === 'OVERDUE')
    .reduce((sum, r) => sum + r.amountCents, 0) ?? 0;

  const totalPaid = data?.records
    .filter((r) => r.status === 'PAID')
    .reduce((sum, r) => sum + r.amountCents, 0) ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dues & Payments</h1>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABELS) as DuesStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          {isAdmin && (
            <Link
              to="/dues/new"
              className="bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors"
            >
              + Charge Dues
            </Link>
          )}
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-400 mb-1">{canManage ? 'Outstanding (page)' : 'Amount Owed'}</p>
            <p className="text-2xl font-bold text-red-500">{formatMoney(totalOwed)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-400 mb-1">{canManage ? 'Collected (page)' : 'Amount Paid'}</p>
            <p className="text-2xl font-bold text-green-600">{formatMoney(totalPaid)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-400 mb-1">Total Records</p>
            <p className="text-2xl font-bold text-gray-900">{data.pagination.total}</p>
          </div>
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-400 text-center py-12">Loading…</p>}
      {isError && <p className="text-sm text-red-500 text-center py-12">Failed to load dues.</p>}

      {data && data.records.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-12">
          No dues records yet.{isAdmin && ' Use "Charge Dues" to create some.'}
        </p>
      )}

      {data && data.records.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                {canManage && <th className="px-6 py-3 font-medium text-gray-500">Resident</th>}
                <th className="px-6 py-3 font-medium text-gray-500">Label</th>
                <th className="px-6 py-3 font-medium text-gray-500">Amount</th>
                <th className="px-6 py-3 font-medium text-gray-500">Due Date</th>
                <th className="px-6 py-3 font-medium text-gray-500">Status</th>
                {canManage && <th className="px-6 py-3 font-medium text-gray-500">Paid On</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  {canManage && (
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{r.user.name}</p>
                      <p className="text-xs text-gray-400">{r.user.email}</p>
                    </td>
                  )}
                  <td className="px-6 py-4 text-gray-700">{r.label}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">{formatMoney(r.amountCents)}</td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(r.dueDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <StatusCell record={r} canManage={canManage} />
                  </td>
                  {canManage && (
                    <td className="px-6 py-4 text-gray-400">
                      {r.paidAt ? new Date(r.paidAt).toLocaleDateString() : '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.pagination && (
        <Pagination pagination={data.pagination} onChange={setPage} />
      )}
    </div>
  );
}
