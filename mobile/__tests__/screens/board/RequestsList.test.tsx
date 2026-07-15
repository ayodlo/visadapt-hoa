import { render, fireEvent, act } from '@testing-library/react-native';
import BoardArchRequestsList from '../../../app/(board)/requests/index';
import { listBoardArchRequests } from '@/api/board';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';
import type { BoardArchRequestListItem } from '@/types/board';

jest.mock('@/api/board');
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockedListBoardArchRequests = listBoardArchRequests as jest.Mock;

function makeRequest(overrides: Partial<BoardArchRequestListItem> = {}): BoardArchRequestListItem {
  return {
    id: 'ar1',
    requestType: 'FENCE',
    status: 'SUBMITTED',
    description: 'New fence',
    desiredStartDate: null,
    createdAt: '2026-07-14T12:00:00.000Z',
    resident: { id: 'r1', firstName: 'Demo', lastName: 'Resident' },
    property: { streetAddress: '123 Main St', unitNumber: null },
    _count: { comments: 0 },
    ...overrides,
  };
}

describe('BoardArchRequestsList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('defaults to the "Needs Review" filter, fetching SUBMITTED requests', async () => {
    mockedListBoardArchRequests.mockResolvedValue({ requests: [], total: 0, totalPages: 0, page: 1 });
    await render(<BoardArchRequestsList />);
    expect(mockedListBoardArchRequests).toHaveBeenCalledWith({ status: 'SUBMITTED' });
  });

  it('shows an empty state when there is nothing to review', async () => {
    mockedListBoardArchRequests.mockResolvedValue({ requests: [], total: 0, totalPages: 0, page: 1 });
    const { findByText } = await render(<BoardArchRequestsList />);
    expect(await findByText('No requests here right now')).toBeTruthy();
  });

  it('shows an error view on failure', async () => {
    mockedListBoardArchRequests.mockRejectedValue(new ApiError('Network error', 500));
    const { findByText } = await render(<BoardArchRequestsList />);
    expect(await findByText('Network error')).toBeTruthy();
  });

  it('renders a request with the resident name and navigates on press', async () => {
    mockedListBoardArchRequests.mockResolvedValue({
      requests: [makeRequest({ id: 'ar1', resident: { id: 'r1', firstName: 'Demo', lastName: 'Resident' } })],
      total: 1,
      totalPages: 1,
      page: 1,
    });
    const { findByText } = await render(<BoardArchRequestsList />);
    const row = await findByText(/Demo Resident/);
    fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith('/requests/ar1');
  });

  it('re-fetches all requests when the "All" filter is selected', async () => {
    mockedListBoardArchRequests.mockResolvedValue({ requests: [], total: 0, totalPages: 0, page: 1 });
    const { getByText } = await render(<BoardArchRequestsList />);

    await act(async () => {
      fireEvent.press(getByText('All'));
    });

    expect(mockedListBoardArchRequests).toHaveBeenLastCalledWith({});
  });
});
