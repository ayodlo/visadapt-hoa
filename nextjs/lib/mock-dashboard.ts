export interface MockAnnouncement {
  id: string;
  title: string;
  date: string;
}

export interface ResidentDashboardData {
  balanceCents: number;
  nextDueDateLabel: string;
  openIssues: number;
  openArchRequests: number;
  recentAnnouncements: MockAnnouncement[];
  recentViolations: { id: string; description: string; date: string }[];
}

export interface AdminDashboardData {
  totalResidents: number;
  unpaidBalanceCents: number;
  openIssues: number;
  overdueIssues: number;
  openArchRequests: number;
  openViolations: number;
  recentAnnouncements: MockAnnouncement[];
}

export interface BoardDashboardData {
  archRequestsNeedingReview: number;
  violationsNeedingReview: number;
  openIssues: number;
  resolvedThisMonth: number;
  recentAnnouncements: MockAnnouncement[];
  decisionQueueCount: number;
}

export const residentMock: ResidentDashboardData = {
  balanceCents: 25000,
  nextDueDateLabel: 'August 1, 2026',
  openIssues: 2,
  openArchRequests: 0,
  recentAnnouncements: [
    { id: '1', title: 'Pool closes for maintenance this weekend', date: 'Jun 20, 2026' },
    { id: '2', title: 'Annual HOA meeting — July 15 at 6 PM', date: 'Jun 15, 2026' },
    { id: '3', title: 'Parking lot resurfacing starts Monday', date: 'Jun 10, 2026' },
  ],
  recentViolations: [],
};

export const adminMock: AdminDashboardData = {
  totalResidents: 20,
  unpaidBalanceCents: 345000,
  openIssues: 7,
  overdueIssues: 2,
  openArchRequests: 3,
  openViolations: 1,
  recentAnnouncements: [
    { id: '1', title: 'Pool closes for maintenance this weekend', date: 'Jun 20, 2026' },
    { id: '2', title: 'Annual HOA meeting — July 15 at 6 PM', date: 'Jun 15, 2026' },
  ],
};

export const boardMock: BoardDashboardData = {
  archRequestsNeedingReview: 3,
  violationsNeedingReview: 1,
  openIssues: 7,
  resolvedThisMonth: 4,
  recentAnnouncements: [
    { id: '1', title: 'Pool closes for maintenance this weekend', date: 'Jun 20, 2026' },
    { id: '2', title: 'Annual HOA meeting — July 15 at 6 PM', date: 'Jun 15, 2026' },
  ],
  decisionQueueCount: 4,
};

export function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
