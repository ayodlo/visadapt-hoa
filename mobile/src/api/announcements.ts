import { apiFetch } from './client';
import type { Announcement } from '@/types/announcements';

export function listAnnouncements() {
  return apiFetch<{ announcements: Announcement[] }>('/api/announcements');
}

export function getAnnouncement(id: string) {
  return apiFetch<{ announcement: Announcement }>(`/api/announcements/${id}`);
}

export function markAnnouncementRead(id: string) {
  return apiFetch<{ read: true }>(`/api/announcements/${id}/read`, { method: 'POST' });
}
