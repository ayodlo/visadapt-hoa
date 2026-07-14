import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import * as secureStorage from '@/auth/secureStorage';
import { apiFetch, setAuthToken, setUnauthorizedHandler } from '@/api/client';
import { registerPushToken } from '@/notifications/registerPushToken';
import type { SessionUser } from '@/types/auth';

jest.mock('@/auth/secureStorage');
jest.mock('@/notifications/registerPushToken', () => ({ registerPushToken: jest.fn() }));
jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return {
    ...actual,
    apiFetch: jest.fn(),
    setAuthToken: jest.fn(),
    setUnauthorizedHandler: jest.fn(),
  };
});

const mockedApiFetch = apiFetch as jest.Mock;
const mockedSetAuthToken = setAuthToken as jest.Mock;
const mockedSetUnauthorizedHandler = setUnauthorizedHandler as jest.Mock;
const mockedGetItem = secureStorage.getItem as jest.Mock;
const mockedSetItem = secureStorage.setItem as jest.Mock;
const mockedDeleteItem = secureStorage.deleteItem as jest.Mock;

const user: SessionUser = { id: 'u1', email: 'r@communityhq.local', firstName: 'Demo', lastName: 'Resident', role: 'RESIDENT' };

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetItem.mockResolvedValue(null);
  });

  it('finishes loading with no user when no token is stored', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(mockedApiFetch).not.toHaveBeenCalled();
  });

  it('restores the session and registers for push on cold start when a token is stored', async () => {
    mockedGetItem.mockResolvedValue('stored-token');
    mockedApiFetch.mockResolvedValue({ user });

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedApiFetch).toHaveBeenCalledWith('/api/auth/me');
    expect(result.current.user).toEqual(user);
    expect(registerPushToken).toHaveBeenCalledTimes(1);
  });

  it('keeps the stored token and stays logged out on a non-auth error during restore', async () => {
    mockedGetItem.mockResolvedValue('stored-token');
    mockedApiFetch.mockRejectedValue(new Error('network down'));

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(mockedDeleteItem).not.toHaveBeenCalled();
  });

  it('login persists the token, sets the user, and registers for push', async () => {
    mockedApiFetch.mockResolvedValue({ user, token: 'new-token' });

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('r@communityhq.local', 'password123');
    });

    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'r@communityhq.local', password: 'password123' }) })
    );
    expect(mockedSetItem).toHaveBeenCalledWith('communityhq_token', 'new-token');
    expect(mockedSetAuthToken).toHaveBeenCalledWith('new-token');
    expect(result.current.user).toEqual(user);
    expect(registerPushToken).toHaveBeenCalledTimes(1);
  });

  it('logout clears the token and the user', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.logout();
    });

    expect(mockedSetAuthToken).toHaveBeenCalledWith(null);
    expect(mockedDeleteItem).toHaveBeenCalledWith('communityhq_token');
    expect(result.current.user).toBeNull();
  });

  it('registers a 401 handler on mount that logs the user out', async () => {
    await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(mockedSetUnauthorizedHandler).toHaveBeenCalled());

    const registeredHandler = mockedSetUnauthorizedHandler.mock.calls[0][0] as () => void;
    await act(async () => {
      registeredHandler();
    });

    expect(mockedSetAuthToken).toHaveBeenCalledWith(null);
    expect(mockedDeleteItem).toHaveBeenCalledWith('communityhq_token');
  });
});
