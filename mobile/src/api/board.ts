import { apiFetch } from './client';
import type { BoardDashboard, BoardArchRequestsPage, BoardArchRequestDecisionInput, BoardViolationsPage, ViolationStatusUpdateInput, AppealDecisionInput } from '@/types/board';
import type { ArchRequestDetail } from '@/types/architecturalRequests';
import type { ViolationDetail, ViolationAppeal } from '@/types/violations';

export function getBoardDashboard() {
  return apiFetch<BoardDashboard>('/api/board/dashboard');
}

export function listBoardArchRequests(params: { search?: string; status?: string; type?: string; page?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.status) qs.set('status', params.status);
  if (params.type) qs.set('type', params.type);
  if (params.page) qs.set('page', String(params.page));
  const query = qs.toString();
  return apiFetch<BoardArchRequestsPage>(`/api/board/architectural-requests${query ? `?${query}` : ''}`);
}

export function getBoardArchRequest(id: string) {
  return apiFetch<{ request: ArchRequestDetail }>(`/api/board/architectural-requests/${id}`);
}

export function decideBoardArchRequest(id: string, input: BoardArchRequestDecisionInput) {
  return apiFetch<{ request: ArchRequestDetail }>(`/api/board/architectural-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listAdminViolations(
  params: { search?: string; status?: string; type?: string; hasAppeal?: boolean; page?: number } = {}
) {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.status) qs.set('status', params.status);
  if (params.type) qs.set('type', params.type);
  if (params.hasAppeal) qs.set('hasAppeal', 'true');
  if (params.page) qs.set('page', String(params.page));
  const query = qs.toString();
  return apiFetch<BoardViolationsPage>(`/api/admin/violations${query ? `?${query}` : ''}`);
}

export function getAdminViolation(id: string) {
  return apiFetch<{ violation: ViolationDetail }>(`/api/admin/violations/${id}`);
}

export function updateAdminViolation(id: string, input: ViolationStatusUpdateInput) {
  return apiFetch<{ violation: ViolationDetail }>(`/api/admin/violations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function decideAppeal(violationId: string, input: AppealDecisionInput) {
  return apiFetch<{ appeal: ViolationAppeal }>(`/api/admin/violations/${violationId}/appeal`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
