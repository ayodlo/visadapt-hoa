import { apiFetch } from './client';
import type { IssueSummary, IssueDetail, CreateIssueInput } from '@/types/issues';

export function listMyIssues() {
  return apiFetch<{ issues: IssueSummary[] }>('/api/issues/me');
}

export function getIssue(id: string) {
  return apiFetch<{ issue: IssueDetail }>(`/api/issues/${id}`);
}

export function createIssue(input: CreateIssueInput) {
  return apiFetch<{ issue: IssueDetail }>('/api/issues', { method: 'POST', body: JSON.stringify(input) });
}

export function addIssueComment(issueId: string, body: string) {
  return apiFetch(`/api/issues/${issueId}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
}
