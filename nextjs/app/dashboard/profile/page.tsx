'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/session';

export default function ProfilePage() {
  const user = useSession();
  const router = useRouter();

  const [nameForm, setNameForm] = useState({ firstName: user.firstName, lastName: user.lastName });
  const [nameStatus, setNameStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [nameSaving, setNameSaving] = useState(false);

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwStatus, setPwStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  async function handleNameUpdate(e: React.FormEvent) {
    e.preventDefault();
    setNameSaving(true);
    setNameStatus(null);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nameForm),
      });
      const data = await res.json();
      if (!res.ok) { setNameStatus({ ok: false, msg: data.error ?? 'Failed to update' }); return; }
      setNameStatus({ ok: true, msg: 'Profile updated' });
      router.refresh();
    } catch {
      setNameStatus({ ok: false, msg: 'Failed to connect. Please try again.' });
    } finally {
      setNameSaving(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwStatus({ ok: false, msg: 'Passwords do not match' });
      return;
    }
    setPwSaving(true);
    setPwStatus(null);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setPwStatus({ ok: false, msg: data.error ?? 'Failed to update' }); return; }
      setPwStatus({ ok: true, msg: 'Password changed successfully' });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch {
      setPwStatus({ ok: false, msg: 'Failed to connect. Please try again.' });
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Personal information</h2>
        <form onSubmit={handleNameUpdate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">First name</label>
              <input id="firstName" required value={nameForm.firstName}
                onChange={(e) => setNameForm((f) => ({ ...f, firstName: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
              <input id="lastName" required value={nameForm.lastName}
                onChange={(e) => setNameForm((f) => ({ ...f, lastName: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input disabled value={user.email}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
          </div>
          {nameStatus && (
            <p className={`text-sm ${nameStatus.ok ? 'text-green-600' : 'text-red-600'}`}>{nameStatus.msg}</p>
          )}
          <button type="submit" disabled={nameSaving}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {nameSaving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Change password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
            <input id="currentPassword" type="password" required value={pwForm.currentPassword}
              onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input id="newPassword" type="password" required minLength={8} value={pwForm.newPassword}
              onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
            <input id="confirmPassword" type="password" required value={pwForm.confirmPassword}
              onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {pwStatus && (
            <p className={`text-sm ${pwStatus.ok ? 'text-green-600' : 'text-red-600'}`}>{pwStatus.msg}</p>
          )}
          <button type="submit" disabled={pwSaving}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {pwSaving ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
