import { render } from '@testing-library/react-native';
import IssuesReportScreen from '../../../../app/(admin)/more/reports/issues';
import { getIssuesReport } from '@/api/admin';
import { ApiError } from '@/api/client';
import type { IssuesReport } from '@/types/admin';

jest.mock('@/api/admin');

const mockedGetIssuesReport = getIssuesReport as jest.Mock;

function makeReport(overrides: Partial<IssuesReport> = {}): IssuesReport {
  return {
    summary: { overdueCount: 2, unassignedCount: 1, createdLast30Days: 10, resolvedLast30Days: 8, avgResolutionDays: 3.5 },
    byStatus: [{ status: 'SUBMITTED', count: 5 }],
    byCategory: [{ category: 'MAINTENANCE', count: 4 }],
    byPriority: [{ priority: 'HIGH', count: 2 }],
    ...overrides,
  };
}

describe('IssuesReportScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an error view on failure', async () => {
    mockedGetIssuesReport.mockRejectedValue(new ApiError('Network error', 500));
    const { findByText } = await render(<IssuesReportScreen />);
    expect(await findByText('Network error')).toBeTruthy();
  });

  it('renders summary stats and breakdowns', async () => {
    mockedGetIssuesReport.mockResolvedValue(makeReport());
    const { findByText } = await render(<IssuesReportScreen />);
    expect(await findByText('Overdue')).toBeTruthy();
    expect(await findByText('Submitted')).toBeTruthy();
    expect(await findByText('Maintenance')).toBeTruthy();
    expect(await findByText('High')).toBeTruthy();
  });
});
