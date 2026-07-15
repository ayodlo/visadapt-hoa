import { render, fireEvent, act } from '@testing-library/react-native';
import ViolationDetail from '../../../app/(resident)/more/violations/[id]';
import { getViolation, respondToViolation, appealViolation } from '@/api/violations';
import { ApiError } from '@/api/client';
import type { ViolationDetail as ViolationDetailData } from '@/types/violations';

jest.mock('@/api/violations');
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'v1' }) }));

const mockedGetViolation = getViolation as jest.Mock;
const mockedRespond = respondToViolation as jest.Mock;
const mockedAppeal = appealViolation as jest.Mock;

function makeViolation(overrides: Partial<ViolationDetailData> = {}): ViolationDetailData {
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

describe('ViolationDetail (resident)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the violation type and rule citation', async () => {
    mockedGetViolation.mockResolvedValue({ violation: makeViolation() });
    const { findByText } = await render(<ViolationDetail />);
    expect(await findByText('Noise')).toBeTruthy();
    expect(await findByText('Rule: Section 4.2')).toBeTruthy();
  });

  it('shows the response form only when status is NOTICE_SENT', async () => {
    mockedGetViolation.mockResolvedValue({ violation: makeViolation({ status: 'NOTICE_SENT' }) });
    const { findByText } = await render(<ViolationDetail />);
    expect(await findByText('Respond to this Notice')).toBeTruthy();
  });

  it('does not show the response form once resolved', async () => {
    mockedGetViolation.mockResolvedValue({ violation: makeViolation({ status: 'RESOLVED' }) });
    const { findByText, queryByText } = await render(<ViolationDetail />);
    await findByText('Noise');
    expect(queryByText('Respond to this Notice')).toBeNull();
  });

  it('submits a response', async () => {
    mockedGetViolation.mockResolvedValue({ violation: makeViolation() });
    mockedRespond.mockResolvedValue({ comment: {} });
    const { findByText, getByPlaceholderText, getByText } = await render(<ViolationDetail />);
    await findByText('Noise');

    await act(async () => {
      fireEvent.changeText(
        getByPlaceholderText('Explain the situation or steps taken (min 10 characters)'),
        'I turned off the speakers immediately'
      );
    });
    await act(async () => {
      fireEvent.press(getByText('Submit Response'));
    });

    expect(mockedRespond).toHaveBeenCalledWith('v1', 'I turned off the speakers immediately');
  });

  it('submits an appeal when appealable and shows the appeal once present', async () => {
    mockedGetViolation.mockResolvedValue({ violation: makeViolation({ status: 'ESCALATED' }) });
    mockedAppeal.mockResolvedValue({ appeal: {} });
    const { findByText, getByPlaceholderText, getByText } = await render(<ViolationDetail />);
    await findByText('Appeal this Violation');

    await act(async () => {
      fireEvent.changeText(
        getByPlaceholderText("Explain why you're appealing (min 20 characters)"),
        'I was out of town the entire week'
      );
    });
    await act(async () => {
      fireEvent.press(getByText('Submit Appeal'));
    });

    expect(mockedAppeal).toHaveBeenCalledWith('v1', 'I was out of town the entire week');
  });

  it('renders an existing appeal and hides the appeal form', async () => {
    mockedGetViolation.mockResolvedValue({
      violation: makeViolation({
        status: 'ESCALATED',
        appeal: {
          id: 'ap1',
          violationId: 'v1',
          submittedById: 'r1',
          reason: 'I was out of town',
          status: 'SUBMITTED',
          outcome: null,
          reviewedById: null,
          reviewedAt: null,
          createdAt: '2026-07-11T00:00:00.000Z',
          updatedAt: '2026-07-11T00:00:00.000Z',
        },
      }),
    });
    const { findByText, queryByText } = await render(<ViolationDetail />);
    expect(await findByText('Your Appeal')).toBeTruthy();
    expect(await findByText('I was out of town')).toBeTruthy();
    expect(queryByText('Appeal this Violation')).toBeNull();
  });
});
