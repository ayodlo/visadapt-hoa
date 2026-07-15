import { render, fireEvent } from '@testing-library/react-native';
import PaymentsScreen from '../../../app/(resident)/payments/index';
import { getLedger } from '@/api/payments';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';
import type { PaymentsLedger } from '@/types/payments';

jest.mock('@/api/payments');
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: jest.fn(),
}));

const mockedGetLedger = getLedger as jest.Mock;

function makeLedger(overrides: Partial<PaymentsLedger> = {}): PaymentsLedger {
  return {
    charges: [],
    payments: [],
    summary: { totalBalance: 0, overdueAmount: 0, paidThisYear: 0, nextDueDate: null, nextDueAmount: null },
    ...overrides,
  };
}

describe('PaymentsScreen (resident)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an error view on failure', async () => {
    mockedGetLedger.mockRejectedValue(new ApiError('Network error', 500));
    const { findByText } = await render(<PaymentsScreen />);
    expect(await findByText('Network error')).toBeTruthy();
  });

  it('shows the "Make a Payment" button only when a balance is owed', async () => {
    mockedGetLedger.mockResolvedValue(makeLedger({ summary: { totalBalance: 0, overdueAmount: 0, paidThisYear: 0, nextDueDate: null, nextDueAmount: null } }));
    const { findByText, queryByText } = await render(<PaymentsScreen />);
    await findByText('Balance Due');
    expect(queryByText('Make a Payment')).toBeNull();
  });

  it('navigates to the pay screen when balance is owed and the button is pressed', async () => {
    mockedGetLedger.mockResolvedValue(makeLedger({ summary: { totalBalance: 10000, overdueAmount: 0, paidThisYear: 0, nextDueDate: null, nextDueAmount: null } }));
    const { findByText, getByText } = await render(<PaymentsScreen />);
    await findByText('Make a Payment');
    fireEvent.press(getByText('Make a Payment'));
    expect(router.push).toHaveBeenCalledWith('/payments/pay');
  });

  it('shows empty states for no outstanding charges and no payment history', async () => {
    mockedGetLedger.mockResolvedValue(makeLedger());
    const { findByText } = await render(<PaymentsScreen />);
    expect(await findByText('You have no outstanding charges')).toBeTruthy();
    expect(await findByText('No payments yet')).toBeTruthy();
  });

  it('renders outstanding charges and payment history', async () => {
    mockedGetLedger.mockResolvedValue(
      makeLedger({
        charges: [{ id: 'c1', residentId: 'r1', propertyId: null, description: 'July Dues', amount: 25000, dueDate: '2026-07-20T00:00:00.000Z', status: 'PENDING', createdAt: '2026-07-01T00:00:00.000Z' }],
        payments: [{ id: 'p1', residentId: 'r1', propertyId: null, amount: 25000, paymentMethod: 'Credit Card', status: 'PAID', paidAt: '2026-06-01T00:00:00.000Z', confirmationNumber: 'CONF123', createdAt: '2026-06-01T00:00:00.000Z' }],
      })
    );
    const { findByText } = await render(<PaymentsScreen />);
    expect(await findByText('July Dues')).toBeTruthy();
    expect(await findByText('Credit Card')).toBeTruthy();
  });
});
