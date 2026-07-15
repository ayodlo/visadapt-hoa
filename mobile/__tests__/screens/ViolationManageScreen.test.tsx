import { render, fireEvent, act } from '@testing-library/react-native';
import { ViolationManageScreen } from '@/screens/shared/ViolationManageScreen';
import { getAdminViolation, updateAdminViolation, decideAppeal } from '@/api/board';
import { ApiError } from '@/api/client';
import type { ViolationDetail } from '@/types/violations';

jest.mock('@/api/board');
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'v1' }) }));

const mockedGetAdminViolation = getAdminViolation as jest.Mock;
const mockedUpdateAdminViolation = updateAdminViolation as jest.Mock;
const mockedDecideAppeal = decideAppeal as jest.Mock;

const STATUS_CHOICES = [
  { value: '' as const, label: 'No change' },
  { value: 'RESOLVED' as const, label: 'Resolved' },
  { value: 'CLOSED' as const, label: 'Closed' },
];

function makeViolation(overrides: Partial<ViolationDetail> = {}): ViolationDetail {
  return {
    id: 'v1',
    residentId: 'r1',
    propertyId: null,
    createdById: 'admin1',
    violationType: 'NOISE',
    ruleCitation: 'Section 4.2',
    description: 'Loud music after 10pm',
    observedAt: '2026-07-10T00:00:00.000Z',
    deadline: null,
    status: 'NOTICE_SENT',
    resolutionSteps: null,
    evidenceUrl: null,
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    resident: { id: 'r1', firstName: 'Demo', lastName: 'Resident', email: 'r@communityhq.local' },
    property: null,
    createdBy: { firstName: 'Admin', lastName: 'User' },
    comments: [],
    activities: [],
    appeal: null,
    ...overrides,
  };
}

describe('ViolationManageScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the violation type, resident, and description', async () => {
    mockedGetAdminViolation.mockResolvedValue({ violation: makeViolation() });
    const { findByText } = await render(<ViolationManageScreen statusChoices={STATUS_CHOICES} />);
    expect(await findByText('Noise')).toBeTruthy();
    expect(await findByText(/Demo Resident/)).toBeTruthy();
    expect(await findByText('Loud music after 10pm')).toBeTruthy();
  });

  it('does not render an appeal section when there is no appeal', async () => {
    mockedGetAdminViolation.mockResolvedValue({ violation: makeViolation({ appeal: null }) });
    const { findByText, queryByText } = await render(<ViolationManageScreen statusChoices={STATUS_CHOICES} />);
    await findByText('Noise');
    expect(queryByText('Appeal')).toBeNull();
  });

  it('renders the appeal section and decides it when one exists', async () => {
    mockedGetAdminViolation.mockResolvedValue({
      violation: makeViolation({
        appeal: {
          id: 'ap1',
          violationId: 'v1',
          submittedById: 'r1',
          reason: 'I was not home',
          status: 'SUBMITTED',
          outcome: null,
          reviewedById: null,
          reviewedAt: null,
          createdAt: '2026-07-11T00:00:00.000Z',
          updatedAt: '2026-07-11T00:00:00.000Z',
        },
      }),
    });
    mockedDecideAppeal.mockResolvedValue({ appeal: {} });

    const { findByText, getByText } = await render(<ViolationManageScreen statusChoices={STATUS_CHOICES} />);
    expect(await findByText('I was not home')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Save Appeal Decision'));
    });

    expect(mockedDecideAppeal).toHaveBeenCalledWith('v1', { status: 'UNDER_REVIEW', outcome: undefined });
  });

  it('saves a status update and shows a confirmation', async () => {
    mockedGetAdminViolation.mockResolvedValue({ violation: makeViolation() });
    mockedUpdateAdminViolation.mockResolvedValue({ violation: makeViolation({ status: 'RESOLVED' }) });

    const { findByText, getByText } = await render(<ViolationManageScreen statusChoices={STATUS_CHOICES} />);
    await findByText('Noise');

    await act(async () => {
      fireEvent.press(getByText('Resolved'));
    });
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });

    expect(mockedUpdateAdminViolation).toHaveBeenCalledWith('v1', { status: 'RESOLVED' });
    expect(getByText('Saved.')).toBeTruthy();
  });

  it('shows an error message when saving the status update fails', async () => {
    mockedGetAdminViolation.mockResolvedValue({ violation: makeViolation() });
    mockedUpdateAdminViolation.mockRejectedValue(new ApiError('Failed to update', 500));

    const { findByText, getByText } = await render(<ViolationManageScreen statusChoices={STATUS_CHOICES} />);
    await findByText('Noise');

    await act(async () => {
      fireEvent.press(getByText('Resolved'));
    });
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });

    expect(getByText('Failed to update')).toBeTruthy();
  });
});
