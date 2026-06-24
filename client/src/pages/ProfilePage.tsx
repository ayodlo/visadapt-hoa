import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { User } from '../types';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent';

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const {
    register: regProfile,
    handleSubmit: handleProfile,
    formState: { errors: profileErrors },
    setError: setProfileError,
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
    },
  });

  const {
    register: regPassword,
    handleSubmit: handlePassword,
    formState: { errors: passwordErrors },
    setError: setPasswordError,
    reset: resetPassword,
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const { mutate: saveProfile, isPending: savingProfile } = useMutation({
    mutationFn: (data: ProfileForm) =>
      apiClient.patch<{ user: User }>('/api/auth/profile', data),
    onSuccess: ({ user: updated }) => {
      setUser(updated);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    },
    onError: (err: Error) => {
      setProfileError('email', { message: err.message });
    },
  });

  const { mutate: savePassword, isPending: savingPassword } = useMutation({
    mutationFn: ({ currentPassword, newPassword }: PasswordForm) =>
      apiClient.patch('/api/auth/password', { currentPassword, newPassword }),
    onSuccess: () => {
      resetPassword();
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    },
    onError: (err: Error) => {
      setPasswordError('currentPassword', { message: err.message });
    },
  });

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Profile & Settings</h1>

      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Personal information</h2>

        {profileSuccess && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Profile updated successfully.
          </p>
        )}

        <form onSubmit={handleProfile((d) => saveProfile(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" error={profileErrors.firstName?.message}>
              <input {...regProfile('firstName')} className={inputClass} autoComplete="given-name" />
            </Field>
            <Field label="Last name" error={profileErrors.lastName?.message}>
              <input {...regProfile('lastName')} className={inputClass} autoComplete="family-name" />
            </Field>
          </div>
          <Field label="Email" error={profileErrors.email?.message}>
            <input {...regProfile('email')} type="email" className={inputClass} />
          </Field>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-gray-400">
              Role: <span className="font-medium text-gray-500">{user?.role.replace('_', ' ')}</span>
            </span>
            <button
              type="submit"
              disabled={savingProfile}
              className="bg-brand-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {savingProfile ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Change password</h2>

        {passwordSuccess && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Password changed successfully.
          </p>
        )}

        <form onSubmit={handlePassword((d) => savePassword(d))} className="space-y-4">
          <Field label="Current password" error={passwordErrors.currentPassword?.message}>
            <input {...regPassword('currentPassword')} type="password" className={inputClass} autoComplete="current-password" />
          </Field>
          <Field label="New password" error={passwordErrors.newPassword?.message}>
            <input {...regPassword('newPassword')} type="password" className={inputClass} autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password" error={passwordErrors.confirmPassword?.message}>
            <input {...regPassword('confirmPassword')} type="password" className={inputClass} autoComplete="new-password" />
          </Field>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={savingPassword}
              className="bg-brand-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {savingPassword ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
