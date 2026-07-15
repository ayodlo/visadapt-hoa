import { render, fireEvent } from '@testing-library/react-native';
import BoardDashboard from '../../../app/(board)/index';
import { useAuth } from '@/auth/AuthContext';
import { getBoardDashboard } from '@/api/board';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';
import type { BoardDashboard as BoardDashboardData } from '@/types/board';

jest.mock('@/auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/api/board');
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockedUseAuth = useAuth as jest.Mock;
const mockedGetBoardDashboard = getBoardDashboard as jest.Mock;

function makeDashboard(overrides: Partial<BoardDashboardData> = {}): BoardDashboardData {
  return {
    financialSummary: { totalBilledCents: 0, totalPaidCents: 0, outstandingCents: 0, delinquentAccounts: 0 },
    archRequestsNeedingReview: 0,
    violationsNeedingReview: 0,
    pendingAppeals: 0,
    decisionQueueCount: 0,
    openIssues: 0,
    resolvedThisMonth: 0,
    recentAnnouncements: [],
    ...overrides,
  };
}

describe('BoardDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({ user: { firstName: 'Board' } });
  });

  it('greets the user by first name', async () => {
    mockedGetBoardDashboard.mockResolvedValue(makeDashboard());
    const { findByText } = await render(<BoardDashboard />);
    expect(await findByText('Welcome, Board')).toBeTruthy();
  });

  it('shows an error view on failure', async () => {
    mockedGetBoardDashboard.mockRejectedValue(new ApiError('Network error', 500));
    const { findByText } = await render(<BoardDashboard />);
    expect(await findByText('Network error')).toBeTruthy();
  });

  it('shows an empty state when nothing needs review', async () => {
    mockedGetBoardDashboard.mockResolvedValue(makeDashboard({ decisionQueueCount: 0 }));
    const { findByText } = await render(<BoardDashboard />);
    expect(await findByText('Nothing needs your review right now')).toBeTruthy();
  });

  it('lists decision queue items and navigates to requests on press', async () => {
    mockedGetBoardDashboard.mockResolvedValue(
      makeDashboard({ decisionQueueCount: 1, archRequestsNeedingReview: 3 })
    );
    const { findByText, getByText } = await render(<BoardDashboard />);
    await findByText('Architectural Requests');
    fireEvent.press(getByText('Architectural Requests'));
    expect(router.push).toHaveBeenCalledWith('/requests');
  });
});
