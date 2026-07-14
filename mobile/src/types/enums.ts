// Hand-written mirror of nextjs/prisma/schema.prisma enums. Kept in sync
// manually — see plan notes on deferring a shared types package.
export type IssueCategory =
  | 'LANDSCAPING' | 'MAINTENANCE' | 'PARKING' | 'SAFETY' | 'NOISE' | 'GATE_ACCESS' | 'TRASH' | 'OTHER';
export type IssueStatus =
  | 'SUBMITTED' | 'UNDER_REVIEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_ON_VENDOR' | 'RESOLVED' | 'CLOSED';
export type IssuePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type AnnouncementPriority = 'NORMAL' | 'IMPORTANT' | 'EMERGENCY';
export type AnnouncementAudience = 'ALL_RESIDENTS' | 'BOARD_MEMBERS' | 'SPECIFIC_LOCATION';

export type DocumentCategory =
  | 'CC_AND_RS' | 'RULES_AND_REGS' | 'MEETING_MINUTES' | 'FINANCIALS' | 'INSURANCE' | 'COMMUNITY_FORMS' | 'MAINTENANCE' | 'OTHER';

export type ChargeStatus = 'PENDING' | 'PAID' | 'OVERDUE';
export type PaymentStatus = 'PAID' | 'PENDING' | 'FAILED';

export type ArchitecturalRequestType = 'FENCE' | 'EXTERIOR_PAINT' | 'LANDSCAPING' | 'SOLAR' | 'ROOF' | 'SHED' | 'OTHER';
export type ArchitecturalRequestStatus =
  | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'NEEDS_MORE_INFORMATION' | 'APPROVED' | 'DENIED' | 'WITHDRAWN';

export type ViolationType =
  | 'LANDSCAPING_MAINTENANCE' | 'PARKING' | 'NOISE' | 'PROPERTY_APPEARANCE'
  | 'UNAUTHORIZED_MODIFICATION' | 'PET_VIOLATION' | 'TRASH_AND_DEBRIS' | 'OTHER';
export type ViolationStatus =
  | 'DRAFT' | 'NOTICE_SENT' | 'RESIDENT_RESPONDED' | 'UNDER_REVIEW' | 'RESOLVED' | 'ESCALATED' | 'CLOSED';
export type ViolationAppealStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'DENIED' | 'WITHDRAWN';

export interface AuthorRef {
  firstName: string;
  lastName: string;
  role: import('./auth').UserRole;
}
