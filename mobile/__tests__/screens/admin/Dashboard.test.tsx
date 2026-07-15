import { render, fireEvent } from '@testing-library/react-native';
import AdminDashboard from '../../../app/(admin)/index';
import { useAuth } from '@/auth/AuthContext';
import { getAdminDashboard } from '@/api/admin';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';
import type { AdminDashboard as AdminDashboardData } from '@/types/admin';

jest.mock('@/auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/api/admin');
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockedUseAuth = useAuth as jest.Mock;
const mockedGetAdminDashboard = getAdminDashboard as jest.Mock;

function makeDashboard(overrides: Partial<AdminDashboardData> = {}): AdminDashboardData {
  return {
    totalResidents: 0,
    unpaidBalanceCents: 0,
    delinquentAccounts: 0,
    openIssues: 0,
    overdueIssues: 0,
    issuesByCategory: [],
    issuesByStatus: [],
    avgResolutionDays: null,
    openArchRequests: 0,
    openViolations: 0,
    pendingAppeals: 0,
    recentAnnouncements: [],
    recentActivity: [],
    ...overrides,
  };
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({ user: { firstName: 'Admin' } });
  });

  it('greets the user by first name', async () => {
    mockedGetAdminDashboard.mockResolvedValue(makeDashboard());
    const { findByText } = await render(<AdminDashboard />);
    expect(await findByText('Welcome, Admin')).toBeTruthy();
  });

  it('shows an error view on failure', async () => {
    mockedGetAdminDashboard.mockRejectedValue(new ApiError('Network error', 500));
    const { findByText } = await render(<AdminDashboard />);
    expect(await findByText('Network error')).toBeTruthy();
  });

  it('navigates to issues when the Open Issues card is pressed', async () => {
    mockedGetAdminDashboard.mockResolvedValue(makeDashboard({ openIssues: 3 }));
    const { findByText, getByText } = await render(<AdminDashboard />);
    await findByText('Open Issues');
    fireEvent.press(getByText('Open Issues'));
    expect(router.push).toHaveBeenCalledWith('/issues');
  });

  it('renders issues-by-status counts', async () => {
    mockedGetAdminDashboard.mockResolvedValue(makeDashboard({ issuesByStatus: [{ status: 'SUBMITTED', count: 5 }] }));
    const { findByText } = await render(<AdminDashboard />);
    expect(await findByText('Submitted')).toBeTruthy();
    expect(await findByText('5')).toBeTruthy();
  });

  it('navigates to the issue on recent activity press', async () => {
    mockedGetAdminDashboard.mockResolvedValue(
      makeDashboard({
        recentActivity: [
          { id: 'a1', action: 'status_changed', details: null, createdAt: '2026-07-14T12:00:00.000Z', actorName: 'Admin User', issueId: 'i1', issueTitle: 'Leaky faucet' },
        ],
      })
    );
    const { findByText } = await render(<AdminDashboard />);
    const row = await findByText(/Leaky faucet/);
    fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith('/issues/i1');
  });
});
