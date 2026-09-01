'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/context/session';
import { isStaff } from '@/lib/roles';
import { useListControls } from '@/hooks/useListControls';
import { ListToolbar } from '@/components/ui/ListToolbar';
import type { ListField } from '@/lib/list-controls';
import { IMAGE_ACCEPT, MAX_IMAGE_BYTES, formatBytes, validateImage } from '@/lib/uploads';

interface Creator { id: string; firstName: string; lastName: string; }
interface Event { id: string; title: string; description?: string; location?: string; startAt: string; endAt?: string; createdBy: Creator; imageUrl?: string | null; }

const FIELDS: ListField<Event>[] = [
  { key: 'title', label: 'Title', value: (e) => e.title },
  { key: 'location', label: 'Location', value: (e) => e.location ?? '', filterable: true },
  { key: 'description', label: 'Description', value: (e) => e.description ?? '', sortable: false },
  { key: 'startAt', label: 'Start', type: 'date', value: (e) => e.startAt, text: (e) => new Date(e.startAt).toLocaleString() },
  { key: 'endAt', label: 'End', type: 'date', value: (e) => e.endAt ?? null, text: (e) => (e.endAt ? new Date(e.endAt).toLocaleString() : '') },
  { key: 'createdBy', label: 'Created by', value: (e) => `${e.createdBy.firstName} ${e.createdBy.lastName}`, filterable: true },
];

export default function EventsPage() {
  const { role } = useSession();
  const isAdmin = isStaff(role);

  const [items, setItems] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', location: '', startAt: '', endAt: '' });
  const [submitting, setSubmitting] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState('');
  const controls = useListControls(items, FIELDS);

  function clearImage() {
    // Object URLs are leaked memory until revoked.
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(null);
    setImagePreview(null);
    setImageError('');
  }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    clearImage();
    if (!file) return;

    // Same rules the API enforces, checked here so an oversized file is caught
    // before it is uploaded rather than after.
    const invalid = validateImage({ type: file.type, size: file.size, name: file.name });
    if (invalid) {
      setImageError(invalid);
      e.target.value = '';
      return;
    }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function load() {
    const res = await fetch('/api/events');
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload: Record<string, string> = { title: form.title, startAt: new Date(form.startAt).toISOString() };
    if (form.description) payload.description = form.description;
    if (form.location) payload.location = form.location;
    if (form.endAt) payload.endAt = new Date(form.endAt).toISOString();

    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      // The image is a second step so the JSON create contract stays unchanged.
      // A failed image upload must not discard an event that was created fine —
      // report it and keep the event.
      if (image) {
        const created = await res.json().catch(() => null);
        if (created?.id) {
          const body = new FormData();
          body.append('image', image);
          const imgRes = await fetch(`/api/events/${created.id}/image`, { method: 'POST', body });
          if (!imgRes.ok) {
            const data = await imgRes.json().catch(() => null);
            setImageError(data?.error ?? 'Event was created, but the image could not be uploaded.');
            setSubmitting(false);
            load();
            return;
          }
        }
      }
      setForm({ title: '', description: '', location: '', startAt: '', endAt: '' });
      clearImage();
      setShowForm(false);
      load();
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this event?')) return;
    await fetch(`/api/events/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">+ New</button>
        )}
      </div>

      {isAdmin && showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-3">
          <input required placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input placeholder="Location" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <textarea placeholder="Description" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-gray-500 mb-1">Start</label><input required type="datetime-local" value={form.startAt} onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">End (optional)</label><input type="datetime-local" value={form.endAt} onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          </div>
          <div>
            <label htmlFor="event-image" className="block text-xs text-gray-500 mb-1">
              Image <span className="text-gray-400">(optional — JPEG, PNG, WebP, or GIF, up to {formatBytes(MAX_IMAGE_BYTES)})</span>
            </label>
            <input
              id="event-image"
              type="file"
              accept={IMAGE_ACCEPT}
              onChange={handleImagePick}
              aria-describedby={imageError ? 'event-image-error' : undefined}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
            {imageError && (
              <p id="event-image-error" role="alert" className="mt-1 text-xs text-red-600">{imageError}</p>
            )}
            {imagePreview && (
              <div className="mt-2 flex items-start gap-3">
                {/* Local object URL for a just-picked file — next/image adds nothing here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="" className="h-24 w-40 object-cover rounded-lg border border-gray-200" />
                <button type="button" onClick={clearImage} className="text-xs text-gray-500 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1">
                  Remove image
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">{submitting ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => { setShowForm(false); clearImage(); }} className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <p className="text-gray-500 text-sm">Loading…</p> : items.length === 0 ? <p className="text-gray-500 text-sm">No events yet.</p> : (
        <>
        <ListToolbar controls={controls} searchPlaceholder="Search title, location, description…" showSort noun="event" />
        {controls.visible.length === 0 ? (
          <p className="text-gray-500 text-sm">No events match your search.</p>
        ) : (
        <div className="space-y-4">
          {controls.visible.map((item) => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Rendered only when an image exists — no placeholder, no empty frame. */}
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={`${item.title} event image`}
                  className="w-full h-48 sm:h-56 object-cover border-b border-gray-200"
                />
              )}
              <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {new Date(item.startAt).toLocaleString()}{item.endAt ? ` – ${new Date(item.endAt).toLocaleString()}` : ''}
                    {item.location ? ` · ${item.location}` : ''}
                  </p>
                </div>
                {isAdmin && (
                  <button onClick={() => handleDelete(item.id)} className="text-xs text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">Delete</button>
                )}
              </div>
              {item.description && <p className="mt-3 text-sm text-gray-700">{item.description}</p>}
              </div>
            </div>
          ))}
        </div>
        )}
        </>
      )}
    </div>
  );
}
