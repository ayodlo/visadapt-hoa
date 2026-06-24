import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { User, dashboardPath } from '../types';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const DEMO_ACCOUNTS = [
  { label: 'Resident', email: 'resident@communityhq.local', password: 'password123' },
  { label: 'Admin', email: 'admin@communityhq.local', password: 'password123' },
  { label: 'Board Member', email: 'board@communityhq.local', password: 'password123' },
] as const;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setServerError(null);
    try {
      const res = await apiClient.post<{ token: string; user: User }>('/api/auth/login', data);
      login(res.token, res.user);
      navigate(dashboardPath(res.user.role), { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  function fillDemo(email: string, password: string) {
    setValue('email', email);
    setValue('password', password);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <div>
          <Link to="/" className="text-brand-700 font-bold text-xl">
            CommunityHQ
          </Link>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">Sign in to your account</h2>
        </div>

        {/* Demo account quick-fill */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Demo accounts</p>
          <div className="flex gap-2">
            {DEMO_ACCOUNTS.map(({ label, email, password }) => (
              <button
                key={label}
                type="button"
                onClick={() => fillDemo(email, password)}
                className="flex-1 text-xs border border-gray-200 rounded-lg py-2 px-3 text-gray-600 hover:bg-gray-50 hover:border-brand-300 hover:text-brand-700 transition-colors font-medium"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {serverError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {serverError}
            </p>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register('email')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand-600 text-white rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          Don't have an account?{' '}
          <Link to="/register" className="text-brand-600 font-medium hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
