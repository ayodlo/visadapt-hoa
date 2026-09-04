'use client';

import { useEffect, useRef, useState } from 'react';
import { CircleCheck, Paperclip, TriangleAlert, Upload, X } from 'lucide-react';
import {
  ACCESS_INSTRUCTIONS_MAX,
  CATEGORIES,
  CONTACT_METHODS,
  DESCRIPTION_MAX,
  EMERGENCY_WARNING,
  ENTRY_PERMISSIONS,
  LOCATION_TYPES,
  ONGOING_STATUSES,
  PROPERTY_SCOPES,
  TITLE_MAX,
  URGENCIES,
  isEmergency,
  labelFor,
  needsAccessDetails,
  specificLocationsFor,
} from '@/lib/maintenance';
import { ATTACHMENT_ACCEPT, MAX_DIRECT_UPLOAD_BYTES, formatBytes, validateDirectUpload } from '@/lib/uploads';

interface Property {
  id: string;
  streetAddress: string;
  unitNumber: string | null;
}

interface Props {
  properties: Property[];
  onSubmitted: () => void;
}

const STEPS = ['Request', 'Details', 'Access', 'Attachments', 'Review'] as const;

const EMPTY = {
  category: '',
  locationType: '',
  specificLocation: '',
  title: '',
  description: '',
  firstObservedAt: '',
  ongoingStatus: '',
  residentUrgency: 'NORMAL',
  propertyScope: '',
  propertyId: '',
  entryPermission: '',
  accessInstructions: '',
  petsOnProperty: '',
  preferredContactMethod: '',
};

type FormState = typeof EMPTY;
type Errors = Partial<Record<keyof FormState, string>>;

/**
 * A file the resident picked. It uploads straight to S3 immediately, so a
 * failure is visible on this step — the form cannot be submitted with an
 * attachment that never stored.
 */
interface StagedFile {
  file: File;
  preview: string | null;
  status: 'uploading' | 'done' | 'error';
  /** Server-issued object key, present once the upload succeeds. */
  key?: string;
  error?: string;
}

const field = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

/** Only the fields a given step owns are validated when leaving it. */
function validateStep(step: number, form: FormState): Errors {
  const errors: Errors = {};
  if (step === 0) {
    if (!form.category) errors.category = 'Choose a type of request.';
    if (!form.locationType) errors.locationType = 'Choose where the issue is.';
    if (!form.title.trim()) errors.title = 'Enter a short title.';
    else if (form.title.length > TITLE_MAX) errors.title = `Keep the title under ${TITLE_MAX} characters.`;
    if (!form.description.trim()) errors.description = 'Describe the issue.';
    else if (form.description.length > DESCRIPTION_MAX) errors.description = `Keep the description under ${DESCRIPTION_MAX} characters.`;
  }
  if (step === 1) {
    if (!form.residentUrgency) errors.residentUrgency = 'Choose how urgent this is.';
    if (!form.propertyScope) errors.propertyScope = 'Tell us what this relates to.';
  }
  if (step === 2 && needsAccessDetails(form.propertyScope)) {
    if (!form.entryPermission) errors.entryPermission = 'Let us know about entry permission.';
  }
  return errors;
}

export function MaintenanceRequestForm({ properties, onSubmitted }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [fileError, setFileError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [created, setCreated] = useState<{ requestNumber: string | null; status: string } | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // Move focus to the new step's heading so keyboard and screen reader users
  // are not left at the bottom of the previous step.
  useEffect(() => { headingRef.current?.focus(); }, [step]);

  // Object URLs are leaked until revoked.
  useEffect(() => () => files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview)), [files]);

  const showAccessStep = needsAccessDetails(form.propertyScope);

  function goNext() {
    const found = validateStep(step, form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    // Skip Access entirely when the request is not about a private property.
    setStep((s) => (s === 1 && !showAccessStep ? 3 : s + 1));
  }

  function goBack() {
    setErrors({});
    setStep((s) => (s === 3 && !showAccessStep ? 1 : Math.max(0, s - 1)));
  }

  /** Ask the server for a one-object upload URL, then PUT the bytes to S3. */
  async function uploadOne(entry: StagedFile, index: number) {
    const patch = (next: Partial<StagedFile>) =>
      setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, ...next } : f)));

    try {
      const presignRes = await fetch('/api/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: entry.file.name,
          contentType: entry.file.type,
          size: entry.file.size,
          scope: 'maintenance',
        }),
      });
      const presign = await presignRes.json().catch(() => null);
      if (!presignRes.ok) {
        patch({ status: 'error', error: presign?.error ?? 'Could not prepare the upload.' });
        return;
      }

      // Straight to S3 — these bytes never pass through the app server.
      const put = await fetch(presign.url, {
        method: 'PUT',
        headers: { 'Content-Type': entry.file.type },
        body: entry.file,
      });
      if (!put.ok) {
        patch({ status: 'error', error: `Upload failed (${put.status}).` });
        return;
      }
      patch({ status: 'done', key: presign.key, error: undefined });
    } catch {
      patch({ status: 'error', error: 'Upload failed. Check your connection and retry.' });
    }
  }

  function addFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';

    const accepted: StagedFile[] = [];
    for (const file of picked) {
      const invalid = validateDirectUpload({ type: file.type, size: file.size, name: file.name });
      if (invalid) { setFileError(`${file.name}: ${invalid}`); continue; }
      accepted.push({
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        status: 'uploading',
      });
    }
    if (!accepted.length) return;

    setFileError('');
    setFiles((prev) => {
      const start = prev.length;
      accepted.forEach((entry, i) => void uploadOne(entry, start + i));
      return [...prev, ...accepted];
    });
  }

  function retryFile(index: number) {
    const entry = files[index];
    if (!entry) return;
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, status: 'uploading', error: undefined } : f)));
    void uploadOne(entry, index);
  }

  function removeFile(index: number) {
    setFiles((prev) => {
      const target = prev[index];
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit() {
    if (submitting) return; // guard against double submission
    // Attachments are already in S3 by now; refuse to submit while any is
    // unfinished or failed, so a request can never reference a missing file.
    if (files.some((f) => f.status !== 'done')) {
      setSubmitError('Some attachments have not finished uploading. Retry or remove them first.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        category: form.category,
        locationType: form.locationType,
        specificLocation: form.specificLocation || null,
        title: form.title.trim(),
        description: form.description.trim(),
        firstObservedAt: form.firstObservedAt ? new Date(form.firstObservedAt).toISOString() : null,
        ongoingStatus: form.ongoingStatus || null,
        residentUrgency: form.residentUrgency,
        propertyScope: form.propertyScope,
        entryPermission: showAccessStep ? form.entryPermission || null : null,
        accessInstructions: showAccessStep ? form.accessInstructions || null : null,
        petsOnProperty: showAccessStep && form.petsOnProperty ? form.petsOnProperty === 'YES' : null,
        preferredContactMethod: form.preferredContactMethod || null,
        propertyId: form.propertyId || null,
        // Keys the server issued and the browser uploaded to S3 directly.
        attachmentKeys: files.filter((f) => f.status === 'done' && f.key).map((f) => f.key),
      };

      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSubmitError(data?.error ?? 'Could not submit your request. Please try again.');
        return;
      }

      setCreated({ requestNumber: data.requestNumber, status: data.status });
      onSubmitted();
    } catch {
      setSubmitError('Could not submit your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div role="status" className="bg-white border border-gray-200 rounded-xl p-6 text-center">
        <CircleCheck className="w-10 h-10 text-green-600 mx-auto mb-3" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-gray-900">Request submitted</h2>
        <p className="text-sm text-gray-600 mt-1">
          Your request number is <span className="font-semibold text-gray-900">{created.requestNumber ?? '—'}</span>
        </p>
        <p className="text-sm text-gray-600 mt-1">Current status: {created.status}</p>
        {submitError && (
          <p role="alert" className="mt-3 text-sm text-red-600">{submitError}</p>
        )}
        <button
          type="button"
          onClick={() => { setCreated(null); setForm(EMPTY); setFiles([]); setStep(0); }}
          className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Submit another request
        </button>
      </div>
    );
  }

  const errorList = Object.entries(errors).filter(([, v]) => v);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      {/* Progress. The ordered list conveys position without relying on colour. */}
      <nav aria-label="Form progress" className="mb-5">
        <ol className="flex flex-wrap gap-x-2 gap-y-1 text-xs">
          {STEPS.map((name, i) => {
            const skipped = i === 2 && !showAccessStep;
            return (
              <li key={name} aria-current={i === step ? 'step' : undefined} className="flex items-center gap-1">
                <span
                  className={`px-2 py-0.5 rounded-full font-medium ${
                    i === step ? 'bg-blue-600 text-white' : skipped ? 'bg-gray-100 text-gray-400 line-through' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {i + 1}. {name}
                </span>
                {i < STEPS.length - 1 && <span aria-hidden="true" className="text-gray-300">›</span>}
              </li>
            );
          })}
        </ol>
        <p className="sr-only" aria-live="polite">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
      </nav>

      <h2 ref={headingRef} tabIndex={-1} className="text-base font-semibold text-gray-900 mb-4 focus:outline-none">
        {STEPS[step]}
      </h2>

      {errorList.length > 0 && (
        <div role="alert" className="mb-4 border border-red-200 bg-red-50 rounded-lg p-3">
          <p className="text-sm font-medium text-red-800">Please fix the following:</p>
          <ul className="mt-1 list-disc list-inside text-sm text-red-700">
            {errorList.map(([key, message]) => <li key={key}>{message}</li>)}
          </ul>
        </div>
      )}

      {step === 0 && (
        <div className="space-y-4">
          <Field id="mr-category" label="Type of request" required error={errors.category}>
            <select id="mr-category" value={form.category} onChange={(e) => set('category', e.target.value)}
              aria-describedby={errors.category ? 'mr-category-error' : undefined} className={field}>
              <option value="">Select a type…</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>

          <Field id="mr-location" label="Issue location" required error={errors.locationType}>
            <select id="mr-location" value={form.locationType}
              onChange={(e) => { set('locationType', e.target.value); set('specificLocation', ''); }}
              aria-describedby={errors.locationType ? 'mr-location-error' : undefined} className={field}>
              <option value="">Select a location…</option>
              {LOCATION_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>

          {form.locationType && (
            <Field id="mr-specific" label="Specific location">
              <select id="mr-specific" value={form.specificLocation}
                onChange={(e) => set('specificLocation', e.target.value)} className={field}>
                <option value="">Select…</option>
                {specificLocationsFor(form.locationType).map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
          )}

          <Field id="mr-title" label="Request title" required error={errors.title}
            help={`${form.title.length}/${TITLE_MAX} characters`}>
            <input id="mr-title" type="text" maxLength={TITLE_MAX} value={form.title}
              onChange={(e) => set('title', e.target.value)}
              aria-describedby={`mr-title-help${errors.title ? ' mr-title-error' : ''}`} className={field} />
          </Field>

          <Field id="mr-description" label="Detailed description" required error={errors.description}
            help={`${form.description.length}/${DESCRIPTION_MAX} characters`}>
            <textarea id="mr-description" rows={5} maxLength={DESCRIPTION_MAX} value={form.description}
              onChange={(e) => set('description', e.target.value)}
              aria-describedby={`mr-description-help${errors.description ? ' mr-description-error' : ''}`} className={field} />
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <Field id="mr-observed" label="When was the issue first noticed?">
            <input id="mr-observed" type="date" value={form.firstObservedAt}
              onChange={(e) => set('firstObservedAt', e.target.value)} className={field} />
          </Field>

          <Field id="mr-ongoing" label="Is it currently happening?">
            <select id="mr-ongoing" value={form.ongoingStatus} onChange={(e) => set('ongoingStatus', e.target.value)} className={field}>
              <option value="">Select…</option>
              {ONGOING_STATUSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>

          <Field id="mr-urgency" label="How urgent is this?" required error={errors.residentUrgency}>
            <select id="mr-urgency" value={form.residentUrgency} onChange={(e) => set('residentUrgency', e.target.value)}
              aria-describedby={isEmergency(form.residentUrgency) ? 'mr-emergency-warning' : undefined} className={field}>
              {URGENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>

          {isEmergency(form.residentUrgency) && (
            <div id="mr-emergency-warning" role="alert"
              className="flex items-start gap-2 border border-amber-300 bg-amber-50 rounded-lg p-3">
              <TriangleAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-amber-900">{EMERGENCY_WARNING}</p>
            </div>
          )}

          <Field id="mr-scope" label="Is this related to" required error={errors.propertyScope}>
            <select id="mr-scope" value={form.propertyScope} onChange={(e) => set('propertyScope', e.target.value)}
              aria-describedby={errors.propertyScope ? 'mr-scope-error' : undefined} className={field}>
              <option value="">Select…</option>
              {PROPERTY_SCOPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>

          {properties.length > 0 && needsAccessDetails(form.propertyScope) && (
            <Field id="mr-property" label="Which property?">
              <select id="mr-property" value={form.propertyId} onChange={(e) => set('propertyId', e.target.value)} className={field}>
                <option value="">Select…</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.streetAddress}{p.unitNumber ? ` ${p.unitNumber}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Field id="mr-entry" label="Permission to enter" required error={errors.entryPermission}>
            <select id="mr-entry" value={form.entryPermission} onChange={(e) => set('entryPermission', e.target.value)}
              aria-describedby={errors.entryPermission ? 'mr-entry-error' : undefined} className={field}>
              <option value="">Select…</option>
              {ENTRY_PERMISSIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>

          <Field id="mr-access" label="Access instructions"
            help={`${form.accessInstructions.length}/${ACCESS_INSTRUCTIONS_MAX} characters`}>
            <textarea id="mr-access" rows={3} maxLength={ACCESS_INSTRUCTIONS_MAX} value={form.accessInstructions}
              onChange={(e) => set('accessInstructions', e.target.value)}
              aria-describedby="mr-access-help" className={field} />
          </Field>

          <Field id="mr-pets" label="Pets on property">
            <select id="mr-pets" value={form.petsOnProperty} onChange={(e) => set('petsOnProperty', e.target.value)} className={field}>
              <option value="">Select…</option>
              <option value="YES">Yes</option>
              <option value="NO">No</option>
            </select>
          </Field>

          <Field id="mr-contact" label="Preferred contact method">
            <select id="mr-contact" value={form.preferredContactMethod}
              onChange={(e) => set('preferredContactMethod', e.target.value)} className={field}>
              <option value="">Select…</option>
              {CONTACT_METHODS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <label htmlFor="mr-files" className={labelCls}>
            Photos or documents <span className="font-normal text-gray-500">(optional)</span>
          </label>
          {/*
            The native file input is replaced by a styled label wrapping an
            sr-only input — the same pattern as ViolationAttachments. The
            browser-drawn "Choose Files" button takes no background from our
            palette (so it stays light in dark mode) and sits flush against an
            unexplained "No file chosen", which reads as two undifferentiated
            controls. Chosen files are listed below, so that native text was
            redundant as well as confusing. focus-within keeps the sr-only
            input's focus visible to keyboard users.
          */}
          <label
            htmlFor="mr-files"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 cursor-pointer transition-colors hover:bg-gray-50 hover:border-gray-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500"
          >
            <Upload className="w-4 h-4 text-gray-500" aria-hidden="true" />
            {files.length > 0 ? 'Add more files' : 'Choose files'}
            <input id="mr-files" type="file" multiple accept={ATTACHMENT_ACCEPT} onChange={addFiles}
              aria-describedby="mr-files-help" className="sr-only" />
          </label>
          <p id="mr-files-help" className="text-xs text-gray-500">
            Images and PDFs, up to {formatBytes(MAX_DIRECT_UPLOAD_BYTES)} each. Files upload as soon as you choose them.
          </p>
          {fileError && <p role="alert" className="text-xs text-red-600">{fileError}</p>}

          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((f, i) => (
                <li key={`${f.file.name}-${i}`} className="flex items-center gap-3 border border-gray-200 rounded-lg p-2">
                  {f.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.preview} alt="" className="w-12 h-12 object-cover rounded-md flex-shrink-0" />
                  ) : (
                    <span className="w-12 h-12 rounded-md bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                      <Paperclip className="w-4 h-4 text-gray-400" aria-hidden="true" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 truncate">{f.file.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatBytes(f.file.size)}
                      {f.status === 'uploading' && <span className="ml-2 text-blue-600">Uploading…</span>}
                      {f.status === 'done' && <span className="ml-2 text-green-700">Uploaded</span>}
                    </p>
                    {f.status === 'error' && (
                      <p role="alert" className="mt-0.5 flex items-center gap-1 text-xs text-red-600">
                        <TriangleAlert className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                        {f.error}
                        <button type="button" onClick={() => retryFile(i)}
                          className="ml-1 underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
                          Retry
                        </button>
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={() => removeFile(i)} aria-label={`Remove ${f.file.name}`}
                    className="p-1 text-gray-400 hover:text-red-600 rounded focus:outline-none focus:ring-2 focus:ring-red-500 flex-shrink-0">
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <Review label="Type" value={labelFor(CATEGORIES, form.category)} onEdit={() => setStep(0)} />
          <Review label="Location" value={`${labelFor(LOCATION_TYPES, form.locationType)}${form.specificLocation ? ` — ${form.specificLocation}` : ''}`} onEdit={() => setStep(0)} />
          <Review label="Title" value={form.title} onEdit={() => setStep(0)} />
          <Review label="Description" value={form.description} onEdit={() => setStep(0)} />
          <Review label="First noticed" value={form.firstObservedAt || '—'} onEdit={() => setStep(1)} />
          <Review label="Currently happening" value={labelFor(ONGOING_STATUSES, form.ongoingStatus)} onEdit={() => setStep(1)} />
          <Review label="Urgency" value={labelFor(URGENCIES, form.residentUrgency)} onEdit={() => setStep(1)} />
          <Review label="Related to" value={labelFor(PROPERTY_SCOPES, form.propertyScope)} onEdit={() => setStep(1)} />
          {showAccessStep && (
            <>
              <Review label="Permission to enter" value={labelFor(ENTRY_PERMISSIONS, form.entryPermission)} onEdit={() => setStep(2)} />
              <Review label="Access instructions" value={form.accessInstructions || '—'} onEdit={() => setStep(2)} />
              <Review label="Pets on property" value={form.petsOnProperty || '—'} onEdit={() => setStep(2)} />
              <Review label="Preferred contact" value={labelFor(CONTACT_METHODS, form.preferredContactMethod)} onEdit={() => setStep(2)} />
            </>
          )}
          <Review label="Attachments" value={files.length ? files.map((f) => f.file.name).join(', ') : 'None'} onEdit={() => setStep(3)} />

          {submitError && <p role="alert" className="text-sm text-red-600">{submitError}</p>}
        </div>
      )}

      <div className="flex items-center gap-2 mt-6 pt-4 border-t border-gray-200">
        {step > 0 && (
          <button type="button" onClick={goBack} disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50">
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={goNext}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            Next
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50">
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  id, label, required, error, help, children,
}: {
  id: string; label: string; required?: boolean; error?: string; help?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}{required && <span className="text-red-600" aria-hidden="true"> *</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children}
      {help && <p id={`${id}-help`} className="mt-1 text-xs text-gray-500">{help}</p>}
      {error && (
        // Errors carry text and an icon, never colour alone.
        <p id={`${id}-error`} className="mt-1 flex items-center gap-1 text-xs text-red-600">
          <TriangleAlert className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

function Review({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-2">
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm text-gray-900 break-words">{value || '—'}</p>
      </div>
      <button type="button" onClick={onEdit}
        className="text-xs text-blue-600 hover:underline flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
        Edit<span className="sr-only"> {label}</span>
      </button>
    </div>
  );
}
