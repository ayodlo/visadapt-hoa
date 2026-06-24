import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

const schema = z.object({
  question: z.string().min(1, 'Question is required').max(500),
  description: z.string().optional(),
  closesAt: z.string().optional(),
  options: z.array(z.object({ text: z.string().min(1, 'Option cannot be empty') }))
    .min(2, 'At least two options required'),
});

type FormValues = z.infer<typeof schema>;

export function NewPollPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { options: [{ text: '' }, { text: '' }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'options' });

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      await apiClient.post('/api/polls', {
        question: data.question,
        description: data.description || undefined,
        closesAt: data.closesAt ? new Date(data.closesAt).toISOString() : undefined,
        options: data.options.map((o) => o.text),
      });
      await queryClient.invalidateQueries({ queryKey: ['polls'] });
      navigate('/polls', { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to create poll');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/polls" className="text-sm text-gray-400 hover:text-gray-600">← Back</Link>
        <h1 className="text-2xl font-bold text-gray-900">New Poll</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        {serverError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{serverError}</p>
        )}

        <div>
          <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-1">Question</label>
          <input
            id="question"
            type="text"
            {...register('question')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="e.g. Should we install a dog park?"
          />
          {errors.question && <p className="mt-1 text-xs text-red-600">{errors.question.message}</p>}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="description"
            rows={2}
            {...register('description')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-y"
            placeholder="Any extra context for voters…"
          />
        </div>

        <div>
          <label htmlFor="closesAt" className="block text-sm font-medium text-gray-700 mb-1">
            Closes at <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="closesAt"
            type="datetime-local"
            {...register('closesAt')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Options</label>
          {fields.map((field, i) => (
            <div key={field.id} className="flex gap-2">
              <input
                type="text"
                {...register(`options.${i}.text`)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder={`Option ${i + 1}`}
              />
              {fields.length > 2 && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-gray-400 hover:text-red-500 px-2 transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {errors.options?.root && (
            <p className="text-xs text-red-600">{errors.options.root.message}</p>
          )}
          {fields.length < 10 && (
            <button
              type="button"
              onClick={() => append({ text: '' })}
              className="text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              + Add option
            </button>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link to="/polls" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">Cancel</Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Creating…' : 'Create Poll'}
          </button>
        </div>
      </form>
    </div>
  );
}
