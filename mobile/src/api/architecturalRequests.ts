import { apiFetch } from './client';
import type { ArchRequestSummary, ArchRequestDetail, CreateArchRequestInput } from '@/types/architecturalRequests';

export function listMyArchRequests() {
  return apiFetch<{ requests: ArchRequestSummary[] }>('/api/architectural-requests/me');
}

export function getArchRequest(id: string) {
  return apiFetch<{ request: ArchRequestDetail }>(`/api/architectural-requests/${id}`);
}

export function createArchRequest(input: CreateArchRequestInput) {
  return apiFetch<{ request: ArchRequestDetail }>('/api/architectural-requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function withdrawArchRequest(id: string) {
  return apiFetch<{ request: ArchRequestDetail }>(`/api/architectural-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ withdraw: true }),
  });
}

export function submitArchRequest(id: string) {
  return apiFetch<{ request: ArchRequestDetail }>(`/api/architectural-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ submitNow: true }),
  });
}

export function addArchRequestComment(id: string, body: string) {
  return apiFetch(`/api/architectural-requests/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
}
