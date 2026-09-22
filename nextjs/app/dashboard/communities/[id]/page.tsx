'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CreditCard, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/context/toast';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface StripeStatus {
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  stripeCardPaymentsActive: boolean;
  stripeDetailsSubmitted: boolean;
  stripeConfigured: boolean;
  canAcceptPayments: boolean;
  refreshError: string | null;
}

interface Person { id: string; firstName: string; lastName: string; email: string }
interface StaffRow { id: string; createdAt: string; user: Person & { role: string } }
interface Resident extends Person { _count: { properties: number } }
interface Property {
  id: string;
  streetAddress: string;
  unitNumber: string | null;
  city: string;
  state: string;
  zipCode: string;
  owner: { id: string; firstName: string; lastName: string };
}
interface Candidate extends Person {
  community: { id: string; name: string } | null;
  _count: { properties: number };
}

const EMPTY_PROPERTY = { streetAddress: '', unitNumber: '', city: '', state: '', zipCode: '', ownerId: '' };

const input =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const card = 'bg-white border border-gray-200 rounded-xl p-5';
const heading = 'text-sm font-semibold text-gray-900';

function name(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`;
}

export default function CommunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();

  const [community, setCommunity] = useState<{ id: string; name: string; createdAt: string } | null>(null);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [candidates, setCandidates] = useState<{ staff: (Person & { role: string })[]; residents: Candidate[] }>({
    staff: [],
    residents: [],
  });
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [busy, setBusy] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [staffOpen, setStaffOpen] = useState(false);
  const [staffDraft, setStaffDraft] = useState<string[]>([]);
  const [moveIn, setMoveIn] = useState('');
  const [propertyForm, setPropertyForm] = useState(EMPTY_PROPERTY);
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [deleting, setDeleting] = useState<Property | null>(null);
  const [stripe, setStripe] = useState<StripeStatus | null>(null);
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(async () => {
    // The stripe endpoint reads the live account on every call, so the status is
    // current even on the hop back from Stripe-hosted onboarding.
    const [detail, cands, stripeRes] = await Promise.all([
      fetch(`/api/admin/communities/${id}`),
      fetch(`/api/admin/communities/${id}/candidates`),
      fetch(`/api/admin/communities/${id}/stripe`),
    ]);
    setStripe(stripeRes.ok ? await stripeRes.json() : null);
    if (!detail.ok) {
      setState('error');
      return;
    }
    const data = await detail.json();
    setCommunity(data.community);
    setStaff(data.staff);
    setResidents(data.residents);
    setProperties(data.properties);
    setDraftName(data.community.name);
    if (cands.ok) setCandidates(await cands.json());
    setState('ready');
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Stripe returns to ?stripe=return (finished or abandoned the flow) or
  // ?stripe=refresh (the single-use account link expired). Read from location so
  // this client page needs no Suspense boundary.
  useEffect(() => {
    const outcome = new URLSearchParams(window.location.search).get('stripe');
    if (!outcome) return;

    if (outcome === 'refresh') {
      toast('That onboarding link expired. Start it again.', 'info');
    }

    window.history.replaceState(null, '', window.location.pathname);
  }, [toast]);

  /** Every mutation reports the server's own message — these rules are enforced there. */
  async function send(url: string, method: string, body?: unknown, success?: string) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast(data?.error ?? 'That change could not be saved.', 'error');
        return false;
      }
      if (success) toast(success, 'success');
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  }

  /**
   * Creates the connected account if needed and hands off to Stripe-hosted
   * onboarding. Account links are single-use, so this is also the "continue"
   * action for a half-finished account.
   */
  async function connectStripe() {
    setConnecting(true);
    try {
      const res = await fetch(`/api/admin/communities/${id}/stripe`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        toast(data?.error ?? 'Could not start Stripe onboarding.', 'error');
        setConnecting(false);
        return;
      }
      // Full navigation: onboarding is hosted by Stripe.
      window.location.assign(data.url);
    } catch {
      toast('Could not start Stripe onboarding.', 'error');
      setConnecting(false);
    }
  }

  if (state === 'loading') return <LoadingState />;
  if (state === 'error' || !community) {
    return <ErrorState message="This community could not be loaded." onRetry={load} />;
  }

  const assignedIds = staff.map((s) => s.user.id);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        href="/dashboard/communities"
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to Communities
      </Link>

      {/* Name */}
      <header className={card}>
        {editingName ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await send(`/api/admin/communities/${id}`, 'PATCH', { name: draftName }, 'Community renamed'))
                setEditingName(false);
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <div className="flex-1 min-w-[16rem]">
              <label htmlFor="community-name" className="block text-xs font-medium text-gray-500 mb-1">
                Community name
              </label>
              <input
                id="community-name"
                required
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className={input}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 text-sm rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingName(false);
                setDraftName(community.name);
              }}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{community.name}</h1>
              <p className="text-sm text-gray-500 mt-1">
                Created {new Date(community.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                <span className="text-gray-400"> · not editable</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
            >
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
              Rename
            </button>
          </div>
        )}
      </header>

      {/* Online payments (Stripe Connect) */}
      <section aria-labelledby="stripe-heading" className={card}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 id="stripe-heading" className={heading}>
            Online payments
          </h2>
          {stripe && (
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
                stripe.canAcceptPayments
                  ? 'bg-green-100 text-green-800'
                  : stripe.stripeAccountId
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {stripe.canAcceptPayments
                ? 'Accepting payments'
                : stripe.stripeAccountId
                  ? 'Onboarding incomplete'
                  : 'Not connected'}
            </span>
          )}
        </div>

        {!stripe ? (
          <p className="text-sm text-gray-500">Payment status could not be loaded.</p>
        ) : !stripe.stripeConfigured ? (
          <p className="text-sm text-gray-500">
            Stripe is not configured on this server. Set <code className="text-xs">STRIPE_SECRET_KEY</code> and{' '}
            <code className="text-xs">STRIPE_WEBHOOK_SECRET</code> to enable online payments.
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {stripe.canAcceptPayments
                ? 'Residents of this community can pay their balance online. Payouts go to this association\u2019s own bank account, and its name appears on the resident\u2019s statement.'
                : stripe.stripeAccountId
                  ? 'This association has started onboarding but cannot take payments yet. Stripe still needs more information.'
                  : 'Connect this association to Stripe so residents can pay online. The association is onboarded as its own merchant, so payouts and disputes belong to it rather than to the platform.'}
            </p>

            {stripe.refreshError && (
              <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-4">
                Showing the last known status \u2014 Stripe could not be reached just now.
              </p>
            )}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4 max-w-md">
              <dt className="text-gray-500">Details submitted</dt>
              <dd className="text-gray-900">{stripe.stripeDetailsSubmitted ? 'Yes' : 'No'}</dd>
              <dt className="text-gray-500">Charges enabled</dt>
              <dd className="text-gray-900">{stripe.stripeChargesEnabled ? 'Yes' : 'No'}</dd>
              <dt className="text-gray-500">Card payments</dt>
              <dd className="text-gray-900">{stripe.stripeCardPaymentsActive ? 'Active' : 'Not active'}</dd>
              {stripe.stripeAccountId && (
                <>
                  <dt className="text-gray-500">Account</dt>
                  <dd className="text-gray-900 font-mono text-xs break-all">{stripe.stripeAccountId}</dd>
                </>
              )}
            </dl>

            {!stripe.canAcceptPayments && (
              <button
                type="button"
                onClick={connectStripe}
                disabled={connecting || busy}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {stripe.stripeAccountId ? (
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <CreditCard className="w-4 h-4" aria-hidden="true" />
                )}
                {connecting
                  ? 'Opening Stripe\u2026'
                  : stripe.stripeAccountId
                    ? 'Continue onboarding'
                    : 'Connect with Stripe'}
              </button>
            )}
          </>
        )}
      </section>

      {/* Staff */}
      <section aria-labelledby="staff-heading" className={card}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 id="staff-heading" className={heading}>
            Staff assignments ({staff.length})
          </h2>
          <button
            type="button"
            onClick={() => {
              setStaffDraft(assignedIds);
              setStaffOpen((o) => !o);
            }}
            className="text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
          >
            {staffOpen ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {staffOpen ? (
          <div className="space-y-3">
            <ul className="space-y-1 max-h-64 overflow-y-auto">
              {candidates.staff.map((u) => (
                <li key={u.id}>
                  <label className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={staffDraft.includes(u.id)}
                      onChange={(e) =>
                        setStaffDraft((prev) => (e.target.checked ? [...prev, u.id] : prev.filter((x) => x !== u.id)))
                      }
                      className="rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-900">{name(u)}</span>
                    <StatusBadge status={u.role} />
                    <span className="text-xs text-gray-400 truncate">{u.email}</span>
                  </label>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (await send(`/api/admin/communities/${id}/staff`, 'PUT', { userIds: staffDraft }, 'Staff updated'))
                  setStaffOpen(false);
              }}
              className="px-4 py-2 text-sm rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Save assignments
            </button>
          </div>
        ) : staff.length === 0 ? (
          <p className="text-sm text-gray-500">No staff assigned. Nobody can administer this community.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {staff.map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="text-gray-900">{name(s.user)}</span>
                <StatusBadge status={s.user.role} />
                <span className="text-xs text-gray-400 truncate ml-auto">{s.user.email}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Residents */}
      <section aria-labelledby="residents-heading" className={card}>
        <h2 id="residents-heading" className={`${heading} mb-1`}>
          Residents ({residents.length})
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          A resident always belongs to a community, so they are moved between communities rather than removed. Someone
          who still owns property here must hand it over first — see Properties below.
        </p>

        {residents.length === 0 ? (
          <p className="text-sm text-gray-500 mb-3">No residents in this community.</p>
        ) : (
          <ul className="divide-y divide-gray-100 mb-3">
            {residents.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <Link
                  href={`/dashboard/users/${r.id}`}
                  className="text-gray-900 hover:text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                >
                  {name(r)}
                </Link>
                <span className="text-xs text-gray-400 truncate">{r.email}</span>
                <span className="text-xs text-gray-500 ml-auto">
                  {r._count.properties} propert{r._count.properties === 1 ? 'y' : 'ies'}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-2 pt-3 border-t border-gray-100">
          <div className="flex-1 min-w-[16rem]">
            <label htmlFor="move-in" className="block text-xs font-medium text-gray-500 mb-1">
              Move a resident into this community
            </label>
            <select id="move-in" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} className={input}>
              <option value="">Select a resident…</option>
              {candidates.residents.map((c) => (
                <option key={c.id} value={c.id}>
                  {name(c)} — {c.community?.name ?? 'no community'}
                  {c._count.properties > 0 ? ` (owns ${c._count.properties})` : ''}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={busy || !moveIn}
            onClick={async () => {
              if (await send(`/api/admin/communities/${id}/residents`, 'POST', { userId: moveIn }, 'Resident moved in'))
                setMoveIn('');
            }}
            className="px-4 py-2 text-sm rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Move in
          </button>
        </div>
      </section>

      {/* Properties */}
      <section aria-labelledby="properties-heading" className={card}>
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 id="properties-heading" className={heading}>
            Properties ({properties.length})
          </h2>
          <button
            type="button"
            onClick={() => setShowPropertyForm((o) => !o)}
            className="text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
          >
            {showPropertyForm ? 'Cancel' : '+ Add property'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          A property stays with its community permanently. When a resident moves out, change the owner to whoever is
          moving in.
        </p>

        {showPropertyForm && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await send(
                  `/api/admin/communities/${id}/properties`,
                  'POST',
                  { ...propertyForm, unitNumber: propertyForm.unitNumber || null },
                  'Property added'
                )
              ) {
                setPropertyForm(EMPTY_PROPERTY);
                setShowPropertyForm(false);
              }
            }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 pb-4 border-b border-gray-100"
          >
            <div className="sm:col-span-2">
              <label htmlFor="p-street" className="block text-xs font-medium text-gray-500 mb-1">Street address</label>
              <input id="p-street" required value={propertyForm.streetAddress} onChange={(e) => setPropertyForm((p) => ({ ...p, streetAddress: e.target.value }))} className={input} />
            </div>
            <div>
              <label htmlFor="p-unit" className="block text-xs font-medium text-gray-500 mb-1">Unit <span className="font-normal text-gray-400">(optional)</span></label>
              <input id="p-unit" value={propertyForm.unitNumber} onChange={(e) => setPropertyForm((p) => ({ ...p, unitNumber: e.target.value }))} className={input} />
            </div>
            <div>
              <label htmlFor="p-city" className="block text-xs font-medium text-gray-500 mb-1">City</label>
              <input id="p-city" required value={propertyForm.city} onChange={(e) => setPropertyForm((p) => ({ ...p, city: e.target.value }))} className={input} />
            </div>
            <div>
              <label htmlFor="p-state" className="block text-xs font-medium text-gray-500 mb-1">State</label>
              <input id="p-state" required value={propertyForm.state} onChange={(e) => setPropertyForm((p) => ({ ...p, state: e.target.value }))} className={input} />
            </div>
            <div>
              <label htmlFor="p-zip" className="block text-xs font-medium text-gray-500 mb-1">ZIP code</label>
              <input id="p-zip" required value={propertyForm.zipCode} onChange={(e) => setPropertyForm((p) => ({ ...p, zipCode: e.target.value }))} className={input} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="p-owner" className="block text-xs font-medium text-gray-500 mb-1">Owner</label>
              <select id="p-owner" required value={propertyForm.ownerId} onChange={(e) => setPropertyForm((p) => ({ ...p, ownerId: e.target.value }))} className={input}>
                <option value="">Select a resident of this community…</option>
                {residents.map((r) => (
                  <option key={r.id} value={r.id}>{name(r)}</option>
                ))}
              </select>
              {residents.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">Move a resident in first — a property needs an owner.</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={busy} className="px-4 py-2 text-sm rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                Add property
              </button>
            </div>
          </form>
        )}

        {properties.length === 0 ? (
          <p className="text-sm text-gray-500">No properties in this community.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {properties.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block text-gray-900 truncate">
                    {p.streetAddress}
                    {p.unitNumber ? ` #${p.unitNumber}` : ''}
                  </span>
                  <span className="block text-xs text-gray-400">
                    {p.city}, {p.state} {p.zipCode}
                  </span>
                </span>
                <span>
                  <label htmlFor={`owner-${p.id}`} className="sr-only">
                    Owner of {p.streetAddress}
                  </label>
                  <select
                    id={`owner-${p.id}`}
                    value={p.owner.id}
                    disabled={busy}
                    onChange={(e) =>
                      send(
                        `/api/admin/communities/${id}/properties/${p.id}`,
                        'PATCH',
                        { ownerId: e.target.value },
                        'Ownership transferred'
                      )
                    }
                    className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {residents.map((r) => (
                      <option key={r.id} value={r.id}>{name(r)}</option>
                    ))}
                    {!residents.some((r) => r.id === p.owner.id) && (
                      <option value={p.owner.id}>{name(p.owner)} (not in this community)</option>
                    )}
                  </select>
                </span>
                <button
                  type="button"
                  onClick={() => setDeleting(p)}
                  aria-label={`Delete ${p.streetAddress}`}
                  className="p-1 text-gray-400 hover:text-red-600 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={!!deleting}
        title="Delete property"
        description={`"${deleting?.streetAddress}" will be permanently removed. This is refused if any charges, issues, violations or requests reference it.`}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (deleting) await send(`/api/admin/communities/${id}/properties/${deleting.id}`, 'DELETE', undefined, 'Property deleted');
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
