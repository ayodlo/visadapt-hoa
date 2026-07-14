import { apiFetch } from './client';
import type { SessionUser } from '@/types/auth';

export function updateProfile(firstName: string, lastName: string) {
  return apiFetch<{ user: SessionUser }>('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify({ firstName, lastName }),
  });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch<{ message: string }>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
