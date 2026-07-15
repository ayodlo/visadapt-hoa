import { render, fireEvent, act } from '@testing-library/react-native';
import BoardViolationsList from '../../../app/(board)/violations/index';
import { listAdminViolations } from '@/api/board';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';
import type { BoardViolationListItem } from '@/types/board';

jest.mock('@/api/board');
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockedListAdminViolations = listAdminViolations as jest.Mock;

function makeViolation(overrides: Partial<BoardViolationListItem> = {}): BoardViolationListItem {
  return {
    id: 'v1',
    violationType: 'NOISE',
    status: 'ESCALATED',
    description: 'Loud music',
    observedAt: '2026-07-10T00:00:00.000Z',
    deadline: null,
    createdAt: '2026-07-10T00:00:00.000Z',
    resident: { id: 'r1', firstName: 'Demo', lastName: 'Resident' },
    property: { streetAddress: '123 Main St', unitNumber: null },
    appeal: null,
    _count: { comments: 0 },
    ...overrides,
  };
}

describe('BoardViolationsList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('defaults to the escalated filter', async () => {
    mockedListAdminViolations.mockResolvedValue({ violations: [], total: 0, totalPages: 0, page: 1 });
    await render(<BoardViolationsList />);
    expect(mockedListAdminViolations).toHaveBeenCalledWith({ status: 'ESCALATED' });
  });

  it('switches to the appeals filter', async () => {
    mockedListAdminViolations.mockResolvedValue({ violations: [], total: 0, totalPages: 0, page: 1 });
    const { getByText } = await render(<BoardViolationsList />);

    await act(async () => {
      fireEvent.press(getByText('Appeals'));
    });

    expect(mockedListAdminViolations).toHaveBeenLastCalledWith({ hasAppeal: true });
  });

  it('shows an empty state when there is nothing here', async () => {
    mockedListAdminViolations.mockResolvedValue({ violations: [], total: 0, totalPages: 0, page: 1 });
    const { findByText } = await render(<BoardViolationsList />);
    expect(await findByText('Nothing here right now')).toBeTruthy();
  });

  it('shows an error view on failure', async () => {
    mockedListAdminViolations.mockRejectedValue(new ApiError('Network error', 500));
    const { findByText } = await render(<BoardViolationsList />);
    expect(await findByText('Network error')).toBeTruthy();
  });

  it('renders a violation and navigates to its detail screen on press', async () => {
    mockedListAdminViolations.mockResolvedValue({
      violations: [makeViolation({ id: 'v1', resident: { id: 'r1', firstName: 'Demo', lastName: 'Resident' } })],
      total: 1,
      totalPages: 1,
      page: 1,
    });
    const { findByText } = await render(<BoardViolationsList />);
    const row = await findByText(/Demo Resident/);
    fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith('/violations/v1');
  });
});
