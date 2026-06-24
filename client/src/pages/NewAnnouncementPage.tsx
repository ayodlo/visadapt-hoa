import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { Announcement } from '../types';

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  body: z.string().min(1, 'Body is required'),
});

type FormValues = z.infer<typeof schema>;

export function NewAnnouncementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      await apiClient.post<{ announcement: Announcement }>('/api/announcements', data);
      await queryClient.invalidateQueries({ queryKey: ['announcements'] });
      navigate('/', { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to post announcement');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Announcement</h1>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4"
      >
        {serverError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {serverError}
          </p>
        )}

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            id="title"
            type="text"
            {...register('title')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="e.g. Pool closed this weekend"
          />
          {errors.title && (
            <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-1">
            Message
          </label>
          <textarea
            id="body"
            rows={6}
            {...register('body')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-y"
            placeholder="Write your announcement here…"
          />
          {errors.body && (
            <p className="mt-1 text-xs text-red-600">{errors.body.message}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            to="/"
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Posting…' : 'Post Announcement'}
          </button>
        </div>
      </form>
    </div>
  );
}
