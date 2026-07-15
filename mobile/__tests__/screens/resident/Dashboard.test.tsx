import { render, fireEvent } from '@testing-library/react-native';
import ResidentDashboard from '../../../app/(resident)/index';
import { useAuth } from '@/auth/AuthContext';
import { getResidentDashboard } from '@/api/dashboard';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';
import type { ResidentDashboard as ResidentDashboardData } from '@/types/dashboard';

jest.mock('@/auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/api/dashboard');
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockedUseAuth = useAuth as jest.Mock;
const mockedGetDashboard = getResidentDashboard as jest.Mock;

function makeDashboard(overrides: Partial<ResidentDashboardData> = {}): ResidentDashboardData {
  return {
    balanceCents: 0,
    nextDueDateLabel: null,
    nextDueAmountCents: null,
    openIssues: 0,
    openArchRequests: 0,
    activeViolations: [],
    recentAnnouncements: [],
    ...overrides,
  };
}

describe('ResidentDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({ user: { firstName: 'Demo' } });
  });

  it('greets the user by first name', async () => {
    mockedGetDashboard.mockResolvedValue(makeDashboard());
    const { findByText } = await render(<ResidentDashboard />);
    expect(await findByText('Welcome, Demo')).toBeTruthy();
  });

  it('shows an error view on failure', async () => {
    mockedGetDashboard.mockRejectedValue(new ApiError('Network error', 500));
    const { findByText } = await render(<ResidentDashboard />);
    expect(await findByText('Network error')).toBeTruthy();
  });

  it('highlights the balance in danger color and navigates to payments on press', async () => {
    mockedGetDashboard.mockResolvedValue(makeDashboard({ balanceCents: 15000 }));
    const { findByText, getByText } = await render(<ResidentDashboard />);
    const balanceText = await findByText('$150.00');
    expect(balanceText.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: expect.any(String) })])
    );
    fireEvent.press(getByText('Current Balance'));
    expect(router.push).toHaveBeenCalledWith('/payments');
  });

  it('shows an empty state when there are no active violations', async () => {
    mockedGetDashboard.mockResolvedValue(makeDashboard({ activeViolations: [] }));
    const { findByText } = await render(<ResidentDashboard />);
    expect(await findByText('No active violations')).toBeTruthy();
  });

  it('renders active violations and navigates on press', async () => {
    mockedGetDashboard.mockResolvedValue(
      makeDashboard({ activeViolations: [{ id: 'v1', violationType: 'NOISE', status: 'NOTICE_SENT', date: 'Jul 10, 2026' }] })
    );
    const { findByText, getByText } = await render(<ResidentDashboard />);
    await findByText('Noise');
    fireEvent.press(getByText('Noise'));
    expect(router.push).toHaveBeenCalledWith('/more/violations/v1');
  });
});
