'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isAdmin } from '@/lib/roles';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, isDemoLoginEnabled } from '@/lib/demo';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await signIn(email, password);
  }

  async function signIn(loginEmail: string, loginPassword: string) {
    setError('');
    setLoading(true);
    try {

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) { 
        setError(data.error ?? 'Login failed');
        return 
      }

      const role = data.user?.role;

      const dest = isAdmin(role) ? '/admin/dashboard' : role === 'BOARD_MEMBER' ? '/board/dashboard' : '/resident/dashboard';
      
      router.push(dest);
      router.refresh();
    } catch {
      setError('Failed to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white text-gray-900 rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-blue-600 mb-1">Portal HOA</h1>
        <h2 className="text-xl font-semibold mb-6">Sign in to your account</h2>

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">Forgot password?</Link>
            </div>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {isDemoLoginEnabled() && (
          <section aria-labelledby="demo-heading" className="mt-6 border-t border-gray-200 pt-6">
            <h3 id="demo-heading" className="text-sm font-semibold text-gray-900">Try the demo</h3>
            <p className="mt-1 mb-3 text-sm text-gray-600">
              Explore a sample community as any role. Changes are reset every night.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  disabled={loading}
                  onClick={() => signIn(account.email, DEMO_PASSWORD)}
                  className="border border-gray-300 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {account.label}
                </button>
              ))}
            </div>
          </section>
        )}

        <p className="mt-4 text-sm text-center text-gray-600">
          Don&apos;t have an account? Contact your HOA administrator to be added.
        </p>
      </div>
    </div>
  );
}
