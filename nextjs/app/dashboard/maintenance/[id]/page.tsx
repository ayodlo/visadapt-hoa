'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Paperclip } from 'lucide-react';
import { useSession } from '@/context/session';
import { useToast } from '@/context/toast';
import { isStaff } from '@/lib/roles';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  CATEGORIES,
  CONTACT_METHODS,
  ENTRY_PERMISSIONS,
  LOCATION_TYPES,
  ONGOING_STATUSES,
  PROPERTY_SCOPES,
  URGENCIES,
  isEmergency,
  labelFor,
} from '@/lib/maintenance';

const STATUSES = ['SUBMITTED', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

interface Request {
  id: string;
  requestNumber: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string | null;
  locationType: string | null;
  specificLocation: string | null;
  residentUrgency: string | null;
  firstObservedAt: string | null;
  ongoingStatus: string | null;
  propertyScope: string | null;
  entryPermission: string | null;
  accessInstructions: string | null;
  petsOnProperty: boolean | null;
  preferredContactMethod: string | null;
  createdAt: string;
  submittedBy: { id: string; firstName: string; lastName: string; email: string };
  property: { id: string; streetAddress: string; unitNumber: string | null; city: string; state: string } | null;
}

interface Attachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  isImage: boolean;
  url: string | null;
}

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** One labelled value. Shows an em dash rather than hiding a field left unanswered. */
function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5 break-words">{value || '—'}</dd>
    </div>
  );
}

export default function MaintenanceRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const session = useSession();
  const staff = isStaff(session.role);
  const { toast } = useToast();

  const [request, setRequest] = useState<Request | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    const res = await fetch(`/api/maintenance/${id}`);
    if (!res.ok) {
      setState('error');
      return;
    }
    setRequest(await res.json());

    // A second call, because attachment URLs are presigned and short-lived —
    // they are minted per view rather than stored alongside the record.
    const files = await fetch(`/api/maintenance/${id}/attachments`);
    if (files.ok) {
      const data = await files.json();
      setAttachments(Array.isArray(data?.attachments) ? data.attachments : []);
    }
    setState('ready');
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(field: 'status' | 'priority', value: string) {
    if (!request) return;
    const previous = request[field];
    setRequest({ ...request, [field]: value });
    setSaving(true);
    const res = await fetch(`/api/maintenance/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    setSaving(false);
    if (!res.ok) {
      // Restore the previous value. The list page swallowed rejected updates and
      // left the control showing a change the server never accepted.
      setRequest((r) => (r ? { ...r, [field]: previous } : r));
      const body = await res.json().catch(() => null);
      toast(body?.error ?? 'Could not update this request.', 'error');
      return;
    }
    toast(field === 'status' ? 'Status updated.' : 'Priority updated.', 'success');
  }

  if (state === 'loading') return <LoadingState />;
  if (state === 'error' || !request) {
    return <ErrorState message="This request could not be loaded, or is not yours to view." onRetry={load} />;
  }

  const urgent = isEmergency(request.residentUrgency ?? '');
  const locationLine = [labelFor(LOCATION_TYPES, request.locationType), request.specificLocation]
    .filter((part) => part && part !== '—')
    .join(' — ');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/dashboard/maintenance"
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to Maintenance
      </Link>

      <header className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {request.requestNumber && (
            <span className="text-xs font-mono text-gray-500">{request.requestNumber}</span>
          )}
          <StatusBadge status={request.status} />
          <StatusBadge status={request.priority} />
          {urgent && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
              Resident marked emergency
            </span>
          )}
        </div>
        <h1 className="text-xl font-bold text-gray-900">{request.title}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Submitted by {request.submittedBy.firstName} {request.submittedBy.lastName} on{' '}
          {fmtDateTime(request.createdAt)}
        </p>

        {staff && (
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100">
            <div>
              <label htmlFor="mr-status" className="block text-xs font-medium text-gray-500 mb-1">
                Status
              </label>
              <select
                id="mr-status"
                value={request.status}
                disabled={saving}
                onChange={(e) => patch('status', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="mr-priority" className="block text-xs font-medium text-gray-500 mb-1">
                Priority
              </label>
              <select
                id="mr-priority"
                value={request.priority}
                disabled={saving}
                onChange={(e) => patch('priority', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </header>

      <section aria-labelledby="mr-description-heading" className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 id="mr-description-heading" className="text-sm font-semibold text-gray-900 mb-2">
          Description
        </h2>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{request.description}</p>
      </section>

      <section aria-labelledby="mr-details-heading" className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 id="mr-details-heading" className="text-sm font-semibold text-gray-900 mb-4">
          Request details
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <Detail label="Type" value={labelFor(CATEGORIES, request.category)} />
          <Detail label="Location" value={locationLine} />
          <Detail label="Resident urgency" value={labelFor(URGENCIES, request.residentUrgency)} />
          <Detail label="First noticed" value={fmtDate(request.firstObservedAt)} />
          <Detail label="Currently happening" value={labelFor(ONGOING_STATUSES, request.ongoingStatus)} />
          <Detail label="Related to" value={labelFor(PROPERTY_SCOPES, request.propertyScope)} />
          <Detail
            label="Property"
            value={
              request.property
                ? `${request.property.streetAddress}${
                    request.property.unitNumber ? ` #${request.property.unitNumber}` : ''
                  }, ${request.property.city}, ${request.property.state}`
                : null
            }
          />
          <Detail label="Preferred contact" value={labelFor(CONTACT_METHODS, request.preferredContactMethod)} />
        </dl>
      </section>

      <section aria-labelledby="mr-access-heading" className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 id="mr-access-heading" className="text-sm font-semibold text-gray-900 mb-4">
          Access
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <Detail label="Permission to enter" value={labelFor(ENTRY_PERMISSIONS, request.entryPermission)} />
          <Detail
            label="Pets on property"
            value={request.petsOnProperty === null ? null : request.petsOnProperty ? 'Yes' : 'No'}
          />
          <div className="sm:col-span-2">
            <Detail label="Access instructions" value={request.accessInstructions} />
          </div>
        </dl>
      </section>

      <section aria-labelledby="mr-files-heading" className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 id="mr-files-heading" className="text-sm font-semibold text-gray-900 mb-4">
          Photos and documents{attachments.length > 0 ? ` (${attachments.length})` : ''}
        </h2>
        {attachments.length === 0 ? (
          <p className="text-sm text-gray-500">No files were attached to this request.</p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {attachments.map((file) => (
              <li key={file.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <a
                  href={file.url ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    file.url ? 'hover:bg-gray-50' : 'pointer-events-none opacity-60'
                  }`}
                >
                  {file.isImage && file.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={file.url} alt={file.fileName} className="w-full h-28 object-cover" />
                  ) : (
                    <span className="flex items-center justify-center h-28 bg-gray-50">
                      <FileText className="w-8 h-8 text-gray-400" aria-hidden="true" />
                    </span>
                  )}
                  <span className="flex items-start gap-1.5 p-2">
                    <Paperclip className="w-3 h-3 mt-0.5 text-gray-400 flex-shrink-0" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-xs text-gray-900 truncate">{file.fileName}</span>
                      <span className="block text-xs text-gray-500">{fmtBytes(file.sizeBytes)}</span>
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
