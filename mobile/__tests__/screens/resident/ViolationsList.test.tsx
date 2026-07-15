import { render, fireEvent } from '@testing-library/react-native';
import ViolationsList from '../../../app/(resident)/more/violations/index';
import { listMyViolations } from '@/api/violations';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';
import type { ViolationSummary } from '@/types/violations';

jest.mock('@/api/violations');
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockedListMyViolations = listMyViolations as jest.Mock;

function makeViolation(overrides: Partial<ViolationSummary> = {}): ViolationSummary {
  return {
    id: 'v1',
    residentId: 'r1',
    propertyId: null,
    createdById: 'admin1',
    violationType: 'NOISE',
    ruleCitation: 'Section 4.2',
    description: 'Loud music',
    observedAt: '2026-07-10T00:00:00.000Z',
    deadline: null,
    status: 'NOTICE_SENT',
    resolutionSteps: null,
    evidenceUrl: null,
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    property: null,
    appeal: null,
    _count: { comments: 0 },
    ...overrides,
  };
}

describe('ViolationsList (resident)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an empty state when there are no violations', async () => {
    mockedListMyViolations.mockResolvedValue({ violations: [] });
    const { findByText } = await render(<ViolationsList />);
    expect(await findByText('No violations on record')).toBeTruthy();
  });

  it('shows an error view on failure', async () => {
    mockedListMyViolations.mockRejectedValue(new ApiError('Network error', 500));
    const { findByText } = await render(<ViolationsList />);
    expect(await findByText('Network error')).toBeTruthy();
  });

  it('renders a violation and navigates to its detail screen on press', async () => {
    mockedListMyViolations.mockResolvedValue({ violations: [makeViolation({ id: 'v1', violationType: 'NOISE' })] });
    const { findByText, getByText } = await render(<ViolationsList />);
    await findByText('Noise');
    fireEvent.press(getByText('Noise'));
    expect(router.push).toHaveBeenCalledWith('/more/violations/v1');
  });
});
