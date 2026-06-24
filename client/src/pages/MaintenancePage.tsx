import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { MaintenanceRequest, RequestStatus, RequestPriority } from '../types';
import { Pagination } from '../components/Pagination';

interface MaintenanceResponse {
  requests: MaintenanceRequest[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const STATUS_LABELS: Record<RequestStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const STATUS_BADGE: Record<RequestStatus, string> = {
  OPEN: 'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-500',
};

const PRIORITY_BADGE: Record<RequestPriority, string> = {
  LOW: 'bg-gray-100 text-gray-500',
  MEDIUM: 'bg-blue-50 text-blue-600',
  HIGH: 'bg-orange-100 text-orange-600',
  URGENT: 'bg-red-100 text-red-600',
};

function RequestCard({ request, canManage }: { request: MaintenanceRequest; canManage: boolean }) {
  const queryClient = useQueryClient();
  const { mutate: changeStatus, isPending } = useMutation({
    mutationFn: (status: RequestStatus) =>
      apiClient.patch<{ request: MaintenanceRequest }>(`/api/maintenance/${request.id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['maintenance'] }),
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-semibold text-gray-900">{request.title}</h2>
          <p className="text-xs text-gray-400">
            Submitted by <span className="font-medium text-gray-500">{request.submittedBy.name}</span>
            {' · '}
            {new Date(request.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_BADGE[request.priority]}`}>
            {request.priority.charAt(0) + request.priority.slice(1).toLowerCase()}
          </span>
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[request.status]}`}>
            {STATUS_LABELS[request.status]}
          </span>
        </div>
      </div>

      <p className="text-sm text-gray-600 whitespace-pre-wrap">{request.description}</p>

      {canManage && (
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
          <span className="text-xs text-gray-400">Update status:</span>
          <select
            value={request.status}
            disabled={isPending}
            onChange={(e) => changeStatus(e.target.value as RequestStatus)}
            className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
          >
            {(Object.keys(STATUS_LABELS) as RequestStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

export function MaintenancePage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'BOARD_MEMBER';
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  function handleFilter(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLSelectElement>) => {
      setter(e.target.value);
      setPage(1);
    };
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['maintenance', page, statusFilter, priorityFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      return apiClient.get<MaintenanceResponse>(`/api/maintenance?${params}`);
    },
    placeholderData: keepPreviousData,
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Maintenance Requests</h1>
        <Link
          to="/maintenance/new"
          className="bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors"
        >
          + New Request
        </Link>
      </div>

      <div className="flex gap-3">
        <select
          value={statusFilter}
          onChange={handleFilter(setStatusFilter)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABELS) as RequestStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={handleFilter(setPriorityFilter)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
      </div>

      {isLoading && (
        <p className="text-sm text-gray-400 text-center py-12">Loading requests…</p>
      )}

      {isError && (
        <p className="text-sm text-red-500 text-center py-12">Failed to load requests.</p>
      )}

      {data?.requests.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-12">
          {statusFilter || priorityFilter ? 'No requests match the selected filters.' : 'No maintenance requests yet.'}
        </p>
      )}

      {data?.requests.map((r) => (
        <RequestCard key={r.id} request={r} canManage={canManage} />
      ))}

      {data?.pagination && (
        <Pagination pagination={data.pagination} onChange={setPage} />
      )}
    </div>
  );
}
