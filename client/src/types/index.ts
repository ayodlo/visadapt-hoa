export type UserRole = 'ADMIN' | 'BOARD_MEMBER' | 'RESIDENT';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementAuthor {
  id: string;
  name: string;
  role: UserRole;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  author: AnnouncementAuthor;
  createdAt: string;
  updatedAt: string;
}

export type RequestStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type RequestPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  status: RequestStatus;
  priority: RequestPriority;
  submittedBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface CommunityEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt?: string;
  createdBy: { id: string; name: string };
  createdAt: string;
}

export interface PollOption {
  id: string;
  text: string;
  voteCount: number;
}

export interface Poll {
  id: string;
  question: string;
  description?: string;
  closesAt?: string;
  createdBy: { id: string; name: string };
  options: PollOption[];
  myVote: string | null;
  totalVotes: number;
  createdAt: string;
}

export type DuesStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED';

export interface DuesRecord {
  id: string;
  label: string;
  amountCents: number;
  dueDate: string;
  status: DuesStatus;
  paidAt?: string;
  notes?: string;
  user: { id: string; name: string; email: string };
  createdAt: string;
}

export type DocumentCategory = 'GENERAL' | 'MEETING_MINUTES' | 'RULES_AND_BYLAWS' | 'FINANCIALS' | 'FORMS';

export interface CommunityDocument {
  id: string;
  name: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  category: DocumentCategory;
  uploadedBy: { id: string; name: string };
  createdAt: string;
}

export interface ApiError {
  error: string;
}
