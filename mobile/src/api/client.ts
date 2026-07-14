import { API_URL } from '@/config';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let currentToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

// Wired up once by AuthContext on mount, so the client can react to a 401
// (expired/invalid token) without importing AuthContext here and creating a
// circular dependency.
export function setAuthToken(token: string | null) {
  currentToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (currentToken) {
    headers.set('Authorization', `Bearer ${currentToken}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 401) {
    onUnauthorized?.();
    throw new ApiError('Unauthorized', 401);
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error ?? 'Request failed', res.status);
  }
  return body as T;
}
