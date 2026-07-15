import { render, fireEvent, act } from '@testing-library/react-native';
import AdminIssuesList from '../../../app/(admin)/issues/index';
import { listAdminIssues } from '@/api/admin';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';
import type { AdminIssueListItem } from '@/types/admin';

jest.mock('@/api/admin');
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockedListAdminIssues = listAdminIssues as jest.Mock;

function makeIssue(overrides: Partial<AdminIssueListItem> = {}): AdminIssueListItem {
  return {
    id: 'i1',
    residentId: 'r1',
    propertyId: null,
    vendorId: null,
    assignedToId: null,
    category: 'MAINTENANCE',
    title: 'Leaky faucet',
    description: 'Drips',
    location: 'Unit 4',
    priority: 'MEDIUM',
    status: 'SUBMITTED',
    preferredContactMethod: 'Email',
    dueDate: null,
    createdAt: '2026-07-14T12:00:00.000Z',
    updatedAt: '2026-07-14T12:00:00.000Z',
    resident: { id: 'r1', firstName: 'Demo', lastName: 'Resident' },
    assignedTo: null,
    vendor: null,
    _count: { comments: 0 },
    ...overrides,
  };
}

describe('AdminIssuesList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an empty state when no issues are found', async () => {
    mockedListAdminIssues.mockResolvedValue({ issues: [], total: 0, totalPages: 0, page: 1 });
    const { findByText } = await render(<AdminIssuesList />);
    expect(await findByText('No issues found')).toBeTruthy();
  });

  it('shows an error view on failure', async () => {
    mockedListAdminIssues.mockRejectedValue(new ApiError('Network error', 500));
    const { findByText } = await render(<AdminIssuesList />);
    expect(await findByText('Network error')).toBeTruthy();
  });

  it('renders an issue with the resident name and navigates on press', async () => {
    mockedListAdminIssues.mockResolvedValue({
      issues: [makeIssue({ id: 'i1', title: 'Leaky faucet' })],
      total: 1,
      totalPages: 1,
      page: 1,
    });
    const { findByText } = await render(<AdminIssuesList />);
    await findByText('Leaky faucet');
    fireEvent.press(await findByText('Leaky faucet'));
    expect(router.push).toHaveBeenCalledWith('/issues/i1');
  });

  it('re-fetches when the search text changes', async () => {
    mockedListAdminIssues.mockResolvedValue({ issues: [], total: 0, totalPages: 0, page: 1 });
    const { getByPlaceholderText } = await render(<AdminIssuesList />);
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Search issues...'), 'faucet');
    });
    expect(mockedListAdminIssues).toHaveBeenLastCalledWith({ search: 'faucet', status: undefined });
  });
});
