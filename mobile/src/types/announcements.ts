import type { AnnouncementPriority, AnnouncementAudience } from './enums';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  targetLocation: string | null;
  isPinned: boolean;
  publishAt: string;
  expiresAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { firstName: string; lastName: string };
  isRead: boolean;
}
