import { apiFetch } from './client';
import type { ViolationSummary, ViolationDetail, ViolationComment, ViolationAppeal } from '@/types/violations';

export function listMyViolations() {
  return apiFetch<{ violations: ViolationSummary[] }>('/api/violations/me');
}

export function getViolation(id: string) {
  return apiFetch<{ violation: ViolationDetail }>(`/api/violations/${id}`);
}

export function respondToViolation(id: string, body: string) {
  return apiFetch<{ comment: ViolationComment }>(`/api/violations/${id}/respond`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export function appealViolation(id: string, reason: string) {
  return apiFetch<{ appeal: ViolationAppeal }>(`/api/violations/${id}/appeal`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
