import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getItem, setItem, deleteItem } from './secureStorage';
import { apiFetch, setAuthToken, setActiveCommunityId as setActiveCommunityHeader, setUnauthorizedHandler, ApiError } from '@/api/client';
import { getMyCommunities } from '@/api/community';
import { registerPushToken } from '@/notifications/registerPushToken';
import type { SessionUser } from '@/types/auth';
import type { Community } from '@/types/community';

const TOKEN_KEY = 'communityhq_token';
const COMMUNITY_KEY = 'communityhq_active_community';

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
  // Staff-only (ADMIN/BOARD_MEMBER/SUPER_ADMIN). Null for RESIDENT, who has one fixed community.
  activeCommunityId: string | null;
  communities: Community[];
  switchCommunity: (communityId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCommunityId, setActiveCommunityId] = useState<string | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);

  async function logout() {
    setAuthToken(null);
    setActiveCommunityHeader(null);
    setUser(null);
    setActiveCommunityId(null);
    setCommunities([]);
    await deleteItem(TOKEN_KEY);
    await deleteItem(COMMUNITY_KEY);
  }

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void logout();
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  async function bootstrapCommunities(sessionUser: SessionUser) {
    if (sessionUser.role === 'RESIDENT') return;
    try {
      const stored = await getItem(COMMUNITY_KEY);
      if (stored) setActiveCommunityHeader(stored);
      const res = await getMyCommunities();
      setCommunities(res.communities);
      const resolved =
        stored && res.communities.some((c) => c.id === stored) ? stored : res.activeCommunityId;
      if (resolved) {
        setActiveCommunityHeader(resolved);
        setActiveCommunityId(resolved);
        await setItem(COMMUNITY_KEY, resolved);
      }
    } catch {
      // Non-fatal — dashboard screens will surface a "no community selected" error if this never resolves.
    }
  }

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
        await bootstrapCommunities(me.user);
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
    await bootstrapCommunities(res.user);
    void registerPushToken();
  }

  function updateUser(nextUser: SessionUser) {
    setUser(nextUser);
  }

  async function switchCommunity(communityId: string) {
    setActiveCommunityHeader(communityId);
    setActiveCommunityId(communityId);
    await setItem(COMMUNITY_KEY, communityId);
  }

  const value = useMemo(
    () => ({ user, isLoading, login, logout, updateUser, activeCommunityId, communities, switchCommunity }),
    [user, isLoading, activeCommunityId, communities]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
