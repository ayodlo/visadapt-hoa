import { render } from '@testing-library/react-native';
import ViolationsReportScreen from '../../../../app/(admin)/more/reports/violations';
import { getViolationsReport } from '@/api/admin';
import { ApiError } from '@/api/client';
import type { ViolationsReport } from '@/types/admin';

jest.mock('@/api/admin');

const mockedGetViolationsReport = getViolationsReport as jest.Mock;

function makeReport(overrides: Partial<ViolationsReport> = {}): ViolationsReport {
  return {
    summary: { issuedLast30Days: 6, resolvedLast30Days: 4, pendingAppeals: 1 },
    byStatus: [{ status: 'ESCALATED', count: 2 }],
    byType: [{ type: 'NOISE', count: 3 }],
    appeals: { byStatus: [{ status: 'SUBMITTED', count: 1 }] },
    ...overrides,
  };
}

describe('ViolationsReportScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an error view on failure', async () => {
    mockedGetViolationsReport.mockRejectedValue(new ApiError('Network error', 500));
    const { findByText } = await render(<ViolationsReportScreen />);
    expect(await findByText('Network error')).toBeTruthy();
  });

  it('renders summary stats and breakdowns', async () => {
    mockedGetViolationsReport.mockResolvedValue(makeReport());
    const { findByText } = await render(<ViolationsReportScreen />);
    expect(await findByText('Pending Appeals')).toBeTruthy();
    expect(await findByText('Escalated')).toBeTruthy();
    expect(await findByText('Noise')).toBeTruthy();
    expect(await findByText('Appeals By Status')).toBeTruthy();
  });
});
