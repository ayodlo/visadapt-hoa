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
  amountPaid: number;
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

interface AutopayState {
  enrolled: boolean;
  enabled: boolean;
  method: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
  available: boolean;
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

// No 'receipt' step any more: the receipt is produced by the Stripe webhook, not
// by this page, so it appears in Payment History once the charge settles. Card
// payments land within seconds; ACH can take days, which is exactly why the
// browser is not allowed to declare a payment successful.
type ModalStep = 'form' | 'redirecting';

// Payment method is collected by Stripe Checkout, not here.

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
  const [submitting, setSubmitting] = useState(false);

  const [autopay, setAutopay] = useState<AutopayState | null>(null);
  const [autopayBusy, setAutopayBusy] = useState(false);

  const loadLedger = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [res, autopayRes] = await Promise.all([
        fetch('/api/payments/me/ledger'),
        fetch('/api/payments/me/autopay'),
      ]);
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      setData(json);
      setAutopay(autopayRes.ok ? await autopayRes.json() : null);
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

  // Stripe sends the resident back here with ?payment=success|cancelled. Read from
  // location rather than useSearchParams so this client page needs no Suspense
  // boundary, then strip the parameter so a refresh does not re-announce it.
  useEffect(() => {
    const outcome = new URLSearchParams(window.location.search).get('payment');
    if (!outcome) return;

    const autopayOutcome = new URLSearchParams(window.location.search).get('autopay');
    if (autopayOutcome === 'saved') {
      // The enrolment is written by the webhook, which may not have landed yet,
      // so this deliberately does not claim autopay is already active.
      toast('Payment method saved. Autopay will be active shortly.', 'success');
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }
    if (autopayOutcome === 'cancelled') {
      toast('Autopay setup cancelled.', 'info');
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    if (outcome === 'success') {
      // Deliberately not "payment complete": an ACH debit is still in flight at
      // this point, and only the webhook knows when it has settled.
      toast('Payment submitted. Your balance updates as soon as it settles.', 'success');
    } else if (outcome === 'cancelled') {
      toast('Payment cancelled. Nothing was charged.', 'info');
    }

    window.history.replaceState(null, '', window.location.pathname);
  }, [toast]);

  function openModal() {
    if (!data || data.summary.totalBalance === 0) {
      toast('No outstanding balance.', 'info');
      return;
    }
    setPayAmount((data.summary.totalBalance / 100).toFixed(2));
    setModalStep('form');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
  }

  async function handleCheckout(e: React.FormEvent) {
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
    setModalStep('redirecting');
    setSubmitting(true);
    try {
      const res = await fetch('/api/payments/me/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: cents }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not start checkout');
      // Full navigation, not router.push: Checkout is hosted by Stripe.
      window.location.assign(json.url);
    } catch (ex) {
      toast(ex instanceof Error ? ex.message : 'Could not start checkout', 'error');
      setModalStep('form');
      setSubmitting(false);
    }
  }

  async function startAutopaySetup() {
    setAutopayBusy(true);
    try {
      const res = await fetch('/api/payments/me/autopay/setup', { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        toast(json?.error ?? 'Could not start autopay setup.', 'error');
        setAutopayBusy(false);
        return;
      }
      window.location.assign(json.url);
    } catch {
      toast('Could not start autopay setup.', 'error');
      setAutopayBusy(false);
    }
  }

  async function setAutopayEnabled(enabled: boolean) {
    setAutopayBusy(true);
    try {
      const res = await fetch('/api/payments/me/autopay', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast(json?.error ?? 'That change could not be saved.', 'error');
        return;
      }
      toast(enabled ? 'Autopay resumed.' : 'Autopay paused.', 'success');
      await loadLedger();
    } finally {
      setAutopayBusy(false);
    }
  }

  async function cancelAutopay() {
    setAutopayBusy(true);
    try {
      const res = await fetch('/api/payments/me/autopay', { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast(json?.error ?? 'Autopay could not be turned off.', 'error');
        return;
      }
      toast('Autopay turned off and your saved method removed.', 'success');
      await loadLedger();
    } finally {
      setAutopayBusy(false);
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
      {autopay?.available && (
        <section aria-labelledby="autopay-heading" className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 id="autopay-heading" className="text-base font-semibold text-gray-900 mb-1">
            Automatic payments
          </h2>

          {!autopay.enrolled ? (
            <>
              <p className="text-sm text-gray-500 mb-3">
                Save a card or bank account and your balance will be paid automatically when it
                comes due. You can pause or remove it at any time.
              </p>
              <button
                type="button"
                onClick={startAutopaySetup}
                disabled={autopayBusy}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {autopayBusy ? 'Opening…' : 'Set up autopay'}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-1">
                {autopay.enabled ? 'On' : 'Paused'} · {autopay.method}
              </p>
              {autopay.lastFailureAt && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 my-3">
                  Your last automatic payment failed
                  {autopay.lastFailureMessage ? `: ${autopay.lastFailureMessage}` : '.'} Update your
                  payment method or pay your balance directly.
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setAutopayEnabled(!autopay.enabled)}
                  disabled={autopayBusy}
                  className="px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
                >
                  {autopay.enabled ? 'Pause' : 'Resume'}
                </button>
                <button
                  type="button"
                  onClick={startAutopaySetup}
                  disabled={autopayBusy}
                  className="px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
                >
                  Change method
                </button>
                <button
                  type="button"
                  onClick={cancelAutopay}
                  disabled={autopayBusy}
                  className="px-3 py-1.5 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                >
                  Turn off
                </button>
              </div>
            </>
          )}
        </section>
      )}

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
                  {c.amountPaid > 0 && (
                    <p className="text-xs text-gray-500">
                      {formatDollars(c.amountPaid)} of {formatDollars(c.amount)} paid
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusBadge status={c.status} />
                  <span className="text-sm font-semibold text-gray-900">{formatDollars(c.amount - c.amountPaid)}</span>
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
                <form onSubmit={handleCheckout} className="space-y-4">
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
                  <p className="text-sm text-gray-500">
                    You will be taken to our payment processor to enter your card or
                    bank details. Your balance updates once the payment settles.
                  </p>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      Continue to Payment
                    </button>
                  </div>
                </form>
              </>
            )}

            {modalStep === 'redirecting' && (
              <div className="text-center py-8">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-700">Taking you to secure checkout...</p>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
