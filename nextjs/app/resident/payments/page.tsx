'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from '@/context/session';
import { isStaff } from '@/lib/roles';
import { useToast } from '@/context/toast';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';

interface Charge {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  createdAt: string;
}

interface Payment {
  id: string;
  amount: number;
  paymentMethod: string;
  status: string;
  paidAt: string | null;
  confirmationNumber: string;
  createdAt: string;
}

interface LedgerData {
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

type ModalStep = 'form' | 'processing' | 'receipt';

const PAYMENT_METHODS = ['Credit Card', 'Debit Card', 'Bank Transfer', 'Check'] as const;

function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ResidentPaymentsPage() {
  const session = useSession();
  const { toast } = useToast();
  const router = useRouter();

  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>('form');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<typeof PAYMENT_METHODS[number]>('Credit Card');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{ confirmationNumber: string; amount: number; paymentMethod: string; paidAt: string } | null>(null);

  const loadLedger = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/payments/me/ledger');
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      setData(json);
    } catch {
      setLoadError('Could not load your payment information. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isStaff(session.role)) {
      router.replace('/admin/payments');
      return;
    }
    loadLedger();
  }, [session.role, loadLedger, router]);

  function openModal() {
    if (!data || data.summary.totalBalance === 0) {
      toast('No outstanding balance.', 'info');
      return;
    }
    setPayAmount((data.summary.totalBalance / 100).toFixed(2));
    setPayMethod('Credit Card');
    setModalStep('form');
    setReceipt(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(parseFloat(payAmount) * 100);
    if (isNaN(cents) || cents <= 0) {
      toast('Enter a valid payment amount.', 'error');
      return;
    }
    if (data && cents > data.summary.totalBalance) {
      toast(`Amount cannot exceed your balance of ${formatDollars(data.summary.totalBalance)}.`, 'error');
      return;
    }
    setModalStep('processing');
    setSubmitting(true);
    try {
      const res = await fetch('/api/payments/me/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: cents, paymentMethod: payMethod }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Payment failed');
      setReceipt(json.receipt);
      setModalStep('receipt');
      await loadLedger();
    } catch (ex) {
      toast(ex instanceof Error ? ex.message : 'Payment failed', 'error');
      setModalStep('form');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState />;
  if (loadError) return <ErrorState message={loadError} onRetry={loadLedger} />;
  if (!data) return null;

  const { charges, payments, summary } = data;
  const pendingCharges = charges.filter((c) => c.status === 'PENDING' || c.status === 'OVERDUE');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Payments & Ledger"
        subtitle="View your balance, charge history, and payment history"
        action={
          summary.totalBalance > 0 ? (
            <button
              onClick={openModal}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Make a Payment
            </button>
          ) : undefined
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Balance Due</p>
          <p className={`text-2xl font-bold mt-1 ${summary.totalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatDollars(summary.totalBalance)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Overdue</p>
          <p className={`text-2xl font-bold mt-1 ${summary.overdueAmount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
            {formatDollars(summary.overdueAmount)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Paid This Year</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">{formatDollars(summary.paidThisYear)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Next Due</p>
          {summary.nextDueDate ? (
            <>
              <p className="text-lg font-bold mt-1 text-gray-900">{formatDate(summary.nextDueDate)}</p>
              <p className="text-xs text-gray-500">{formatDollars(summary.nextDueAmount ?? 0)}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400 mt-1">None</p>
          )}
        </div>
      </div>

      {/* Outstanding charges */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Outstanding Charges</h2>
        {pendingCharges.length === 0 ? (
          <EmptyState title="All paid up" description="You have no outstanding charges." />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {pendingCharges.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.description}</p>
                  <p className="text-xs text-gray-500">Due {formatDate(c.dueDate)}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusBadge status={c.status} />
                  <span className="text-sm font-semibold text-gray-900">{formatDollars(c.amount)}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-between items-center px-4 py-3 bg-gray-50 rounded-b-xl">
              <span className="text-sm font-semibold text-gray-700">Total Due</span>
              <span className="text-sm font-bold text-red-600">{formatDollars(summary.totalBalance)}</span>
            </div>
          </div>
        )}
      </section>

      {/* Charge history */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">All Charges</h2>
        {charges.length === 0 ? (
          <EmptyState title="No charges yet" description="Your charge history will appear here." />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {charges.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.description}</p>
                  <p className="text-xs text-gray-500">Due {formatDate(c.dueDate)}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusBadge status={c.status} />
                  <span className="text-sm font-semibold text-gray-900">{formatDollars(c.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Payment history */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Payment History</h2>
        {payments.length === 0 ? (
          <EmptyState title="No payments yet" description="Your payments will appear here." />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{p.paymentMethod}</p>
                  <p className="text-xs text-gray-500">{p.confirmationNumber}</p>
                  {p.paidAt && <p className="text-xs text-gray-400">{formatDate(p.paidAt)}</p>}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusBadge status={p.status} />
                  <span className="text-sm font-semibold text-gray-900">{formatDollars(p.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Make Payment modal */}
      {showModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" aria-label="Make a payment">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            {modalStep === 'form' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Make a Payment</h2>
                <p className="text-sm text-gray-500 mb-5">Balance due: <strong>{formatDollars(summary.totalBalance)}</strong></p>
                <form onSubmit={handlePay} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={(summary.totalBalance / 100).toFixed(2)}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value as typeof PAYMENT_METHODS[number])}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      Pay Now
                    </button>
                  </div>
                </form>
              </>
            )}

            {modalStep === 'processing' && (
              <div className="text-center py-8">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-700">Processing your payment...</p>
              </div>
            )}

            {modalStep === 'receipt' && receipt && (
              <>
                <div className="text-center mb-5">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Payment Successful</h2>
                </div>
                <dl className="space-y-2 text-sm mb-6">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Confirmation</dt>
                    <dd className="font-mono font-semibold text-gray-900">{receipt.confirmationNumber}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Amount</dt>
                    <dd className="font-semibold text-gray-900">{formatDollars(receipt.amount)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Method</dt>
                    <dd className="text-gray-900">{receipt.paymentMethod}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Date</dt>
                    <dd className="text-gray-900">{formatDate(receipt.paidAt)}</dd>
                  </div>
                </dl>
                <button
                  onClick={closeModal}
                  className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
