import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import ArchRequestDetail from '../../../app/(resident)/more/architectural-requests/[id]';
import { getArchRequest, addArchRequestComment, withdrawArchRequest, submitArchRequest } from '@/api/architecturalRequests';
import { ApiError } from '@/api/client';
import type { ArchRequestDetail as ArchRequestDetailData } from '@/types/architecturalRequests';

jest.mock('@/api/architecturalRequests');
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'ar1' }) }));

const mockedGetArchRequest = getArchRequest as jest.Mock;
const mockedAddComment = addArchRequestComment as jest.Mock;
const mockedWithdraw = withdrawArchRequest as jest.Mock;
const mockedSubmit = submitArchRequest as jest.Mock;

function makeRequest(overrides: Partial<ArchRequestDetailData> = {}): ArchRequestDetailData {
  return {
    id: 'ar1',
    residentId: 'r1',
    propertyId: null,
    requestType: 'FENCE',
    description: 'New fence around the backyard',
    desiredStartDate: null,
    status: 'DRAFT',
    governingRuleReference: null,
    decisionReason: null,
    createdAt: '2026-07-14T12:00:00.000Z',
    updatedAt: '2026-07-14T12:00:00.000Z',
    resident: { id: 'r1', firstName: 'Demo', lastName: 'Resident', email: 'r@communityhq.local' },
    property: null,
    comments: [],
    activities: [],
    attachments: [],
    ...overrides,
  };
}

describe('ArchRequestDetail (resident)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the request type and description', async () => {
    mockedGetArchRequest.mockResolvedValue({ request: makeRequest() });
    const { findByText } = await render(<ArchRequestDetail />);
    expect(await findByText('Fence')).toBeTruthy();
    expect(await findByText('New fence around the backyard')).toBeTruthy();
  });

  it('shows a "Submit for Review" button only in DRAFT status', async () => {
    mockedGetArchRequest.mockResolvedValue({ request: makeRequest({ status: 'DRAFT' }) });
    const { findByText } = await render(<ArchRequestDetail />);
    expect(await findByText('Submit for Review')).toBeTruthy();
  });

  it('submits a draft for review', async () => {
    mockedGetArchRequest.mockResolvedValue({ request: makeRequest({ status: 'DRAFT' }) });
    mockedSubmit.mockResolvedValue({ request: makeRequest({ status: 'SUBMITTED' }) });
    const { findByText, getByText } = await render(<ArchRequestDetail />);
    await findByText('Submit for Review');

    await act(async () => {
      fireEvent.press(getByText('Submit for Review'));
    });

    expect(mockedSubmit).toHaveBeenCalledWith('ar1');
  });

  it('withdraws the request after confirming the alert', async () => {
    mockedGetArchRequest.mockResolvedValue({ request: makeRequest({ status: 'SUBMITTED' }) });
    mockedWithdraw.mockResolvedValue({ request: makeRequest({ status: 'WITHDRAWN' }) });
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Withdraw')?.onPress?.();
    });

    const { findByText, getByText } = await render(<ArchRequestDetail />);
    await findByText('Fence');

    await act(async () => {
      fireEvent.press(getByText('Withdraw'));
    });

    expect(mockedWithdraw).toHaveBeenCalledWith('ar1');
  });

  it('posts a comment when commentable', async () => {
    mockedGetArchRequest.mockResolvedValue({ request: makeRequest({ status: 'SUBMITTED' }) });
    mockedAddComment.mockResolvedValue({});
    const { findByText, getByPlaceholderText, getByText } = await render(<ArchRequestDetail />);
    await findByText('Fence');

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Write a comment...'), 'Any updates?');
    });
    await act(async () => {
      fireEvent.press(getByText('Post Comment'));
    });

    expect(mockedAddComment).toHaveBeenCalledWith('ar1', 'Any updates?');
  });

  it('shows an error message when withdrawing fails', async () => {
    mockedGetArchRequest.mockResolvedValue({ request: makeRequest({ status: 'SUBMITTED' }) });
    mockedWithdraw.mockRejectedValue(new ApiError('Failed to withdraw', 500));
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Withdraw')?.onPress?.();
    });

    const { findByText, getByText } = await render(<ArchRequestDetail />);
    await findByText('Fence');

    await act(async () => {
      fireEvent.press(getByText('Withdraw'));
    });

    expect(getByText('Failed to withdraw')).toBeTruthy();
  });
});
