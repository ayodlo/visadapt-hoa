import type { ArchitecturalRequestType, ArchitecturalRequestStatus, ViolationType, ViolationStatus } from './enums';

export interface BoardDashboard {
  financialSummary: {
    totalBilledCents: number;
    totalPaidCents: number;
    outstandingCents: number;
    delinquentAccounts: number;
  };
  archRequestsNeedingReview: number;
  violationsNeedingReview: number;
  pendingAppeals: number;
  decisionQueueCount: number;
  openIssues: number;
  resolvedThisMonth: number;
  recentAnnouncements: { id: string; title: string; date: string }[];
}

export interface BoardArchRequestListItem {
  id: string;
  requestType: ArchitecturalRequestType;
  status: ArchitecturalRequestStatus;
  description: string;
  desiredStartDate: string | null;
  createdAt: string;
  resident: { id: string; firstName: string; lastName: string };
  property: { streetAddress: string; unitNumber: string | null } | null;
  _count: { comments: number };
}

export interface BoardArchRequestsPage {
  requests: BoardArchRequestListItem[];
  total: number;
  totalPages: number;
  page: number;
}

export interface BoardArchRequestDecisionInput {
  status?: 'UNDER_REVIEW' | 'NEEDS_MORE_INFORMATION' | 'APPROVED' | 'DENIED';
  governingRuleReference?: string | null;
  decisionReason?: string | null;
  comment?: string;
  isInternal?: boolean;
}

export interface BoardViolationListItem {
  id: string;
  violationType: ViolationType;
  status: ViolationStatus;
  description: string;
  observedAt: string;
  deadline: string | null;
  createdAt: string;
  resident: { id: string; firstName: string; lastName: string };
  property: { streetAddress: string; unitNumber: string | null } | null;
  appeal: { id: string; status: string } | null;
  _count: { comments: number };
}

export interface BoardViolationsPage {
  violations: BoardViolationListItem[];
  total: number;
  totalPages: number;
  page: number;
}

export interface ViolationStatusUpdateInput {
  status?: ViolationStatus;
  ruleCitation?: string;
  description?: string;
  deadline?: string | null;
  resolutionSteps?: string | null;
  evidenceUrl?: string | null;
  comment?: string;
  isInternal?: boolean;
}

export interface AppealDecisionInput {
  status: 'UNDER_REVIEW' | 'APPROVED' | 'DENIED' | 'WITHDRAWN';
  outcome?: string;
}
