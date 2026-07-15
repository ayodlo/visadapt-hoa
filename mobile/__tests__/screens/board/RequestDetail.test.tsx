import { render, fireEvent, act } from '@testing-library/react-native';
import BoardArchRequestDetail from '../../../app/(board)/requests/[id]';
import { getBoardArchRequest, decideBoardArchRequest } from '@/api/board';
import { ApiError } from '@/api/client';
import type { ArchRequestDetail } from '@/types/architecturalRequests';

jest.mock('@/api/board');
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'ar1' }) }));

const mockedGetBoardArchRequest = getBoardArchRequest as jest.Mock;
const mockedDecide = decideBoardArchRequest as jest.Mock;

function makeRequest(overrides: Partial<ArchRequestDetail> = {}): ArchRequestDetail {
  return {
    id: 'ar1',
    residentId: 'r1',
    propertyId: null,
    requestType: 'FENCE',
    description: 'New fence around the backyard',
    desiredStartDate: null,
    status: 'SUBMITTED',
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

describe('BoardArchRequestDetail', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the request type, resident, and description', async () => {
    mockedGetBoardArchRequest.mockResolvedValue({ request: makeRequest() });
    const { findByText } = await render(<BoardArchRequestDetail />);
    expect(await findByText('Fence')).toBeTruthy();
    expect(await findByText(/Demo Resident/)).toBeTruthy();
  });

  it('saves a decision with a status and reason', async () => {
    mockedGetBoardArchRequest.mockResolvedValue({ request: makeRequest() });
    mockedDecide.mockResolvedValue({ request: makeRequest({ status: 'APPROVED' }) });

    const { findByText, getByText, getByPlaceholderText } = await render(<BoardArchRequestDetail />);
    await findByText('Fence');

    await act(async () => {
      fireEvent.press(getByText('Approve'));
    });
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Explain the decision (shown to the resident)'), 'Meets all requirements');
    });
    await act(async () => {
      fireEvent.press(getByText('Save Decision'));
    });

    expect(mockedDecide).toHaveBeenCalledWith('ar1', { status: 'APPROVED', decisionReason: 'Meets all requirements' });
    expect(getByText('Saved.')).toBeTruthy();
  });

  it('shows an error message when saving fails', async () => {
    mockedGetBoardArchRequest.mockResolvedValue({ request: makeRequest() });
    mockedDecide.mockRejectedValue(new ApiError('Failed to save', 500));

    const { findByText, getByText } = await render(<BoardArchRequestDetail />);
    await findByText('Fence');

    await act(async () => {
      fireEvent.press(getByText('Approve'));
    });
    await act(async () => {
      fireEvent.press(getByText('Save Decision'));
    });

    expect(getByText('Failed to save')).toBeTruthy();
  });
});
