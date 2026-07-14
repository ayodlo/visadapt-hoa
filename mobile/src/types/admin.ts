import type {
  IssueCategory,
  IssueStatus,
  IssuePriority,
  ArchitecturalRequestType,
  ArchitecturalRequestStatus,
  ViolationType,
  ViolationStatus,
  ViolationAppealStatus,
  AuthorRef,
} from './enums';
import type { UserRole } from './auth';

export interface AdminDashboard {
  totalResidents: number;
  unpaidBalanceCents: number;
  delinquentAccounts: number;
  openIssues: number;
  overdueIssues: number;
  issuesByCategory: { category: IssueCategory; count: number }[];
  issuesByStatus: { status: IssueStatus; count: number }[];
  avgResolutionDays: number | null;
  openArchRequests: number;
  openViolations: number;
  pendingAppeals: number;
  recentAnnouncements: { id: string; title: string; date: string }[];
  recentActivity: {
    id: string;
    action: string;
    details: string | null;
    createdAt: string;
    actorName: string | null;
    issueId: string;
    issueTitle: string;
  }[];
}

export interface AdminIssueListItem {
  id: string;
  residentId: string;
  propertyId: string | null;
  vendorId: string | null;
  assignedToId: string | null;
  category: IssueCategory;
  title: string;
  description: string;
  location: string;
  priority: IssuePriority;
  status: IssueStatus;
  preferredContactMethod: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  resident: { id: string; firstName: string; lastName: string };
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  vendor: { id: string; name: string } | null;
  _count: { comments: number };
}

export interface AdminIssuesPage {
  issues: AdminIssueListItem[];
  total: number;
  totalPages: number;
  page: number;
}

export interface AdminIssueDetail {
  id: string;
  residentId: string;
  propertyId: string | null;
  vendorId: string | null;
  assignedToId: string | null;
  category: IssueCategory;
  title: string;
  description: string;
  location: string;
  priority: IssuePriority;
  status: IssueStatus;
  preferredContactMethod: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  resident: { id: string; firstName: string; lastName: string; email: string };
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  vendor: { id: string; name: string; contactName: string | null; phone: string | null } | null;
  comments: { id: string; body: string; isInternal: boolean; createdAt: string; author: AuthorRef }[];
  activities: { id: string; action: string; details: string | null; createdAt: string; actor: AuthorRef | null }[];
}

export interface AdminIssuePatchInput {
  status?: IssueStatus;
  priority?: IssuePriority;
  assignedToId?: string | null;
  vendorId?: string | null;
  dueDate?: string | null;
}

export interface AdminVendorOption {
  id: string;
  name: string;
  contactName: string | null;
  category: string | null;
}

export interface CreateVendorInput {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  category?: string;
  notes?: string;
}

// BoardViolationListItem/BoardViolationsPage in ./board.ts have the exact
// same shape as the admin list response (both hit GET /api/admin/violations)
// — reused rather than redefined.

export interface CreateViolationInput {
  residentId: string;
  propertyId?: string;
  violationType: ViolationType;
  ruleCitation: string;
  description: string;
  observedAt: string;
  deadline?: string;
  resolutionSteps?: string;
  sendNow?: boolean;
}

export interface AdminUserListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'BOARD_MEMBER' | 'RESIDENT';
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  role?: 'ADMIN' | 'BOARD_MEMBER' | 'RESIDENT';
}

export interface IssuesReport {
  summary: {
    overdueCount: number;
    unassignedCount: number;
    createdLast30Days: number;
    resolvedLast30Days: number;
    avgResolutionDays: number | null;
  };
  byStatus: { status: IssueStatus; count: number }[];
  byCategory: { category: IssueCategory; count: number }[];
  byPriority: { priority: IssuePriority; count: number }[];
}

export interface PaymentsReport {
  summary: {
    totalBilledCents: number;
    totalPendingCents: number;
    totalOverdueCents: number;
    totalPaidCents: number;
    totalCollectedCents: number;
    outstandingCents: number;
    delinquentAccounts: number;
    totalCharges: number;
    totalPayments: number;
  };
  byStatus: { status: string; count: number; amountCents: number }[];
  recentPayments: {
    id: string;
    amount: number;
    paymentMethod: string;
    status: string;
    paidAt: string | null;
    createdAt: string;
    confirmationNumber: string | null;
    residentName: string;
    residentEmail: string;
  }[];
}

export interface ArchRequestsReport {
  summary: {
    submittedLast30Days: number;
    decidedLast30Days: number;
    avgDecisionDays: number | null;
  };
  byStatus: { status: ArchitecturalRequestStatus; count: number }[];
  byType: { type: ArchitecturalRequestType; count: number }[];
}

export interface ViolationsReport {
  summary: {
    issuedLast30Days: number;
    resolvedLast30Days: number;
    pendingAppeals: number;
  };
  byStatus: { status: ViolationStatus; count: number }[];
  byType: { type: ViolationType; count: number }[];
  appeals: {
    byStatus: { status: ViolationAppealStatus; count: number }[];
  };
}
