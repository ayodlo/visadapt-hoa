import type { ViolationType, ViolationStatus, ViolationAppealStatus, AuthorRef } from './enums';

export interface ViolationSummary {
  id: string;
  residentId: string;
  propertyId: string | null;
  createdById: string;
  violationType: ViolationType;
  ruleCitation: string | null;
  description: string;
  observedAt: string;
  deadline: string | null;
  status: ViolationStatus;
  resolutionSteps: string | null;
  evidenceUrl: string | null;
  createdAt: string;
  updatedAt: string;
  property: { streetAddress: string; unitNumber: string | null } | null;
  appeal: { id: string; status: ViolationAppealStatus } | null;
  _count: { comments: number };
}

export interface ViolationComment {
  id: string;
  violationId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  author?: AuthorRef; // absent on the /respond response, present elsewhere
}

export interface ViolationActivity {
  id: string;
  violationId: string;
  actorId: string | null;
  action: string;
  details: string | null;
  createdAt: string;
  actor: AuthorRef | null;
}

export interface ViolationAppeal {
  id: string;
  violationId: string;
  submittedById: string;
  reason: string;
  status: ViolationAppealStatus;
  outcome: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  submittedBy?: { firstName: string; lastName: string };
  reviewedBy?: { firstName: string; lastName: string } | null;
}

export interface ViolationDetail {
  id: string;
  residentId: string;
  propertyId: string | null;
  createdById: string;
  violationType: ViolationType;
  ruleCitation: string | null;
  description: string;
  observedAt: string;
  deadline: string | null;
  status: ViolationStatus;
  resolutionSteps: string | null;
  evidenceUrl: string | null;
  createdAt: string;
  updatedAt: string;
  resident: { id: string; firstName: string; lastName: string; email: string };
  property: { streetAddress: string; unitNumber: string | null; city: string; state: string } | null;
  createdBy: { firstName: string; lastName: string };
  comments: ViolationComment[];
  activities: ViolationActivity[];
  appeal: ViolationAppeal | null;
}
