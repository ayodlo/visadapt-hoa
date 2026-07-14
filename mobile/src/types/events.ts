export interface CommunityEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; firstName: string; lastName: string };
}
