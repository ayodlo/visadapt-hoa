import { render } from '@testing-library/react-native';
import ArchRequestsReportScreen from '../../../../app/(admin)/more/reports/architectural-requests';
import { getArchRequestsReport } from '@/api/admin';
import { ApiError } from '@/api/client';
import type { ArchRequestsReport } from '@/types/admin';

jest.mock('@/api/admin');

const mockedGetArchRequestsReport = getArchRequestsReport as jest.Mock;

function makeReport(overrides: Partial<ArchRequestsReport> = {}): ArchRequestsReport {
  return {
    summary: { submittedLast30Days: 4, decidedLast30Days: 3, avgDecisionDays: 5 },
    byStatus: [{ status: 'APPROVED', count: 2 }],
    byType: [{ type: 'FENCE', count: 1 }],
    ...overrides,
  };
}

describe('ArchRequestsReportScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an error view on failure', async () => {
    mockedGetArchRequestsReport.mockRejectedValue(new ApiError('Network error', 500));
    const { findByText } = await render(<ArchRequestsReportScreen />);
    expect(await findByText('Network error')).toBeTruthy();
  });

  it('renders summary stats and breakdowns', async () => {
    mockedGetArchRequestsReport.mockResolvedValue(makeReport());
    const { findByText } = await render(<ArchRequestsReportScreen />);
    expect(await findByText('Submitted (30d)')).toBeTruthy();
    expect(await findByText('Approved')).toBeTruthy();
    expect(await findByText('Fence')).toBeTruthy();
  });
});
