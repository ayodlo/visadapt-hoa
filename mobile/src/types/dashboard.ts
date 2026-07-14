import type { ViolationType, ViolationStatus } from './enums';

export interface ResidentDashboard {
  balanceCents: number;
  nextDueDateLabel: string | null;
  nextDueAmountCents: number | null;
  openIssues: number;
  openArchRequests: number;
  activeViolations: {
    id: string;
    violationType: ViolationType;
    status: ViolationStatus;
    date: string;
  }[];
  recentAnnouncements: { id: string; title: string; date: string }[];
}
