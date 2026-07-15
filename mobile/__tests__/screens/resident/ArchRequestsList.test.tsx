import { render, fireEvent } from '@testing-library/react-native';
import ArchRequestsList from '../../../app/(resident)/more/architectural-requests/index';
import { listMyArchRequests } from '@/api/architecturalRequests';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';
import type { ArchRequestSummary } from '@/types/architecturalRequests';

jest.mock('@/api/architecturalRequests');
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
}));

const mockedListMyArchRequests = listMyArchRequests as jest.Mock;

function makeRequest(overrides: Partial<ArchRequestSummary> = {}): ArchRequestSummary {
  return {
    id: 'ar1',
    residentId: 'r1',
    propertyId: null,
    requestType: 'FENCE',
    description: 'New fence',
    desiredStartDate: null,
    status: 'SUBMITTED',
    governingRuleReference: null,
    decisionReason: null,
    createdAt: '2026-07-14T12:00:00.000Z',
    updatedAt: '2026-07-14T12:00:00.000Z',
    property: null,
    _count: { comments: 0 },
    ...overrides,
  };
}

describe('ArchRequestsList (resident)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an empty state when there are no requests', async () => {
    mockedListMyArchRequests.mockResolvedValue({ requests: [] });
    const { findByText } = await render(<ArchRequestsList />);
    expect(await findByText(/No architectural requests yet/)).toBeTruthy();
  });

  it('shows an error view on failure', async () => {
    mockedListMyArchRequests.mockRejectedValue(new ApiError('Network error', 500));
    const { findByText } = await render(<ArchRequestsList />);
    expect(await findByText('Network error')).toBeTruthy();
  });

  it('renders a request and navigates to its detail screen on press', async () => {
    mockedListMyArchRequests.mockResolvedValue({ requests: [makeRequest({ id: 'ar1', requestType: 'FENCE' })] });
    const { findByText, getByText } = await render(<ArchRequestsList />);
    await findByText('Fence');
    fireEvent.press(getByText('Fence'));
    expect(router.push).toHaveBeenCalledWith('/more/architectural-requests/ar1');
  });
});
