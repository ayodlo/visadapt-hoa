import { apiFetch } from './client';
import type { PaymentsLedger, PayReceipt, PaymentMethod } from '@/types/payments';

export function getLedger() {
  return apiFetch<PaymentsLedger>('/api/payments/me/ledger');
}

export function payBalance(amountCents: number, paymentMethod: PaymentMethod) {
  return apiFetch<PayReceipt>('/api/payments/me/pay', {
    method: 'POST',
    body: JSON.stringify({ amount: amountCents, paymentMethod }),
  });
}
