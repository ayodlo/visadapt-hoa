import { render, fireEvent, act } from '@testing-library/react-native';
import { PollDetailScreen } from '@/screens/shared/PollDetailScreen';
import { listPolls, voteInPoll } from '@/api/polls';
import { ApiError } from '@/api/client';
import type { Poll } from '@/types/polls';

jest.mock('@/api/polls');
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'p1' }) }));

const mockedListPolls = listPolls as jest.Mock;
const mockedVote = voteInPoll as jest.Mock;

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
    options: [
      { id: 'o1', pollId: 'p1', text: 'Yes', _count: { votes: 3 } },
      { id: 'o2', pollId: 'p1', text: 'No', _count: { votes: 1 } },
    ],
    _count: { votes: 4 },
    ...overrides,
  };
}

describe('PollDetailScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the question and options without percentages before voting', async () => {
    mockedListPolls.mockResolvedValue([makePoll()]);
    const { findByText, queryByText } = await render(<PollDetailScreen />);
    expect(await findByText('Should we repaint the clubhouse?')).toBeTruthy();
    expect(await findByText('Yes')).toBeTruthy();
    expect(queryByText('75%')).toBeNull();
  });

  it('shows "Poll not found." when no poll matches the id', async () => {
    mockedListPolls.mockResolvedValue([makePoll({ id: 'different-id' })]);
    const { findByText } = await render(<PollDetailScreen />);
    expect(await findByText('Poll not found.')).toBeTruthy();
  });

  it('casts a vote and shows percentages afterward', async () => {
    mockedListPolls.mockResolvedValueOnce([makePoll()]);
    mockedVote.mockResolvedValue({ id: 'v1', pollId: 'p1', optionId: 'o1', userId: 'u1', createdAt: '2026-07-14T12:00:00.000Z' });
    mockedListPolls.mockResolvedValueOnce([
      makePoll({ options: [
        { id: 'o1', pollId: 'p1', text: 'Yes', _count: { votes: 4 } },
        { id: 'o2', pollId: 'p1', text: 'No', _count: { votes: 1 } },
      ], _count: { votes: 5 } }),
    ]);

    const { findByText, getByText } = await render(<PollDetailScreen />);
    await findByText('Yes');

    await act(async () => {
      fireEvent.press(getByText('Yes'));
    });

    expect(mockedVote).toHaveBeenCalledWith('p1', 'o1');
    expect(await findByText('80%')).toBeTruthy();
  });

  it('marks the poll as already voted on a 409 conflict', async () => {
    mockedListPolls.mockResolvedValue([makePoll()]);
    mockedVote.mockRejectedValue(new ApiError('Already voted', 409));

    const { findByText, getByText } = await render(<PollDetailScreen />);
    await findByText('Yes');

    await act(async () => {
      fireEvent.press(getByText('Yes'));
    });

    expect(await findByText('You have already voted in this poll.')).toBeTruthy();
  });

  it('shows a closed message and does not allow voting once closed', async () => {
    mockedListPolls.mockResolvedValue([makePoll({ closesAt: '2020-01-01T00:00:00.000Z' })]);
    const { findByText } = await render(<PollDetailScreen />);
    expect(await findByText('This poll is closed.')).toBeTruthy();
    expect(await findByText('75%')).toBeTruthy();
  });
});
