import type { ArchitecturalRequestType, ArchitecturalRequestStatus, AuthorRef } from './enums';

export interface ArchRequestSummary {
  id: string;
  residentId: string;
  propertyId: string | null;
  requestType: ArchitecturalRequestType;
  description: string;
  desiredStartDate: string | null;
  status: ArchitecturalRequestStatus;
  governingRuleReference: string | null;
  decisionReason: string | null;
  createdAt: string;
  updatedAt: string;
  property: { streetAddress: string; unitNumber: string | null } | null;
  _count: { comments: number };
}

export interface ArchRequestComment {
  id: string;
  requestId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  author: AuthorRef;
}

export interface ArchRequestActivity {
  id: string;
  requestId: string;
  actorId: string | null;
  action: string;
  details: string | null;
  createdAt: string;
  actor: AuthorRef | null;
}

export interface ArchRequestDetail {
  id: string;
  residentId: string;
  propertyId: string | null;
  requestType: ArchitecturalRequestType;
  description: string;
  desiredStartDate: string | null;
  status: ArchitecturalRequestStatus;
  governingRuleReference: string | null;
  decisionReason: string | null;
  createdAt: string;
  updatedAt: string;
  resident: { id: string; firstName: string; lastName: string; email: string };
  property: { streetAddress: string; unitNumber: string | null; city: string; state: string } | null;
  comments: ArchRequestComment[];
  activities: ArchRequestActivity[];
  attachments: { id: string; requestId: string; label: string; fileName: string | null; createdAt: string }[];
}

export interface CreateArchRequestInput {
  requestType: ArchitecturalRequestType;
  description: string;
  desiredStartDate?: string | null;
  propertyId?: string;
  submitNow?: boolean;
}
