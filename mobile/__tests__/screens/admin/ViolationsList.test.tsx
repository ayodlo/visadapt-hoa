import { render, fireEvent, act } from '@testing-library/react-native';
import AdminViolationsList from '../../../app/(admin)/violations/index';
import { listAdminViolations } from '@/api/board';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';
import type { BoardViolationListItem } from '@/types/board';

jest.mock('@/api/board');
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
}));

const mockedListAdminViolations = listAdminViolations as jest.Mock;

function makeViolation(overrides: Partial<BoardViolationListItem> = {}): BoardViolationListItem {
  return {
    id: 'v1',
    violationType: 'NOISE',
    status: 'NOTICE_SENT',
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

describe('AdminViolationsList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an empty state when no violations are found', async () => {
    mockedListAdminViolations.mockResolvedValue({ violations: [], total: 0, totalPages: 0, page: 1 });
    const { findByText } = await render(<AdminViolationsList />);
    expect(await findByText('No violations found')).toBeTruthy();
  });

  it('shows an error view on failure', async () => {
    mockedListAdminViolations.mockRejectedValue(new ApiError('Network error', 500));
    const { findByText } = await render(<AdminViolationsList />);
    expect(await findByText('Network error')).toBeTruthy();
  });

  it('renders a violation with the resident name and navigates on press', async () => {
    mockedListAdminViolations.mockResolvedValue({
      violations: [makeViolation({ id: 'v1' })],
      total: 1,
      totalPages: 1,
      page: 1,
    });
    const { findByText } = await render(<AdminViolationsList />);
    const row = await findByText(/Demo Resident/);
    fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith('/violations/v1');
  });

  it('re-fetches when a status filter is selected', async () => {
    mockedListAdminViolations.mockResolvedValue({ violations: [], total: 0, totalPages: 0, page: 1 });
    const { getByText } = await render(<AdminViolationsList />);

    await act(async () => {
      fireEvent.press(getByText('Escalated'));
    });

    expect(mockedListAdminViolations).toHaveBeenLastCalledWith({ search: undefined, status: 'ESCALATED' });
  });
});
