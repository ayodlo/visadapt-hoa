import { render } from '@testing-library/react-native';
import PaymentsReportScreen from '../../../../app/(admin)/more/reports/payments';
import { getPaymentsReport } from '@/api/admin';
import { ApiError } from '@/api/client';
import type { PaymentsReport } from '@/types/admin';

jest.mock('@/api/admin');

const mockedGetPaymentsReport = getPaymentsReport as jest.Mock;

function makeReport(overrides: Partial<PaymentsReport> = {}): PaymentsReport {
  return {
    summary: {
      totalBilledCents: 500000,
      totalPendingCents: 100000,
      totalOverdueCents: 20000,
      totalPaidCents: 380000,
      totalCollectedCents: 380000,
      outstandingCents: 120000,
      delinquentAccounts: 2,
      totalCharges: 20,
      totalPayments: 15,
    },
    byStatus: [{ status: 'PAID', count: 15, amountCents: 380000 }],
    recentPayments: [],
    ...overrides,
  };
}

describe('PaymentsReportScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an error view on failure', async () => {
    mockedGetPaymentsReport.mockRejectedValue(new ApiError('Network error', 500));
    const { findByText } = await render(<PaymentsReportScreen />);
    expect(await findByText('Network error')).toBeTruthy();
  });

  it('shows an empty state for recent payments when there are none', async () => {
    mockedGetPaymentsReport.mockResolvedValue(makeReport({ recentPayments: [] }));
    const { findByText } = await render(<PaymentsReportScreen />);
    expect(await findByText('No payments yet')).toBeTruthy();
  });

  it('renders summary totals and recent payments', async () => {
    mockedGetPaymentsReport.mockResolvedValue(
      makeReport({
        recentPayments: [
          { id: 'p1', amount: 25000, paymentMethod: 'Credit Card', status: 'PAID', paidAt: '2026-07-01T00:00:00.000Z', createdAt: '2026-07-01T00:00:00.000Z', confirmationNumber: 'CONF1', residentName: 'Demo Resident', residentEmail: 'r@communityhq.local' },
        ],
      })
    );
    const { findByText } = await render(<PaymentsReportScreen />);
    expect(await findByText('$5,000.00')).toBeTruthy();
    expect(await findByText('Demo Resident')).toBeTruthy();
  });
});
