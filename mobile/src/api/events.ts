import { apiFetch } from './client';
import type { CommunityEvent } from '@/types/events';

export function listEvents() {
  return apiFetch<CommunityEvent[]>('/api/events');
}
