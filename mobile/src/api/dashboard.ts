import { apiFetch } from './client';
import type { ResidentDashboard } from '@/types/dashboard';

export function getResidentDashboard() {
  return apiFetch<ResidentDashboard>('/api/resident/dashboard');
}
