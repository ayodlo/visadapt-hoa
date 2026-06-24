import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { User, fullName } from '../types';

const schema = z.object({
  label: z.string().min(1, 'Label is required').max(200),
  amountDollars: z.coerce.number().positive('Amount must be positive'),
  dueDate: z.string().min(1, 'Due date is required'),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function NewDuesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.get<{ users: User[] }>('/api/users'),
  });

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  function toggleUser(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const all = usersData?.users.map((u) => u.id) ?? [];
    setSelectedIds((prev) => prev.size === all.length ? new Set() : new Set(all));
  }

  const onSubmit = async (data: FormValues) => {
    if (selectedIds.size === 0) {
      setServerError('Select at least one resident');
      return;
    }
    setServerError(null);
    try {
      await apiClient.post('/api/dues', {
        label: data.label,
        amountCents: Math.round(data.amountDollars * 100),
        dueDate: new Date(data.dueDate).toISOString(),
        notes: data.notes || undefined,
        userIds: Array.from(selectedIds),
      });
      await queryClient.invalidateQueries({ queryKey: ['dues'] });
      navigate('/dues', { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to create dues');
    }
  };

  const users = usersData?.users ?? [];
  const allSelected = users.length > 0 && selectedIds.size === users.length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/dues" className="text-sm text-gray-400 hover:text-gray-600">← Back</Link>
        <h1 className="text-2xl font-bold text-gray-900">Charge Dues</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {serverError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{serverError}</p>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="font-medium text-gray-900">Details</h2>

          <div>
            <label htmlFor="label" className="block text-sm font-medium text-gray-700 mb-1">Label</label>
            <input
              id="label"
              type="text"
              {...register('label')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              placeholder="e.g. HOA Dues — Q3 2026"
            />
            {errors.label && <p className="mt-1 text-xs text-red-600">{errors.label.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="amountDollars" className="block text-sm font-medium text-gray-700 mb-1">Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  id="amountDollars"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('amountDollars')}
                  className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="150.00"
                />
              </div>
              {errors.amountDollars && <p className="mt-1 text-xs text-red-600">{errors.amountDollars.message}</p>}
            </div>

            <div>
              <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                id="dueDate"
                type="date"
                {...register('dueDate')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
              {errors.dueDate && <p className="mt-1 text-xs text-red-600">{errors.dueDate.message}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="notes"
              rows={2}
              {...register('notes')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-y"
              placeholder="Any additional info…"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-gray-900">Residents</h2>
            <button
              type="button"
              onClick={toggleAll}
              className="text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          {users.length === 0 && (
            <p className="text-sm text-gray-400">Loading residents…</p>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.has(u.id)}
                  onChange={() => toggleUser(u.id)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{fullName(u)}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </div>
              </label>
            ))}
          </div>

          {selectedIds.size > 0 && (
            <p className="text-xs text-gray-500 pt-1">
              {selectedIds.size} resident{selectedIds.size !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Link to="/dues" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">Cancel</Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Charging…' : `Charge ${selectedIds.size > 0 ? selectedIds.size : ''} Resident${selectedIds.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </form>
    </div>
  );
}
