import { apiFetch } from './client';
import type {
  AdminDashboard,
  AdminIssuesPage,
  AdminIssueDetail,
  AdminIssuePatchInput,
  AdminVendorOption,
  CreateVendorInput,
  CreateViolationInput,
  AdminUserListItem,
  CreateUserInput,
  UpdateUserInput,
  IssuesReport,
  PaymentsReport,
  ArchRequestsReport,
  ViolationsReport,
} from '@/types/admin';

export function getAdminDashboard() {
  return apiFetch<AdminDashboard>('/api/admin/dashboard');
}

export function listAdminIssues(
  params: {
    search?: string;
    status?: string;
    category?: string;
    priority?: string;
    assignedTo?: string;
    vendor?: string;
    sortBy?: string;
    sortDir?: string;
    page?: number;
  } = {}
) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) qs.set(key, String(value));
  }
  const query = qs.toString();
  return apiFetch<AdminIssuesPage>(`/api/admin/issues${query ? `?${query}` : ''}`);
}

export function updateAdminIssue(id: string, input: AdminIssuePatchInput) {
  return apiFetch<{ issue: AdminIssueDetail }>(`/api/admin/issues/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listVendorOptions() {
  return apiFetch<{ vendors: AdminVendorOption[] }>('/api/admin/vendors');
}

export function createVendor(input: CreateVendorInput) {
  return apiFetch<{ vendor: AdminVendorOption }>('/api/admin/vendors', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function createViolation(input: CreateViolationInput) {
  return apiFetch('/api/admin/violations', { method: 'POST', body: JSON.stringify(input) });
}

export function listUsers() {
  return apiFetch<AdminUserListItem[]>('/api/users');
}

export function createUser(input: CreateUserInput) {
  return apiFetch<AdminUserListItem>('/api/users', { method: 'POST', body: JSON.stringify(input) });
}

export function updateUser(id: string, input: UpdateUserInput) {
  return apiFetch<AdminUserListItem>(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export function deleteUser(id: string) {
  return apiFetch<{ deleted: true }>(`/api/users/${id}`, { method: 'DELETE' });
}

export function getIssuesReport() {
  return apiFetch<IssuesReport>('/api/admin/reports/issues');
}

export function getPaymentsReport() {
  return apiFetch<PaymentsReport>('/api/admin/reports/payments');
}

export function getArchRequestsReport() {
  return apiFetch<ArchRequestsReport>('/api/admin/reports/architectural-requests');
}

export function getViolationsReport() {
  return apiFetch<ViolationsReport>('/api/admin/reports/violations');
}
