import { render, fireEvent } from '@testing-library/react-native';
import { PollsListScreen } from '@/screens/shared/PollsListScreen';
import { listPolls } from '@/api/polls';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';
import type { Poll } from '@/types/polls';

jest.mock('@/api/polls');
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockedListPolls = listPolls as jest.Mock;

function makePoll(overrides: Partial<Poll> = {}): Poll {
  return {
    id: 'p1',
    question: 'Should we repaint the clubhouse?',
    description: null,
    closesAt: null,
    createdById: 'admin1',
    createdAt: '2026-07-14T12:00:00.000Z',
    updatedAt: '2026-07-14T12:00:00.000Z',
    createdBy: { id: 'admin1', firstName: 'Admin', lastName: 'User' },
    options: [],
    _count: { votes: 0 },
    ...overrides,
  };
}

describe('PollsListScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an empty state when there are no polls', async () => {
    mockedListPolls.mockResolvedValue([]);
    const { findByText } = await render(<PollsListScreen />);
    expect(await findByText('No polls right now')).toBeTruthy();
  });

  it('shows an error view on failure', async () => {
    mockedListPolls.mockRejectedValue(new ApiError('Network error', 500));
    const { findByText } = await render(<PollsListScreen />);
    expect(await findByText('Network error')).toBeTruthy();
  });

  it('pluralizes the vote count correctly', async () => {
    mockedListPolls.mockResolvedValue([makePoll({ id: 'p1', _count: { votes: 1 } }), makePoll({ id: 'p2', _count: { votes: 5 } })]);
    const { findByText } = await render(<PollsListScreen />);
    expect(await findByText(/^1 vote$/)).toBeTruthy();
    expect(await findByText(/^5 votes$/)).toBeTruthy();
  });

  it('navigates to the poll detail screen on press', async () => {
    mockedListPolls.mockResolvedValue([makePoll({ id: 'p1', question: 'Should we repaint the clubhouse?' })]);
    const { findByText, getByText } = await render(<PollsListScreen />);
    await findByText('Should we repaint the clubhouse?');
    fireEvent.press(getByText('Should we repaint the clubhouse?'));
    expect(router.push).toHaveBeenCalledWith('/more/polls/p1');
  });
});
