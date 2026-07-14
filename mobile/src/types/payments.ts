import type { ChargeStatus, PaymentStatus } from './enums';

export interface Charge {
  id: string;
  residentId: string;
  propertyId: string | null;
  description: string;
  amount: number;
  dueDate: string;
  status: ChargeStatus;
  createdAt: string;
}

export interface Payment {
  id: string;
  residentId: string;
  propertyId: string | null;
  amount: number;
  paymentMethod: string;
  status: PaymentStatus;
  paidAt: string | null;
  confirmationNumber: string;
  createdAt: string;
}

export interface PaymentsLedger {
  charges: Charge[];
  payments: Payment[];
  summary: {
    totalBalance: number;
    overdueAmount: number;
    paidThisYear: number;
    nextDueDate: string | null;
    nextDueAmount: number | null;
  };
}

export type PaymentMethod = 'Credit Card' | 'Debit Card' | 'Bank Transfer' | 'Check';

export interface PayReceipt {
  payment: Payment;
  receipt: { confirmationNumber: string; amount: number; paymentMethod: string; paidAt: string };
}
