import { render, fireEvent } from '@testing-library/react-native';
import IssuesList from '../../../app/(resident)/issues/index';
import { listMyIssues } from '@/api/issues';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';
import type { IssueSummary } from '@/types/issues';

jest.mock('@/api/issues');
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
}));

const mockedListMyIssues = listMyIssues as jest.Mock;

function makeIssue(overrides: Partial<IssueSummary> = {}): IssueSummary {
  return {
    id: 'i1',
    category: 'MAINTENANCE',
    title: 'Leaky faucet',
    location: 'Unit 4',
    priority: 'MEDIUM',
    status: 'SUBMITTED',
    createdAt: '2026-07-14T12:00:00.000Z',
    updatedAt: '2026-07-14T12:00:00.000Z',
    assignedTo: null,
    vendor: null,
    _count: { comments: 0 },
    ...overrides,
  };
}

describe('IssuesList (resident)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an empty state when there are no issues', async () => {
    mockedListMyIssues.mockResolvedValue({ issues: [] });
    const { findByText } = await render(<IssuesList />);
    expect(await findByText(/No issues reported yet/)).toBeTruthy();
  });

  it('shows an error view on failure', async () => {
    mockedListMyIssues.mockRejectedValue(new ApiError('Network error', 500));
    const { findByText } = await render(<IssuesList />);
    expect(await findByText('Network error')).toBeTruthy();
  });

  it('renders an issue and navigates to its detail screen on press', async () => {
    mockedListMyIssues.mockResolvedValue({ issues: [makeIssue({ id: 'i1', title: 'Leaky faucet' })] });
    const { findByText, getByText } = await render(<IssuesList />);
    await findByText('Leaky faucet');
    fireEvent.press(getByText('Leaky faucet'));
    expect(router.push).toHaveBeenCalledWith('/issues/i1');
  });
});
