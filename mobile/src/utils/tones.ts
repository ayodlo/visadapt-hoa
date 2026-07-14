import type { Tone } from '@/theme';
import type { IssueStatus, IssuePriority, ArchitecturalRequestStatus, ViolationStatus, ChargeStatus, PaymentStatus, AnnouncementPriority } from '@/types/enums';

export function issueStatusTone(status: IssueStatus): Tone {
  switch (status) {
    case 'RESOLVED':
    case 'CLOSED':
      return 'success';
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
      return 'warning';
    default:
      return 'info';
  }
}

export function issuePriorityTone(priority: IssuePriority): Tone {
  return priority === 'URGENT' || priority === 'HIGH' ? 'danger' : priority === 'MEDIUM' ? 'warning' : 'default';
}

export function archStatusTone(status: ArchitecturalRequestStatus): Tone {
  switch (status) {
    case 'APPROVED':
      return 'success';
    case 'DENIED':
    case 'WITHDRAWN':
      return 'danger';
    case 'NEEDS_MORE_INFORMATION':
      return 'warning';
    default:
      return 'info';
  }
}

export function violationStatusTone(status: ViolationStatus): Tone {
  switch (status) {
    case 'RESOLVED':
    case 'CLOSED':
      return 'success';
    case 'ESCALATED':
      return 'danger';
    case 'NOTICE_SENT':
      return 'warning';
    default:
      return 'info';
  }
}

export function chargeStatusTone(status: ChargeStatus): Tone {
  return status === 'PAID' ? 'success' : status === 'OVERDUE' ? 'danger' : 'warning';
}

export function paymentStatusTone(status: PaymentStatus): Tone {
  return status === 'PAID' ? 'success' : status === 'FAILED' ? 'danger' : 'warning';
}

export function announcementPriorityTone(priority: AnnouncementPriority): Tone {
  return priority === 'EMERGENCY' ? 'danger' : priority === 'IMPORTANT' ? 'warning' : 'default';
}
