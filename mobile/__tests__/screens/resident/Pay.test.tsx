import { render, fireEvent, act } from '@testing-library/react-native';
import PayScreen from '../../../app/(resident)/payments/pay';
import { getLedger, payBalance } from '@/api/payments';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';
import type { PaymentsLedger } from '@/types/payments';

jest.mock('@/api/payments');
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

const mockedGetLedger = getLedger as jest.Mock;
const mockedPayBalance = payBalance as jest.Mock;

function makeLedger(overrides: Partial<PaymentsLedger> = {}): PaymentsLedger {
  return {
    charges: [],
    payments: [],
    summary: { totalBalance: 15000, overdueAmount: 0, paidThisYear: 0, nextDueDate: null, nextDueAmount: null },
    ...overrides,
  };
}

describe('PayScreen (resident)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('defaults the amount field to the outstanding balance', async () => {
    mockedGetLedger.mockResolvedValue(makeLedger({ summary: { totalBalance: 15000, overdueAmount: 0, paidThisYear: 0, nextDueDate: null, nextDueAmount: null } }));
    const { findByDisplayValue } = await render(<PayScreen />);
    expect(await findByDisplayValue('150.00')).toBeTruthy();
  });

  it('rejects an amount greater than the balance', async () => {
    mockedGetLedger.mockResolvedValue(makeLedger());
    const { findByDisplayValue, getByText } = await render(<PayScreen />);
    const input = await findByDisplayValue('150.00');

    await act(async () => {
      fireEvent.changeText(input, '999.00');
    });
    await act(async () => {
      fireEvent.press(getByText('Pay Now'));
    });

    expect(getByText(/Amount cannot exceed your balance/)).toBeTruthy();
    expect(mockedPayBalance).not.toHaveBeenCalled();
  });

  it('pays the balance and shows a receipt', async () => {
    mockedGetLedger.mockResolvedValue(makeLedger());
    mockedPayBalance.mockResolvedValue({
      payment: {},
      receipt: { confirmationNumber: 'CONF123', amount: 15000, paymentMethod: 'Credit Card', paidAt: '2026-07-14T12:00:00.000Z' },
    });

    const { findByDisplayValue, getByText, findByText } = await render(<PayScreen />);
    await findByDisplayValue('150.00');

    await act(async () => {
      fireEvent.press(getByText('Pay Now'));
    });

    expect(mockedPayBalance).toHaveBeenCalledWith(15000, 'Credit Card');
    expect(await findByText('Payment Successful')).toBeTruthy();
    expect(await findByText('CONF123')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Done'));
    });
    expect(router.replace).toHaveBeenCalledWith('/payments');
  });

  it('shows an error and returns to the form when payment fails', async () => {
    mockedGetLedger.mockResolvedValue(makeLedger());
    mockedPayBalance.mockRejectedValue(new ApiError('Payment declined', 402));

    const { findByDisplayValue, getByText } = await render(<PayScreen />);
    await findByDisplayValue('150.00');

    await act(async () => {
      fireEvent.press(getByText('Pay Now'));
    });

    expect(getByText('Payment declined')).toBeTruthy();
  });
});
