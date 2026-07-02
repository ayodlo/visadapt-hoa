'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '@/context/session';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { Pagination } from '@/components/ui/Pagination';

interface ResidentSummary {
  resident: { id: string; firstName: string; lastName: string; email: string };
  balance: number;
  overdueAmount: number;
  lastPaymentDate: string | null;
  derivedStatus: 'paid' | 'pending' | 'overdue';
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
}

interface ResidentLedger {
  resident: { id: string; firstName: string; lastName: string; email: string };
  charges: Charge[];
  payments: Payment[];
  summary: { balance: number; overdueAmount: number };
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
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

export default function AdminPaymentsPage() {
  const session = useSession();
  const router = useRouter();

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
                      <StatusBadge status={derivedStatusToChargeStatus(r.derivedStatus)} />
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

                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Charges</h3>
                    {ledger.charges.length === 0 ? (
                      <p className="text-sm text-gray-400">No charges.</p>
                    ) : (
                      <div className="space-y-2">
                        {ledger.charges.map((c) => (
                          <div key={c.id} className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{c.description}</p>
                              <p className="text-xs text-gray-400">{formatDate(c.dueDate)}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <StatusBadge status={c.status} />
                              <span className="text-xs font-semibold text-gray-700">{formatDollars(c.amount)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payments</h3>
                    {ledger.payments.length === 0 ? (
                      <p className="text-sm text-gray-400">No payments yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {ledger.payments.map((p) => (
                          <div key={p.id} className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-800">{p.paymentMethod}</p>
                              <p className="text-xs text-gray-400 font-mono">{p.confirmationNumber}</p>
                              {p.paidAt && <p className="text-xs text-gray-400">{formatDate(p.paidAt)}</p>}
                            </div>
                            <span className="text-xs font-semibold text-gray-700 flex-shrink-0">{formatDollars(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
