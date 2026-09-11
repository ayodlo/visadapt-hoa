'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '@/context/session';
import { useToast } from '@/context/toast';
import { isAdmin } from '@/lib/roles';
import { MANUAL_PAYMENT_METHODS } from '@/lib/payment-methods';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pencil, Plus, Receipt, Trash2, TriangleAlert, Undo2 } from 'lucide-react';

interface ResidentSummary {
  resident: { id: string; firstName: string; lastName: string; email: string };
  balance: number;
  overdueAmount: number;
  lastPaymentDate: string | null;
  derivedStatus: 'paid' | 'pending' | 'overdue';
  autopay: {
    enabled: boolean;
    method: string;
    hasIssue: boolean;
    failureMessage: string | null;
  } | null;
}

interface ListData {
  residents: ResidentSummary[];
  total: number;
  totalPages: number;
  page: number;
  totalBalance: number;
  overdueCount: number;
  totalOverdue: number;
}

interface Charge {
  id: string;
  description: string;
  amount: number;
  amountPaid: number;
  dueDate: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
}

interface Payment {
  id: string;
  amount: number;
  paymentMethod: string;
  status: string;
  paidAt: string | null;
  confirmationNumber: string;
  voidedAt: string | null;
  voidReason: string | null;
  stripeCheckoutSessionId: string | null;
}

interface ResidentLedger {
  resident: { id: string; firstName: string; lastName: string; email: string };
  charges: Charge[];
  payments: Payment[];
  summary: { balance: number; overdueAmount: number };
}

const EMPTY_CHARGE = { description: '', amount: '', dueDate: '' };
const EMPTY_RECORD = { amount: '', paymentMethod: MANUAL_PAYMENT_METHODS[0] as string };

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'autopay_issues', label: 'Autopay issues' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid Up' },
];

function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function derivedStatusToChargeStatus(s: 'paid' | 'pending' | 'overdue'): 'PAID' | 'PENDING' | 'OVERDUE' {
  if (s === 'overdue') return 'OVERDUE';
  if (s === 'pending') return 'PENDING';
  return 'PAID';
}

/**
 * Autopay at a glance. Three states worth distinguishing: on and healthy, on but
 * failing (the one that needs attention — the resident thinks they are covered and
 * is not), and paused by the resident.
 */
function AutopayIndicator({ autopay }: { autopay: ResidentSummary['autopay'] }) {
  if (!autopay) {
    return (
      <span className="text-xs text-gray-400" title="Not enrolled in autopay">
        Autopay off
      </span>
    );
  }

  if (autopay.hasIssue) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-medium text-red-700"
        title={autopay.failureMessage ?? 'The last autopay attempt failed'}
      >
        <TriangleAlert className="w-3.5 h-3.5" aria-hidden="true" />
        Autopay failing
      </span>
    );
  }

  return (
    <span
      className={`text-xs ${autopay.enabled ? 'text-green-700' : 'text-gray-500'}`}
      title={autopay.method}
    >
      Autopay {autopay.enabled ? 'on' : 'paused'}
    </span>
  );
}

export default function AdminPaymentsPage() {
  const session = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [listData, setListData] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedResident, setSelectedResident] = useState<ResidentSummary | null>(null);
  const [ledger, setLedger] = useState<ResidentLedger | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState('');

  // Add charge (deliverable #17). Amounts are per-resident: nothing is defaulted
  // from a community-wide assessment, because HOA dues are not uniform.
  const [showChargeForm, setShowChargeForm] = useState(false);
  const [chargeForm, setChargeForm] = useState(EMPTY_CHARGE);
  const [postingCharge, setPostingCharge] = useState(false);

  // Record payment: money the association received outside Stripe.
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [recordForm, setRecordForm] = useState(EMPTY_RECORD);
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Correcting a charge posted in error. What is allowed depends on how much has
  // already been paid against it — the server enforces the rules, this only keeps
  // the controls honest.
  const [editingCharge, setEditingCharge] = useState<Charge | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_CHARGE);
  const [savingCharge, setSavingCharge] = useState(false);
  const [deletingCharge, setDeletingCharge] = useState<Charge | null>(null);
  const [voidingPayment, setVoidingPayment] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const fetchList = useCallback(async (q: string, s: string, p: number) => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({ search: q, status: s, page: String(p) });
      const res = await fetch(`/api/admin/payments?${params}`);
      if (!res.ok) throw new Error('Failed to load');
      setListData(await res.json());
    } catch {
      setLoadError('Could not load residents. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session.role === 'RESIDENT') {
      router.replace('/resident/payments');
      return;
    }
    fetchList('', 'all', 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.role]);

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchList(val, status, 1), 300);
  }

  function handleStatus(val: string) {
    setStatus(val);
    setPage(1);
    fetchList(search, val, 1);
  }

  function handlePage(p: number) {
    setPage(p);
    fetchList(search, status, p);
  }

  async function selectResident(r: ResidentSummary) {
    setSelectedResident(r);
    setLedger(null);
    setLedgerError('');
    setShowChargeForm(false);
    setChargeForm(EMPTY_CHARGE);
    setShowRecordForm(false);
    setRecordForm(EMPTY_RECORD);
    setEditingCharge(null);
    setDeletingCharge(null);
    setVoidingPayment(null);
    setVoidReason('');
    setLedgerLoading(true);
    try {
      const res = await fetch(`/api/admin/payments/${r.resident.id}`);
      if (!res.ok) throw new Error('Failed to load');
      setLedger(await res.json());
    } catch {
      setLedgerError('Could not load resident ledger.');
    } finally {
      setLedgerLoading(false);
    }
  }

  /**
   * Posts a charge to the selected resident, then reloads both the panel and the
   * list so the new balance is reflected in the row as well.
   */
  async function submitCharge(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedResident) return;

    const cents = Math.round(parseFloat(chargeForm.amount) * 100);
    if (isNaN(cents) || cents <= 0) {
      toast('Enter a valid amount.', 'error');
      return;
    }
    if (!chargeForm.description.trim()) {
      toast('Enter a description.', 'error');
      return;
    }
    if (!chargeForm.dueDate) {
      toast('Choose a due date.', 'error');
      return;
    }

    setPostingCharge(true);
    try {
      const res = await fetch('/api/admin/charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residentId: selectedResident.resident.id,
          description: chargeForm.description.trim(),
          amount: cents,
          dueDate: new Date(chargeForm.dueDate).toISOString(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast(data?.error ?? 'That charge could not be posted.', 'error');
        return;
      }
      toast('Charge posted.', 'success');
      setChargeForm(EMPTY_CHARGE);
      setShowChargeForm(false);
      await Promise.all([selectResident(selectedResident), fetchList(search, status, page)]);
    } finally {
      setPostingCharge(false);
    }
  }

  /**
   * Records money received outside Stripe and reloads the panel and the list, so
   * the row balance moves at the same time as the ledger.
   */
  async function submitRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedResident || !ledger) return;

    const cents = Math.round(parseFloat(recordForm.amount) * 100);
    if (isNaN(cents) || cents <= 0) {
      toast('Enter a valid amount.', 'error');
      return;
    }
    if (cents > ledger.summary.balance) {
      toast(`Amount cannot exceed the balance of ${formatDollars(ledger.summary.balance)}.`, 'error');
      return;
    }

    setRecordingPayment(true);
    try {
      const res = await fetch(`/api/admin/payments/${selectedResident.resident.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: cents, paymentMethod: recordForm.paymentMethod }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast(data?.error ?? 'That payment could not be recorded.', 'error');
        return;
      }
      toast(`Payment recorded — ${data.payment.confirmationNumber}`, 'success');
      setRecordForm(EMPTY_RECORD);
      setShowRecordForm(false);
      await Promise.all([selectResident(selectedResident), fetchList(search, status, page)]);
    } finally {
      setRecordingPayment(false);
    }
  }

  function startEditingCharge(c: Charge) {
    setEditingCharge(c);
    setEditForm({
      description: c.description,
      amount: (c.amount / 100).toFixed(2),
      // <input type="date"> wants YYYY-MM-DD, and slicing the ISO string keeps the
      // stored day rather than shifting it through the local timezone.
      dueDate: c.dueDate.slice(0, 10),
    });
  }

  async function saveCharge(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCharge || !selectedResident) return;

    const cents = Math.round(parseFloat(editForm.amount) * 100);
    if (isNaN(cents) || cents <= 0) {
      toast('Enter a valid amount.', 'error');
      return;
    }

    setSavingCharge(true);
    try {
      const res = await fetch(`/api/admin/charges/${editingCharge.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editForm.description.trim(),
          amount: cents,
          dueDate: new Date(editForm.dueDate).toISOString(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast(data?.error ?? 'That charge could not be updated.', 'error');
        return;
      }
      toast('Charge updated.', 'success');
      setEditingCharge(null);
      await Promise.all([selectResident(selectedResident), fetchList(search, status, page)]);
    } finally {
      setSavingCharge(false);
    }
  }

  async function confirmDeleteCharge() {
    if (!deletingCharge || !selectedResident) return;
    const target = deletingCharge;
    setDeletingCharge(null);

    const res = await fetch(`/api/admin/charges/${target.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast(data?.error ?? 'That charge could not be deleted.', 'error');
      return;
    }
    toast('Charge deleted.', 'success');
    await Promise.all([selectResident(selectedResident), fetchList(search, status, page)]);
  }

  async function confirmVoidPayment() {
    if (!voidingPayment || !selectedResident) return;
    const target = voidingPayment;
    const reason = voidReason.trim();
    setVoidingPayment(null);
    setVoidReason('');

    const res = await fetch(
      `/api/admin/payments/${selectedResident.resident.id}/${target.id}/void`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reason ? { reason } : {}),
      }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast(data?.error ?? 'That payment could not be voided.', 'error');
      return;
    }

    toast(
      data.refundRequired
        ? 'Payment voided. This corrects the ledger only — refund the resident in Stripe.'
        : `Payment voided — ${formatDollars(data.amountReversed)} returned to the balance.`,
      data.refundRequired ? 'info' : 'success'
    );
    await Promise.all([selectResident(selectedResident), fetchList(search, status, page)]);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Payments Management"
        subtitle="View and monitor resident balances and payment activity"
      />

      {/* Aggregate stats */}
      {listData && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Outstanding</p>
            <p className="text-2xl font-bold mt-1 text-gray-900">{formatDollars(listData.totalBalance)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Overdue</p>
            <p className={`text-2xl font-bold mt-1 ${listData.totalOverdue > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {formatDollars(listData.totalOverdue)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Overdue Residents</p>
            <p className={`text-2xl font-bold mt-1 ${listData.overdueCount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
              {listData.overdueCount}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Resident list */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <SearchInput value={search} onChange={handleSearch} placeholder="Search residents..." />
            <FilterSelect value={status} onChange={handleStatus} options={STATUS_OPTIONS} />
          </div>

          {loading ? (
            <LoadingState />
          ) : loadError ? (
            <ErrorState message={loadError} onRetry={() => fetchList(search, status, page)} />
          ) : !listData || listData.residents.length === 0 ? (
            <EmptyState title="No residents found" description="Try adjusting your search or filter." />
          ) : (
            <>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {listData.residents.map((r) => (
                  <button
                    key={r.resident.id}
                    onClick={() => selectResident(r)}
                    className={`w-full text-left flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors gap-3 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                      selectedResident?.resident.id === r.resident.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {r.resident.firstName} {r.resident.lastName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{r.resident.email}</p>
                      {r.lastPaymentDate && (
                        <p className="text-xs text-gray-400">Last paid {formatDate(r.lastPaymentDate)}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-sm font-semibold ${r.balance > 0 ? 'text-gray-900' : 'text-green-600'}`}>
                        {r.balance > 0 ? formatDollars(r.balance) : 'Paid up'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <AutopayIndicator autopay={r.autopay} />
                        <StatusBadge status={derivedStatusToChargeStatus(r.derivedStatus)} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {listData.totalPages > 1 && (
                <div className="mt-4">
                  <Pagination page={page} totalPages={listData.totalPages} onPageChange={handlePage} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Resident ledger panel */}
        {selectedResident && (
          <div className="w-full lg:w-96 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 sticky top-4">
              <div className="px-4 py-4 border-b border-gray-200 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedResident.resident.firstName} {selectedResident.resident.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{selectedResident.resident.email}</p>
                </div>
                <button
                  onClick={() => setSelectedResident(null)}
                  aria-label="Close ledger"
                  className="text-gray-400 hover:text-gray-600 p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {ledgerLoading && <LoadingState rows={2} />}
              {ledgerError && <div className="p-4 text-sm text-red-600">{ledgerError}</div>}

              {ledger && (
                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                  <div className="flex gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Balance</p>
                      <p className={`text-lg font-bold ${ledger.summary.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatDollars(ledger.summary.balance)}
                      </p>
                    </div>
                    {ledger.summary.overdueAmount > 0 && (
                      <div>
                        <p className="text-xs text-gray-500">Overdue</p>
                        <p className="text-lg font-bold text-orange-600">{formatDollars(ledger.summary.overdueAmount)}</p>
                      </div>
                    )}
                  </div>

                  {selectedResident?.autopay && (
                    <div
                      className={`rounded-lg px-3 py-2 text-xs ${
                        selectedResident.autopay.hasIssue
                          ? 'bg-red-50 border border-red-200'
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <p className="font-medium text-gray-800">
                        Autopay {selectedResident.autopay.enabled ? 'on' : 'paused'} ·{' '}
                        {selectedResident.autopay.method}
                      </p>
                      {selectedResident.autopay.hasIssue && (
                        <p className="text-red-700 mt-0.5">
                          Last attempt failed
                          {selectedResident.autopay.failureMessage
                            ? `: ${selectedResident.autopay.failureMessage}`
                            : '.'}
                        </p>
                      )}
                    </div>
                  )}

                  {isAdmin(session.role) && (
                    <div className="border-b border-gray-100 pb-4">
                      {!showChargeForm && !showRecordForm ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setShowChargeForm(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <Plus className="w-4 h-4" aria-hidden="true" />
                            Add charge
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRecordForm({ ...EMPTY_RECORD, amount: (ledger.summary.balance / 100).toFixed(2) });
                              setShowRecordForm(true);
                            }}
                            disabled={ledger.summary.balance === 0}
                            title={ledger.summary.balance === 0 ? 'This resident has no outstanding balance' : undefined}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Receipt className="w-4 h-4" aria-hidden="true" />
                            Record payment
                          </button>
                        </div>
                      ) : showRecordForm ? (
                        <form onSubmit={submitRecordPayment} className="space-y-3">
                          <p className="text-xs text-gray-500">
                            For money received outside the payment portal — a cheque, cash, or a
                            direct bank transfer. Card payments are taken through the resident
                            portal and record themselves.
                          </p>
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <label htmlFor="record-amount" className="block text-xs font-medium text-gray-700 mb-1">
                                Amount ($)
                              </label>
                              <input
                                id="record-amount"
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={(ledger.summary.balance / 100).toFixed(2)}
                                value={recordForm.amount}
                                onChange={(e) => setRecordForm({ ...recordForm, amount: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                              />
                            </div>
                            <div className="flex-1">
                              <label htmlFor="record-method" className="block text-xs font-medium text-gray-700 mb-1">
                                Method
                              </label>
                              <select
                                id="record-method"
                                value={recordForm.paymentMethod}
                                onChange={(e) => setRecordForm({ ...recordForm, paymentMethod: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                {MANUAL_PAYMENT_METHODS.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setShowRecordForm(false);
                                setRecordForm(EMPTY_RECORD);
                              }}
                              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={recordingPayment}
                              className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                              {recordingPayment ? 'Recording\u2026' : 'Record payment'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <form onSubmit={submitCharge} className="space-y-3">
                          <div>
                            <label htmlFor="charge-description" className="block text-xs font-medium text-gray-700 mb-1">
                              Description
                            </label>
                            <input
                              id="charge-description"
                              type="text"
                              maxLength={200}
                              value={chargeForm.description}
                              onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })}
                              placeholder="Monthly assessment"
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <label htmlFor="charge-amount" className="block text-xs font-medium text-gray-700 mb-1">
                                Amount ($)
                              </label>
                              <input
                                id="charge-amount"
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={chargeForm.amount}
                                onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                              />
                            </div>
                            <div className="flex-1">
                              <label htmlFor="charge-due" className="block text-xs font-medium text-gray-700 mb-1">
                                Due date
                              </label>
                              <input
                                id="charge-due"
                                type="date"
                                value={chargeForm.dueDate}
                                onChange={(e) => setChargeForm({ ...chargeForm, dueDate: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setShowChargeForm(false);
                                setChargeForm(EMPTY_CHARGE);
                              }}
                              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={postingCharge}
                              className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                              {postingCharge ? 'Posting\u2026' : 'Post charge'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Charges</h3>
                    {ledger.charges.length === 0 ? (
                      <p className="text-sm text-gray-400">No charges.</p>
                    ) : (
                      <div className="space-y-2">
                        {ledger.charges.map((c) =>
                          editingCharge?.id === c.id ? (
                            <form key={c.id} onSubmit={saveCharge} className="space-y-2 bg-gray-50 rounded-lg p-3">
                              <div>
                                <label htmlFor={`edit-desc-${c.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                                  Description
                                </label>
                                <input
                                  id={`edit-desc-${c.id}`}
                                  type="text"
                                  maxLength={200}
                                  value={editForm.description}
                                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  required
                                />
                              </div>
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <label htmlFor={`edit-amount-${c.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                                    Amount ($)
                                  </label>
                                  <input
                                    id={`edit-amount-${c.id}`}
                                    type="number"
                                    step="0.01"
                                    min={c.amountPaid > 0 ? (c.amountPaid / 100).toFixed(2) : '0.01'}
                                    value={editForm.amount}
                                    onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                  />
                                </div>
                                <div className="flex-1">
                                  <label htmlFor={`edit-due-${c.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                                    Due date
                                  </label>
                                  <input
                                    id={`edit-due-${c.id}`}
                                    type="date"
                                    value={editForm.dueDate}
                                    onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                  />
                                </div>
                              </div>
                              {c.amountPaid > 0 && (
                                <p className="text-xs text-gray-500">
                                  {formatDollars(c.amountPaid)} already paid — the amount cannot go below it.
                                </p>
                              )}
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingCharge(null)}
                                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={savingCharge}
                                  className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                >
                                  {savingCharge ? 'Saving\u2026' : 'Save'}
                                </button>
                              </div>
                            </form>
                          ) : (
                            <div key={c.id} className="flex items-center justify-between gap-2 group">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-800 truncate">{c.description}</p>
                                <p className="text-xs text-gray-400">{formatDate(c.dueDate)}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <StatusBadge status={c.status} />
                                <span className="text-xs font-semibold text-gray-700">
                                  {c.amountPaid > 0 && c.status !== 'PAID'
                                    ? `${formatDollars(c.amount - c.amountPaid)} of ${formatDollars(c.amount)}`
                                    : formatDollars(c.amount)}
                                </span>
                                {isAdmin(session.role) && c.status !== 'PAID' && (
                                  <span className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => startEditingCharge(c)}
                                      aria-label={`Edit charge: ${c.description}`}
                                      className="p-1 text-gray-400 hover:text-blue-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeletingCharge(c)}
                                      disabled={c.amountPaid > 0}
                                      title={
                                        c.amountPaid > 0
                                          ? 'A payment has been applied to this charge'
                                          : undefined
                                      }
                                      aria-label={`Delete charge: ${c.description}`}
                                      className="p-1 text-gray-400 hover:text-red-600 rounded focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-gray-400"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                    </button>
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payments</h3>
                    {ledger.payments.length === 0 ? (
                      <p className="text-sm text-gray-400">No payments yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {ledger.payments.map((p) => {
                          const voided = p.status === 'VOIDED';
                          return (
                            <div key={p.id} className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className={`text-xs font-medium ${voided ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                  {p.paymentMethod}
                                </p>
                                <p className="text-xs text-gray-400 font-mono">{p.confirmationNumber}</p>
                                {p.paidAt && !voided && <p className="text-xs text-gray-400">{formatDate(p.paidAt)}</p>}
                                {voided && (
                                  <p className="text-xs text-gray-500">
                                    Voided{p.voidedAt ? ` ${formatDate(p.voidedAt)}` : ''}
                                    {p.voidReason ? ` — ${p.voidReason}` : ''}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span
                                  className={`text-xs font-semibold ${voided ? 'text-gray-400 line-through' : 'text-gray-700'}`}
                                >
                                  {formatDollars(p.amount)}
                                </span>
                                {isAdmin(session.role) && !voided && p.status !== 'FAILED' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setVoidingPayment(p);
                                      setVoidReason('');
                                    }}
                                    aria-label={`Void payment ${p.confirmationNumber}`}
                                    className="p-1 text-gray-400 hover:text-red-600 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                                  >
                                    <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deletingCharge}
        title="Delete charge"
        description={
          deletingCharge
            ? `${deletingCharge.description} (${formatDollars(
                deletingCharge.amount
              )}) will be permanently removed from this resident’s ledger. Nothing has been paid against it.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDeleteCharge}
        onCancel={() => setDeletingCharge(null)}
      />

      {voidingPayment && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="void-payment-title"
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 id="void-payment-title" className="text-lg font-semibold text-gray-900 mb-1">
              Void payment
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {formatDollars(voidingPayment.amount)} ({voidingPayment.paymentMethod}) will be
              reversed and returned to this resident’s balance. The payment stays on the ledger
              marked as voided.
            </p>
            {voidingPayment.stripeCheckoutSessionId && (
              <p className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-4">
                This was paid online. Voiding corrects the ledger but does <strong>not</strong>{' '}
                refund the money — issue the refund in Stripe.
              </p>
            )}
            <div className="mb-4">
              <label htmlFor="void-reason" className="block text-xs font-medium text-gray-700 mb-1">
                Reason (optional)
              </label>
              <input
                id="void-reason"
                type="text"
                maxLength={500}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Entered twice"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setVoidingPayment(null);
                  setVoidReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmVoidPayment}
                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Void payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
