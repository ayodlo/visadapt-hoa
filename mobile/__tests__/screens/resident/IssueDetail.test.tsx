import { render, fireEvent, act } from '@testing-library/react-native';
import IssueDetail from '../../../app/(resident)/issues/[id]';
import { getIssue, addIssueComment } from '@/api/issues';
import { ApiError } from '@/api/client';
import type { IssueDetail as IssueDetailData } from '@/types/issues';

jest.mock('@/api/issues');
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'i1' }) }));

const mockedGetIssue = getIssue as jest.Mock;
const mockedAddComment = addIssueComment as jest.Mock;

function makeIssue(overrides: Partial<IssueDetailData> = {}): IssueDetailData {
  return {
    id: 'i1',
    residentId: 'r1',
    propertyId: null,
    vendorId: null,
    assignedToId: null,
    category: 'MAINTENANCE',
    title: 'Leaky faucet',
    description: 'Kitchen faucet drips constantly',
    location: 'Unit 4',
    priority: 'MEDIUM',
    status: 'SUBMITTED',
    preferredContactMethod: 'Email',
    dueDate: null,
    createdAt: '2026-07-14T12:00:00.000Z',
    updatedAt: '2026-07-14T12:00:00.000Z',
    resident: { id: 'r1', firstName: 'Demo', lastName: 'Resident', email: 'r@communityhq.local' },
    assignedTo: null,
    vendor: null,
    comments: [],
    activities: [],
    ...overrides,
  };
}

describe('IssueDetail (resident)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the issue title, category, location, and description', async () => {
    mockedGetIssue.mockResolvedValue({ issue: makeIssue() });
    const { findByText } = await render(<IssueDetail />);
    expect(await findByText('Leaky faucet')).toBeTruthy();
    expect(await findByText('Kitchen faucet drips constantly')).toBeTruthy();
  });

  it('shows the assigned staff member and vendor when present', async () => {
    mockedGetIssue.mockResolvedValue({
      issue: makeIssue({
        assignedTo: { id: 'staff1', firstName: 'Staff', lastName: 'Member' },
        vendor: { id: 'v1', name: 'Acme Plumbing', contactName: null, phone: null },
      }),
    });
    const { findByText } = await render(<IssueDetail />);
    expect(await findByText(/Staff Member/)).toBeTruthy();
    expect(await findByText(/Acme Plumbing/)).toBeTruthy();
  });

  it('posts a comment and reloads', async () => {
    mockedGetIssue.mockResolvedValue({ issue: makeIssue() });
    mockedAddComment.mockResolvedValue({});
    const { findByText, getByPlaceholderText, getByText } = await render(<IssueDetail />);
    await findByText('Leaky faucet');

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Write a comment...'), 'Any updates?');
    });
    await act(async () => {
      fireEvent.press(getByText('Post Comment'));
    });

    expect(mockedAddComment).toHaveBeenCalledWith('i1', 'Any updates?');
    expect(mockedGetIssue).toHaveBeenCalledTimes(2);
  });

  it('shows an error message when posting a comment fails', async () => {
    mockedGetIssue.mockResolvedValue({ issue: makeIssue() });
    mockedAddComment.mockRejectedValue(new ApiError('Failed to post', 500));
    const { findByText, getByPlaceholderText, getByText } = await render(<IssueDetail />);
    await findByText('Leaky faucet');

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Write a comment...'), 'Any updates?');
    });
    await act(async () => {
      fireEvent.press(getByText('Post Comment'));
    });

    expect(getByText('Failed to post')).toBeTruthy();
  });
});
