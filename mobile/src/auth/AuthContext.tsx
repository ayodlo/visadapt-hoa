import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getItem, setItem, deleteItem } from './secureStorage';
import { apiFetch, setAuthToken, setUnauthorizedHandler, ApiError } from '@/api/client';
import { registerPushToken } from '@/notifications/registerPushToken';
import type { SessionUser } from '@/types/auth';

const TOKEN_KEY = 'communityhq_token';

interface LoginResponse {
  user: SessionUser;
  token: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: SessionUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function logout() {
    setAuthToken(null);
    setUser(null);
    await deleteItem(TOKEN_KEY);
  }

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void logout();
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    (async () => {
      const storedToken = await getItem(TOKEN_KEY);
      if (!storedToken) {
        setIsLoading(false);
        return;
      }
      setAuthToken(storedToken);
      try {
        const me = await apiFetch<{ user: SessionUser }>('/api/auth/me');
        setUser(me.user);
        void registerPushToken();
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 401)) {
          // Non-auth error (e.g. offline) — keep the token, let the user retry.
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function login(email: string, password: string) {
    const res = await apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await setItem(TOKEN_KEY, res.token);
    setAuthToken(res.token);
    setUser(res.user);
    void registerPushToken();
  }

  function updateUser(nextUser: SessionUser) {
    setUser(nextUser);
  }

  const value = useMemo(() => ({ user, isLoading, login, logout, updateUser }), [user, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
